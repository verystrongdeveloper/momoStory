import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { avatarOf, displayCharacterName } from '@/constants/characters';
import { useLayout } from '@/hooks/useLayout';
import StoryAssetPanel from '@/components/chat/StoryAssetPanel';
import VideoExportModal from './VideoExportModal';
import PublishStoryModal from '@/components/community/PublishStoryModal';
import StoryScriptEditor from './StoryScriptEditor';
import { deleteStory, importStory, listStories, SavedStory, subscribeStories, updateStory } from '@/store/storyLibrary';
import { insertAssetIntoScript, AssetKind } from '@/utils/insertStoryAsset';
import { copyText } from '@/platform/clipboard';
import { downloadStory, pickStoryFile } from '@/utils/storyFile';
import { buildStoryPrompt } from '@/utils/storyPrompt';
import { useI18n } from '@/i18n';
import CharacterAvatar from '@/components/CharacterAvatar';
import { bgMap } from '@/constants/eventAssets';
import parseEventScript from '@/utils/parseEventScript';

const localeOf = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' } as const;
const formatWhen = (createdAt: number, language: keyof typeof localeOf) =>
  new Intl.DateTimeFormat(localeOf[language], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(createdAt));

const normalizeSearch = (text: string) => text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

export default function StoryLibraryList({ onOpenStory }: { onOpenStory: (story: SavedStory) => void }) {
  const { language, t } = useI18n();
  const { isCompact } = useLayout();
  const [shelfWidth, setShelfWidth] = useState(0);
  const cardGap = isCompact ? 12 : 20;
  const minCardWidth = isCompact ? 144 : 300;
  const columns = Math.max(1, Math.floor((shelfWidth + cardGap) / (minCardWidth + cardGap)));
  const cardWidth = shelfWidth > 0 ? (shelfWidth - cardGap * (columns - 1)) / columns : undefined;
  const [stories, setStories] = useState<SavedStory[]>(() => listStories());
  const previewBackgrounds = useMemo(() => new Map(stories.map(story => {
    const firstBg = parseEventScript(story.script).find(line => line.bg)?.bg;
    return [story.id, firstBg ? bgMap[firstBg] : undefined];
  })), [stories]);
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'title' | 'content'>('title');
  const searchEntries = useMemo(() => stories.map((story) => ({
    story,
    title: normalizeSearch(story.title),
    content: normalizeSearch([story.script, ...(story.chatMessages ?? []).map((message) => message.text)].join('\n')),
  })), [stories]);
  const query = normalizeSearch(search);
  const filteredStories = useMemo(() => query
    ? searchEntries.filter((entry) => entry[searchMode].includes(query)).map((entry) => entry.story)
    : stories, [stories, searchEntries, query, searchMode]);
  const [editing, setEditing] = useState<SavedStory | 'new' | null>(null);
  const [draft, setDraft] = useState('');
  const [editorTab, setEditorTab] = useState<'story' | 'assets'>('story');
  const [notice, setNotice] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [listNotice, setListNotice] = useState('');
  const [videoStory, setVideoStory] = useState<SavedStory | null>(null);
  const [publishStory, setPublishStory] = useState<SavedStory | null>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const exportingRef = useRef(false);

  useEffect(() => subscribeStories(() => setStories(listStories())), []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'momo-story-card-hover';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent =
      '[data-story-card]:hover,[data-story-card]:focus-within{border-color:#f4d3dc !important;box-shadow:0 6px 14px rgba(36,48,68,0.10) !important;}';
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (menuId == null || typeof document === 'undefined') return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-story-menu]')) return;
      setMenuId(null);
      setConfirmId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuId]);

  const open = (story: SavedStory) => {
    setMenuId(null);
    onOpenStory(story);
  };

  const changeSearch = (value: string) => {
    setSearch(value);
    setMenuId(null);
    setConfirmId(null);
  };

  const toggleMenu = (id: string) => {
    setConfirmId(null);
    setMenuId((current) => (current === id ? null : id));
  };

  const startEdit = (story: SavedStory | 'new') => {
    setMenuId(null);
    setEditing(story);
    setDraft(story === 'new' ? '' : story.script.replace(/\r\n?/g, '\n'));
    setEditorTab('story');
    setNotice('');
    selectionRef.current = { start: 0, end: 0 };
  };

  const saveEdit = () => {
    if (!editing) return;
    if (editing === 'new') {
      const script = draft.trim();
      if (!script) {
        setNotice(t('emptyDraft'));
        return;
      }
      importStory(script);
    } else {
      updateStory(editing.id, draft);
    }
    setStories(listStories());
    setEditing(null);
  };

  const remove = (id: string) => {
    deleteStory(id);
    setConfirmId(null);
    setStories(listStories());
  };

  const copyPrompt = async () => {
    try {
      await copyText(buildStoryPrompt());
      setListNotice(t('promptCopied'));
    } catch {
      setListNotice(t('copyFailed'));
    }
  };

  const loadFile = async () => {
    const text = await pickStoryFile();
    if (text == null) return;
    const script = text.trim();
    if (!script) {
      setListNotice(t('emptyFile'));
      return;
    }
    importStory(script);
    setStories(listStories());
    setListNotice('');
  };

  const exportStory = async (story: SavedStory) => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setMenuId(null);
    setListNotice('');
    try {
      await downloadStory(story);
    } catch (error) {
      console.error('[StoryLibraryList] 추출 실패:', error);
      setListNotice(t(error instanceof Error && error.message === 'SAVE_LOCATION_UNSUPPORTED' ? 'fileSaveUnsupported' : 'storyExportFailed'));
      if (Platform.OS !== 'web') Alert.alert(t('storyExportFailedTitle'), t('storyExportFailed'));
    } finally {
      exportingRef.current = false;
    }
  };

  const insertAsset = (kind: AssetKind, file: string) => {
    const cursor = selectionRef.current.start;
    const next = insertAssetIntoScript(draft, cursor, kind, file);
    if (!next.ok) {
      setNotice(next.notice);
      return;
    }
    selectionRef.current = { start: next.cursor, end: next.cursor };
    setDraft(next.script);
    setNotice('');
  };

  if (editing) {
    return (
      <View style={styles.container}>
        <View style={styles.editorHeader}>
          <Text style={styles.title}>{t(editing === 'new' ? 'createStory' : 'editStory')}</Text>
          <View style={styles.editorActions}>
            <TouchableOpacity onPress={() => setEditing(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveEdit} style={styles.saveBtn}>
              <Text style={styles.saveText}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {!!notice && <Text style={styles.notice}>{notice}</Text>}
        <View style={[styles.editorBody, isCompact && styles.editorBodyCompact]}>
          {isCompact && (
            <View style={styles.editorTabs} accessibilityRole="tablist">
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: editorTab === 'story' }}
                onPress={() => setEditorTab('story')}
                style={[styles.editorTab, editorTab === 'story' && styles.editorTabActive]}
              >
                <Text style={[styles.editorTabText, editorTab === 'story' && styles.editorTabTextActive]}>{t('editStory')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: editorTab === 'assets' }}
                onPress={() => setEditorTab('assets')}
                style={[styles.editorTab, editorTab === 'assets' && styles.editorTabActive]}
              >
                <Text style={[styles.editorTabText, editorTab === 'assets' && styles.editorTabTextActive]}>{t('assets')}</Text>
              </TouchableOpacity>
            </View>
          )}
          {(!isCompact || editorTab === 'story') && (
            <StoryScriptEditor
              style={[styles.editor, isCompact && styles.editorCompact]}
              value={draft}
              onChangeText={setDraft}
              onSelectionChange={(selection) => {
                selectionRef.current = selection;
              }}
            />
          )}
          {(!isCompact || editorTab === 'assets') && (
            <StoryAssetPanel character={editing === 'new' ? '' : editing.character} onInsert={insertAsset} fullWidth={isCompact} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={[styles.header, isCompact && styles.headerCompact]}>
          <Text style={styles.libraryTitle}>{t('library')}</Text>
          <View style={[styles.headerActions, isCompact && styles.headerActionsCompact]}>
            <TouchableOpacity onPress={copyPrompt} style={styles.copyBtn}>
              <Text style={styles.copyText}>{t('copyPrompt')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={loadFile} style={styles.loadBtn}>
              <Text style={styles.loadText}>{t('load')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => startEdit('new')} style={styles.loadBtn}>
              <Text style={styles.loadText}>{t('createStory')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.searchControls}>
          <View style={styles.searchModes} accessibilityRole="radiogroup" accessibilityLabel={t('storySearchMode')}>
            {(['title', 'content'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                accessibilityRole="radio"
                accessibilityState={{ checked: searchMode === mode }}
                accessibilityLabel={t(mode === 'title' ? 'searchByTitle' : 'searchByContent')}
                style={[styles.searchMode, searchMode === mode && styles.searchModeActive]}
                onPress={() => {
                  setSearchMode(mode);
                  setMenuId(null);
                  setConfirmId(null);
                }}
              >
                <Text style={[styles.searchModeText, searchMode === mode && styles.searchModeTextActive]}>
                  {t(mode === 'title' ? 'searchByTitle' : 'searchByContent')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#84909d" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={changeSearch}
            placeholder={t('storySearchPlaceholder')}
            accessibilityLabel={t(searchMode === 'title' ? 'searchStoryTitle' : 'searchStoryContent')}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('clearStorySearch')}
              onPress={() => changeSearch('')}
              style={styles.clearSearch}
            >
              <Ionicons name="close-circle" size={20} color="#84909d" />
            </TouchableOpacity>
          )}
        </View>
        </View>
        {!!query && (
          <Text style={styles.searchCount} accessibilityLiveRegion="polite">
            {t('storySearchCount', { count: filteredStories.length, total: stories.length })}
          </Text>
        )}
        <View style={styles.shelf} onLayout={(event) => setShelfWidth(event.nativeEvent.layout.width)}>
        {!!listNotice && <Text style={styles.listNotice}>{listNotice}</Text>}
        {stories.length === 0 ? (
          <Text style={styles.empty}>{t('emptyStories')}</Text>
        ) : filteredStories.length === 0 ? (
          <Text style={styles.empty}>{t('noStorySearchResults')}</Text>
        ) : (
          <View style={[styles.grid, { gap: cardGap }]}>
            {filteredStories.map((story) => {
              const portrait = avatarOf(story.character);
              const background = previewBackgrounds.get(story.id);
              const menuOpen = menuId === story.id;
              return (
                <View
                  key={story.id}
                  dataSet={{ storyCard: 'true' }}
                  style={[styles.card, cardWidth !== undefined && { width: cardWidth }, menuOpen && styles.cardMenuOpen]}
                >
                  <TouchableOpacity style={styles.coverHit} onPress={() => open(story)} activeOpacity={0.92}>
                    {background && <Image source={background} resizeMode="cover" style={styles.previewBackground} />}
                    {portrait ? (
                      <CharacterAvatar characterName={story.character} source={portrait} style={[styles.portrait, background && styles.transparentPortrait]} />
                    ) : (
                      <View style={[styles.portrait, styles.portraitFallback, background && styles.transparentPortrait]}>
                        <Text style={styles.fallbackText}>{displayCharacterName(story.character, language).slice(0, 1)}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    dataSet={{ storyMenu: 'true' }}
                    accessibilityLabel={t('storyMenu')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => toggleMenu(story.id)}
                    style={[styles.moreBtn, menuOpen && styles.moreBtnOpen]}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color="#5c6570" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.body} onPress={() => open(story)} activeOpacity={0.92}>
                    <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
                      {story.title}
                    </Text>
                    <Text style={styles.character} numberOfLines={1}>
                      {displayCharacterName(story.character, language)}
                    </Text>
                    <Text style={styles.meta}>{formatWhen(story.createdAt, language)}</Text>
                  </TouchableOpacity>
                  {menuOpen && (
                    <View dataSet={{ storyMenu: 'true' }} style={styles.menu}>
                      {confirmId === story.id ? (
                        <>
                          <Text style={styles.confirmText}>{t('deleteQuestion')}</Text>
                          <TouchableOpacity onPress={() => remove(story.id)} style={styles.menuItem}>
                            <Text style={styles.menuDelete}>{t('delete')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setConfirmId(null)} style={styles.menuItem}>
                            <Text style={styles.menuKeep}>{t('cancel')}</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity onPress={() => startEdit(story)} style={styles.menuItem}>
                            <Text style={styles.menuText}>{t('edit')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => void exportStory(story)}
                            style={styles.menuItem}
                          >
                            <Text style={styles.menuText}>{t('export')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => { setMenuId(null); setVideoStory(story); }} style={styles.menuItem}>
                            <Text style={styles.menuText}>{t('exportVideo')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => { setMenuId(null); setPublishStory(story); }} style={styles.menuItem}>
                            <Text style={styles.menuText}>{t('communityPublish')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setConfirmId(story.id)} style={[styles.menuItem, styles.menuItemLast]}>
                            <Text style={styles.menuDelete}>{t('delete')}</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
        </View>
      </ScrollView>
      {videoStory && <VideoExportModal story={videoStory} onClose={() => setVideoStory(null)} />}
      {publishStory && <PublishStoryModal story={publishStory} onClose={() => setPublishStory(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    backgroundColor: '#f7f8fa',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  content: {
    width: '100%',
    maxWidth: '100%',
    paddingHorizontal: 28,
    paddingVertical: 28,
    flexGrow: 1,
    boxSizing: 'border-box',
  },
  shelf: {
    width: '100%',
    alignSelf: 'flex-start',
  },
  contentCompact: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  headerCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  headerActions: {
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    maxWidth: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 8,
  },
  headerActionsCompact: {
    alignSelf: 'flex-end',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
  },
  libraryTitle: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
  },
  searchControls: {
    width: 420,
    maxWidth: '100%',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchModes: {
    flexDirection: 'row',
    flexShrink: 0,
    padding: 3,
    borderRadius: 10,
    backgroundColor: '#e9eef3',
  },
  searchMode: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  searchModeActive: { backgroundColor: '#fff' },
  searchModeText: { color: '#6a8298', fontSize: 13 },
  searchModeTextActive: { color: '#243e5c', fontWeight: '700' },
  searchBar: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#dce3e9',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 15,
    color: '#243044',
  },
  clearSearch: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCount: {
    marginBottom: 12,
    color: '#6a8298',
    fontSize: 13,
  },
  copyBtn: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7f1fa',
  },
  copyText: {
    color: '#2d6ea8',
    fontSize: 14,
    fontWeight: '700',
  },
  loadBtn: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FB94A7',
  },
  loadText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  listNotice: {
    marginTop: -8,
    marginBottom: 12,
    color: '#c45b73',
    fontSize: 13,
  },
  empty: {
    color: '#999',
    fontSize: 16,
    marginTop: 24,
  },
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  card: {
    width: '100%',
    minWidth: 0,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e6ebf0',
    overflow: 'visible',
    boxSizing: 'border-box',
    shadowColor: '#243044',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardMenuOpen: {
    zIndex: 4,
  },
  coverHit: {
    width: '100%',
    aspectRatio: 1.55,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    overflow: 'hidden',
    backgroundColor: '#f3d5dc',
  },
  moreBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    zIndex: 2,
  },
  moreBtnOpen: {
    backgroundColor: '#ffffff',
  },
  menu: {
    position: 'absolute',
    top: 40,
    right: 8,
    width: 132,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e6ebf0',
    zIndex: 3,
    shadowColor: '#243044',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  menuItemLast: {
    borderTopWidth: 1,
    borderTopColor: '#f1f3f6',
  },
  menuText: {
    color: '#3a4150',
    fontSize: 14,
    fontWeight: '600',
  },
  menuDelete: {
    color: '#a36a78',
    fontSize: 14,
    fontWeight: '600',
  },
  menuKeep: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmText: {
    paddingTop: 8,
    paddingHorizontal: 14,
    color: '#8a9199',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 12,
  },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FB94A7',
  },
  saveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  notice: {
    paddingHorizontal: 28,
    paddingBottom: 8,
    color: '#c45b73',
    fontSize: 13,
  },
  editorBody: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 28,
    paddingBottom: 28,
    overflow: 'visible',
  },
  editorBodyCompact: {
    flexDirection: 'column',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  editorTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    backgroundColor: '#eceff3',
    gap: 4,
  },
  editorTab: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#243044',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  editorTabText: {
    color: '#67717d',
    fontSize: 13,
    fontWeight: '700',
  },
  editorTabTextActive: {
    color: '#d85b76',
  },
  editor: {
    flex: 1,
  },
  editorCompact: {
    width: '100%',
  },
  portrait: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    backgroundColor: '#f3d5dc',
  },
  previewBackground: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  transparentPortrait: { backgroundColor: 'transparent' },
  portraitFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FB94A7',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#16181d',
    lineHeight: 27,
  },
  character: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#FB94A7',
    lineHeight: 20,
  },
  meta: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '500',
    color: '#9aa3ad',
    lineHeight: 16,
  },
});
