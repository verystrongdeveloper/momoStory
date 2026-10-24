import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { avatarOf, displayCharacterName } from '@/constants/characters';
import { episodesOf, episodeStory, publicationStory, listStories, subscribeStories, type SavedStory } from '@/store/storyLibrary';
import { getTemporaryChat } from '@/store/temporaryChats';
import { getGeminiKey, subscribeGeminiKey } from '@/services/geminiKey';
import { useI18n } from '@/i18n';
import CharacterChat from './CharacterChat';
import StoryLibraryList from './StoryLibraryList';
import VideoExportModal from './VideoExportModal';
import PublishStoryModal from '@/components/community/PublishStoryModal';
import { downloadStory } from '@/utils/storyFile';

export default function ConversationRoom({ story, setGlobalLoading }: { story: SavedStory; setGlobalLoading?: (value: boolean) => void }) {
  const { t, language } = useI18n();
  const [record, setRecord] = useState(() => listStories().find(item => item.id === story.id) ?? story);
  useEffect(() => subscribeStories(() => {
    const next = listStories().find(item => item.id === story.id);
    if (next) setRecord(next);
  }), [story.id]);
  const apiKey = useSyncExternalStore(subscribeGeminiKey, getGeminiKey, () => '');
  const session = getTemporaryChat(record.character, apiKey, 'bond', record.id);
  const { isWaiting } = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [editing, setEditing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingStoryId, setEditingStoryId] = useState<string | undefined>();
  const [video, setVideo] = useState<SavedStory | null>(null);
  const [publish, setPublish] = useState<SavedStory | null>(null);
  const [notice, setNotice] = useState('');
  const episode = episodesOf(record).find(story => story.id === selectedId);
  const selectedStory = episode ? episodeStory(record, episode.id) : null;
  if (editing) return <StoryLibraryList initialEdit={record} initialStoryId={editingStoryId} onOpenStory={() => {}} onFinishEdit={() => { setEditing(false); setRevision(value => value + 1); }} />;
  return <View style={styles.container}>
    <View style={styles.heading}>
      <Text style={[styles.title, { flex: 1 }]}>{record.title}</Text>
      <TouchableOpacity accessibilityRole="button" disabled={isWaiting} style={[styles.action, isWaiting && { opacity: 0.4 }]} onPress={() => { setEditingStoryId(undefined); setEditing(true); }}><Text>{t('editRoom')}</Text></TouchableOpacity>
    </View>
    {!!notice && <Text accessibilityRole="alert" style={styles.hint}>{notice}</Text>}
    <CharacterChat key={`${record.id}:${revision}`} characterName={record.character} displayName={displayCharacterName(record.character, language)} characterImage={avatarOf(record.character)} conversation={record} setGlobalLoading={setGlobalLoading} onStoryActions={setSelectedId} />
    {selectedStory && <Modal transparent visible animationType="fade" onRequestClose={() => setSelectedId(null)}>
      <View style={styles.overlay}><View style={styles.menu} accessibilityViewIsModal>
        <Text style={styles.title}>{selectedStory.title}</Text>
        <TouchableOpacity disabled={isWaiting} style={styles.action} onPress={() => { setEditingStoryId(selectedId ?? undefined); setSelectedId(null); setEditing(true); }}><Text>{t('editStory')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => { setSelectedId(null); void downloadStory(selectedStory).catch(() => setNotice(t('storyExportFailed'))); }}><Text>{t('export')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => { setSelectedId(null); setVideo(selectedStory); }}><Text>{t('exportVideo')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => { setSelectedId(null); setPublish(publicationStory(record, selectedStory.id)); }}><Text>{t('communityPublish')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => setSelectedId(null)}><Text>{t('close')}</Text></TouchableOpacity>
      </View></View>
    </Modal>}
    {video && <VideoExportModal story={video} onClose={() => setVideo(null)} />}
    {publish && <PublishStoryModal story={publish} onClose={() => setPublish(null)} />}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  heading: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#243044' },
  hint: { fontSize: 13, lineHeight: 20, color: '#758297', marginTop: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(36,32,40,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  menu: { width: '100%', maxWidth: 400, padding: 24, borderRadius: 18, backgroundColor: '#fff', gap: 12 },
  action: { minHeight: 40, justifyContent: 'center', borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#f7edf1' },
});
