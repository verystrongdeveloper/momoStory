import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useI18n } from '@/i18n';
import { avatarOf, displayCharacterName } from '@/constants/characters';
import CharacterChat from '@/components/chat/CharacterChat';
import { community, communityConfigured, communityErrorKey, communityStory, type CommunityDetail, type CommunityPost, type RankingPeriod } from '@/services/community/client';
import { charCount } from '@/shared/community/validation';
import { importSharedStory, listStories, subscribeStories } from '@/store/storyLibrary';
import CharacterAvatar from '@/components/CharacterAvatar';
import { bgMap } from '@/constants/eventAssets';

function Button({ label, onPress, disabled = false, selected = false }: { label: string; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} style={[styles.button, selected && styles.selected, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
}

export default function CommunityPanel() {
  const { t, language } = useI18n();
  const [liked, setLiked] = useState(false);
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [period, setPeriod] = useState<RankingPeriod>('all');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selected, setSelected] = useState<CommunityPost | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [more, setMore] = useState(false);
  const [reload, setReload] = useState(0);
  const [gridWidth, setGridWidth] = useState(0);
  const columns = gridWidth >= 720 ? 3 : 2;
  const cardWidth = gridWidth > 0 ? Math.floor((gridWidth - 12 * (columns - 1)) / columns) : '47%';
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const id = ++generation.current;
    pending.current = true; setBusy(true); setPosts([]); setMore(false); setNotice('');
    if (!communityConfigured()) { setNotice(t('communitySetup')); pending.current = false; setBusy(false); return; }
    void community.list({ liked, sort, period, query, offset: 0 }).then(rows => {
      if (generation.current === id) { setPosts(rows); setMore(rows.length === 20); }
    }).catch(error => { if (generation.current === id) setNotice(t(communityErrorKey(error))); })
      .finally(() => { if (generation.current === id) { pending.current = false; setBusy(false); } });
    return () => { generation.current++; };
  }, [liked, sort, period, query, reload, t]);
  const loadMore = async () => {
    if (pending.current) return;
    const id = generation.current;
    pending.current = true; setBusy(true); setNotice('');
    try {
      const rows = await community.list({ liked, sort, period, query, offset: posts.length });
      if (generation.current === id) {
        setPosts(previous => [...previous, ...rows.filter(row => !previous.some(item => item.id === row.id))]);
        setMore(rows.length === 20);
      }
    } catch (error) { if (generation.current === id) setNotice(t(communityErrorKey(error))); }
    finally { if (generation.current === id) { pending.current = false; setBusy(false); } }
  };
  if (selected) return <CommunityPostView key={selected.id} id={selected.id} onBack={() => { setSelected(null); setReload(value => value + 1); }} />;
  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.row}><Text style={styles.title}>{t('community')}</Text><Button label={t('communityRefresh')} onPress={() => setReload(value => value + 1)} disabled={busy} /></View>
      <View style={styles.controls}>
        <Button label={t('communityAll')} selected={!liked} onPress={() => setLiked(false)} />
        <Button label={t('communityLiked')} selected={liked} onPress={() => setLiked(true)} />
        <Button label={t('communityLatest')} selected={sort === 'latest'} onPress={() => setSort('latest')} />
        <Button label={t('communityPopular')} selected={sort === 'popular'} onPress={() => setSort('popular')} />
      </View>
      {sort === 'popular' && <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll} contentContainerStyle={styles.periods}>
          {(['all', 'day', 'week', 'month', 'year'] as const).map(value => <Button key={value} label={t(`communityPeriod_${value}`)} selected={period === value} onPress={() => setPeriod(value)} />)}
        </ScrollView>
        <Text style={styles.hint}>{t('communityRankingHint')}</Text>
      </>}
      <View style={styles.searchRow}><TextInput accessibilityLabel={t('communitySearch')} placeholder={t('communitySearch')} value={input} maxLength={100} onChangeText={setInput} onSubmitEditing={() => setQuery(input.trim())} style={styles.search} /><Button label={t('communitySearchButton')} onPress={() => setQuery(input.trim())} /></View>
      <Text style={styles.hint}>{t('communityPrivacy')}</Text>
      {!!notice && <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
      {!posts.length && !busy && !notice && <Text style={styles.hint}>{t('communityEmpty')}</Text>}
      <View style={styles.grid} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>{posts.map(post => {
        const avatar = avatarOf(post.character);
        const background = post.preview_bg ? bgMap[post.preview_bg] : undefined;
        return <TouchableOpacity key={post.id} accessibilityRole="button" accessibilityLabel={post.title} style={[styles.card, { width: cardWidth }]} onPress={() => setSelected(post)}>
          <View style={styles.preview}>
            {background && <Image source={background} resizeMode="cover" style={styles.background} />}
            {avatar && <CharacterAvatar characterName={post.character} source={avatar} style={styles.avatar} />}
          </View>
          <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">{post.title}</Text>
          <Text style={styles.hint}>{displayCharacterName(post.character, language)}</Text>
          <Text style={styles.hint}>{post.liked ? '♥' : '♡'} {post.likes} · {t('communityViews', { count: post.views })} · {t('communityCommentCount', { count: post.comment_count ?? 0 })}</Text>
          {sort === 'popular' && period !== 'all' && <Text style={styles.hint}>{t('communityPeriodLikes', { count: post.period_likes ?? 0 })}</Text>}
        </TouchableOpacity>;
      })}</View>
      {busy && <ActivityIndicator color="#e780a0" />}
      {more && <Button label={t('communityMore')} disabled={busy} onPress={() => void loadMore()} />}
    </ScrollView>
  </View>;
}

function CommunityPostView({ id, onBack }: { id: string; onBack: () => void }) {
  const { t, language } = useI18n();
  const imported = useSyncExternalStore(subscribeStories, () => listStories().some(story => story.id === `community-${id}`), () => false);
  const [detail, setDetail] = useState<CommunityDetail | null>(null);
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [comment, setComment] = useState('');
  const [more, setMore] = useState(false);
  const [confirm, setConfirm] = useState<{ action: 'post' | 'comment'; commentId?: string } | null>(null);
  const [reload, setReload] = useState(0);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let current = true; setLoading(true); setNotice('');
    // View errors are not silently swallowed; a failed view can be retried with refresh.
    void (async () => {
      await community.view(id);
      const result = await community.detail(id);
      if (current) { setDetail(result); setMore(result.comments.length === 30); }
    })().catch(error => { if (current) setNotice(t(communityErrorKey(error))); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id, reload, t]);
  const mutate = async (action: () => Promise<unknown>, success?: string) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setNotice('');
    try {
      await action();
      if (!alive.current) return;
      if (success) setNotice(t(success));
    } catch (error) { if (alive.current) setNotice(t(communityErrorKey(error))); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  const refresh = async () => {
    const result = await community.detail(id);
    if (alive.current) { setDetail(result); setMore(result.comments.length === 30); }
  };
  const moreComments = () => mutate(async () => {
    if (!detail) return;
    const result = await community.detail(id, detail.comments.length);
    if (alive.current) {
      setDetail(previous => previous ? { ...result, comments: [...previous.comments, ...result.comments.filter(row => !previous.comments.some(item => item.id === row.id))] } : result);
      setMore(result.comments.length === 30);
    }
  });
  if (watching && detail) return <View style={styles.root}>
    <View style={styles.toolbar}><Button label={t('previous')} onPress={() => setWatching(false)} /><Text style={styles.storyTitle} numberOfLines={1}>{detail.title}</Text></View>
    <CharacterChat key={detail.id} characterName={detail.character} displayName={displayCharacterName(detail.character, language)} characterImage={avatarOf(detail.character)} savedStory={communityStory(detail)} />
  </View>;
  return <View style={styles.root}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.controls}><Button label={t('previous')} onPress={onBack} /><Button label={t('communityRefresh')} disabled={busy || loading} onPress={() => setReload(value => value + 1)} /></View>
    {loading && <ActivityIndicator color="#e780a0" />}
    {!!notice && <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
    {detail && <>
      <Text style={styles.title}>{detail.title}</Text>
      <Text style={styles.hint}>{t('communityViews', { count: detail.views })} · {t('communityLikes', { count: detail.likes })}</Text>
      <View style={styles.controls}>
        <Button label={t('communityWatch')} onPress={() => setWatching(true)} />
        <Button label={t(imported ? 'communityImported' : 'communityImport')} disabled={imported || loading} onPress={() => {
          try { importSharedStory(communityStory(detail)); setNotice(t('communityImportSuccess')); }
          catch { setNotice(t('communityImportFailed')); }
        }} />
        <Button label={t(detail.liked ? 'communityUnlike' : 'communityLike')} selected={detail.liked} disabled={busy || loading} onPress={() => void mutate(async () => { await community.like(id, !detail.liked); await refresh(); })} />
        <Button label={t('communityReport')} disabled={busy || loading} onPress={() => void mutate(() => community.report(id), 'communityReported')} />
        {detail.is_mine && <Button label={t('delete')} disabled={busy || loading} onPress={() => setConfirm({ action: 'post' })} />}
      </View>
      <Text style={styles.storyTitle}>{t('communityComments')}</Text>
      <Text style={styles.hint}>{t('communityLimits')}</Text>
      <TextInput accessibilityLabel={t('communityCommentPlaceholder')} placeholder={t('communityCommentPlaceholder')} value={comment} onChangeText={value => setComment(Array.from(value).slice(0, 300).join(''))} multiline style={styles.commentInput} />
      <View style={styles.row}><Text style={styles.hint}>{charCount(comment)} / 300</Text><Button label={t(busy ? 'communityBusy' : 'send')} disabled={busy || loading || !comment.trim()} onPress={() => void mutate(async () => { await community.comment(id, comment); if (alive.current) setComment(''); await refresh(); })} /></View>
      {!detail.comments.length && <Text style={styles.hint}>{t('communityNoComments')}</Text>}
      {detail.comments.map(item => <View key={item.id} style={styles.comment}>
        <Text selectable style={styles.commentText}>{item.body}</Text>
        <View style={styles.row}><Text style={styles.hint}>{new Date(item.created_at).toLocaleString(language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : 'en-US')}</Text>
          {item.is_mine && <Button label={t('delete')} disabled={busy} onPress={() => setConfirm({ action: 'comment', commentId: item.id })} />}
        </View>
      </View>)}
      {more && <Button label={t('communityMore')} disabled={busy || loading} onPress={() => void moreComments()} />}
    </>}
  </ScrollView>
    <Modal transparent visible={!!confirm} animationType="fade" onRequestClose={() => { if (!pending.current) setConfirm(null); }}>
      <View style={styles.overlay}><View style={styles.confirm}>
        <Text style={styles.storyTitle}>{t('communityDeleteConfirm')}</Text><Text style={styles.hint}>{t('communityDeleteWarning')}</Text>
        <View style={styles.controls}><Button label={t('cancel')} disabled={busy} onPress={() => setConfirm(null)} /><Button label={t('delete')} disabled={busy} onPress={() => {
          const target = confirm; setConfirm(null);
          void mutate(async () => { if (target?.action === 'post') { await community.deletePost(id); onBack(); } else if (target?.commentId) { await community.deleteComment(id, target.commentId); await refresh(); } });
        }} /></View>
      </View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, backgroundColor: '#f7f8fa' },
  content: { padding: 20, gap: 16, flexGrow: 1 },
  title: { fontSize: 23, fontWeight: '700', color: '#243044', flexShrink: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodScroll: { flexGrow: 0, flexShrink: 0 },
  periods: { flexDirection: 'row', gap: 8 },
  toolbar: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#e9eef5', alignSelf: 'flex-start' },
  buttonText: { color: '#365170', fontWeight: '600' },
  selected: { backgroundColor: '#f8d6e3' },
  disabled: { opacity: 0.45 },
  searchRow: { flexDirection: 'row', gap: 8, maxWidth: 440 },
  search: { flex: 1, minWidth: 0, padding: 10, backgroundColor: 'white', borderWidth: 1, borderColor: '#dce2ea', borderRadius: 10 },
  hint: { color: '#758297', fontSize: 13, lineHeight: 20 },
  notice: { color: '#a33a54', lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: 10, borderRadius: 12, backgroundColor: 'white', gap: 8, borderWidth: 1, borderColor: '#e4e8ef' },
  cardTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: '#33425a' },
  preview: { width: '100%', aspectRatio: 1.2, maxHeight: 150, overflow: 'hidden', backgroundColor: '#f3d5dc' },
  background: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  avatar: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'transparent' },
  storyTitle: { fontSize: 17, fontWeight: '700', color: '#33425a', flexShrink: 1 },
  commentInput: { minHeight: 86, textAlignVertical: 'top', padding: 12, backgroundColor: 'white', borderWidth: 1, borderColor: '#dce2ea', borderRadius: 10 },
  comment: { backgroundColor: 'white', borderRadius: 12, padding: 14, gap: 10 },
  commentText: { color: '#33425a', lineHeight: 23 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,.45)' },
  confirm: { width: '100%', maxWidth: 420, backgroundColor: 'white', padding: 24, borderRadius: 18, gap: 18 },
});
