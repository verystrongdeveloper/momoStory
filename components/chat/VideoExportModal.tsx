import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SavedStory } from '@/store/storyLibrary';
import { useI18n } from '@/i18n';
import { videoDimensions, type VideoQuality, type VideoRatio } from '@/services/videoExport/timeline';
import { beginVideoExport, cancelVideoExport, getVideoExportJob, subscribeVideoExportJob, videoExportBusy } from '@/store/videoExportJob';

export default function VideoExportModal({ story, onClose }: { story: SavedStory; onClose: () => void }) {
  const { language, t } = useI18n();
  const [ratio, setRatio] = useState<VideoRatio>('16:9');
  const [quality, setQuality] = useState<VideoQuality>('720p');
  const [includeChat, setIncludeChat] = useState(true);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const busy = useSyncExternalStore(subscribeVideoExportJob, videoExportBusy, () => false);
  const selection = useRef<{ id: number; detached: boolean } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (selection.current && !selection.current.detached) cancelVideoExport(selection.current.id); };
  }, []);
  const close = () => { if (selection.current && !selection.current.detached) cancelVideoExport(selection.current.id); onClose(); };
  const start = async () => {
    if (selection.current || busy) return;
    setError('');
    const started = beginVideoExport(story, ratio, language, { bondEvent: t('bondEvent'), bondStory: t('bondStory', { name: story.character }) }, includeChat, quality);
    if (!started) { setError('videoExportBusy'); return; }
    const pending = { id: started.id, detached: false };
    selection.current = pending;
    setPicking(true);
    const accepted = await started.ready;
    if (!alive.current) return;
    if (accepted) { pending.detached = true; onClose(); }
    else {
      selection.current = null;
      setPicking(false);
      const job = getVideoExportJob();
      if (job?.id === started.id && job.status === 'error') setError(job.error);
    }
  };
  return <Modal transparent animationType="fade" visible onRequestClose={close} statusBarTranslucent>
    <View style={styles.backdrop} accessibilityViewIsModal><View style={styles.card}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('exportVideo')}</Text>
        <Text style={styles.storyTitle} numberOfLines={2}>{story.title}</Text>
        {picking ? <Text style={styles.hint} accessibilityLiveRegion="polite">{t('videoChooseLocation')}</Text> : <>
          <Text style={styles.hint}>{t(includeChat ? 'videoExportHint' : 'videoStoryOnlyHint')}</Text>
          <Text style={styles.hint}>{t('videoLimitHint')}</Text>
          <Text style={styles.hint}>{t('videoBackgroundHint')}</Text>
          <View style={styles.chatModes} accessibilityRole="radiogroup" accessibilityLabel={t('videoChatMode')}>
            {[true, false].map(value => <TouchableOpacity key={String(value)} accessibilityRole="radio" accessibilityState={{ checked: includeChat === value }}
              accessibilityLabel={t(value ? 'videoIncludeChat' : 'videoExcludeChat')} onPress={() => setIncludeChat(value)}
              style={[styles.chatMode, includeChat === value && styles.selectedRatio]}>
              <Text style={styles.ratioText}>{t(value ? 'videoIncludeChat' : 'videoExcludeChat')}</Text>
            </TouchableOpacity>)}
          </View>
          <View style={styles.ratios} accessibilityRole="radiogroup" accessibilityLabel={t('videoRatio')}>
            {(['16:9', '9:16'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: ratio === value }} accessibilityLabel={value}
              onPress={() => setRatio(value)} style={[styles.ratio, ratio === value && styles.selectedRatio]}>
              <View style={[styles.ratioShape, value === '9:16' ? { width: 27, height: 48 } : { width: 64, height: 36 }]} />
              <Text style={styles.ratioText}>{value}</Text>
            </TouchableOpacity>)}
          </View>
          <Text style={styles.hint}>{t('videoQuality')}</Text>
          <View style={styles.qualities} accessibilityRole="radiogroup" accessibilityLabel={t('videoQuality')}>
            {(['720p', '1080p'] as const).map(value => {
              const size = videoDimensions(ratio, value);
              return <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: quality === value }} accessibilityLabel={value}
                onPress={() => setQuality(value)} style={[styles.quality, quality === value && styles.selectedRatio]}>
                <Text style={styles.ratioText}>{value}</Text>
                <Text style={styles.dimensions}>{size.width} × {size.height}</Text>
              </TouchableOpacity>;
            })}
          </View>
          <Text style={styles.hint}>{t('videoQualityHint')}</Text>
          {busy && <Text style={styles.hint}>{t('videoExportBusy')}</Text>}
          {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{t(error)}</Text>}
        </>}
        <View style={styles.actions}>
          <TouchableOpacity onPress={close} style={styles.secondary}><Text style={styles.secondaryText}>{t(picking ? 'cancel' : 'close')}</Text></TouchableOpacity>
          {!picking && <TouchableOpacity disabled={busy} onPress={() => void start()} style={[styles.primary, busy && { opacity: 0.4 }]} accessibilityRole="button">
            <Text style={styles.primaryText}>{t('videoDownload')}</Text>
          </TouchableOpacity>}
        </View>
      </ScrollView>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  qualities: { flexDirection: 'row', gap: 12, marginTop: 10 },
  quality: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 72, gap: 6, borderWidth: 2, borderColor: '#e6ebf0', borderRadius: 12, backgroundColor: '#f8fafc' },
  dimensions: { color: '#67717d', fontSize: 12 },
  chatModes: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chatMode: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderWidth: 2, borderColor: '#e6ebf0', borderRadius: 10, backgroundColor: '#f8fafc', padding: 8 },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#18202b88', padding: 20 },
  card: { width: 440, maxWidth: '100%', maxHeight: '90%', borderRadius: 20, backgroundColor: '#fff', overflow: 'hidden' },
  content: { padding: 24 },
  heading: { fontSize: 21, fontWeight: '800', color: '#243044' },
  storyTitle: { marginTop: 8, fontSize: 14, color: '#6a8298' },
  hint: { marginTop: 16, fontSize: 14, lineHeight: 21, color: '#67717d' },
  ratios: { flexDirection: 'row', gap: 12, marginTop: 20 },
  ratio: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 116, gap: 12, borderWidth: 2, borderColor: '#e6ebf0', borderRadius: 12, backgroundColor: '#f8fafc' },
  selectedRatio: { borderColor: '#ef8eaa', backgroundColor: '#fff4f7' },
  ratioShape: { borderWidth: 2, borderColor: '#c96682', backgroundColor: '#f7cedb', borderRadius: 4 },
  ratioText: { color: '#3a4150', fontWeight: '700', fontSize: 15 },
  error: { marginTop: 16, fontSize: 14, lineHeight: 21, color: '#b34f68' },
  progressArea: { marginTop: 24 },
  status: { marginTop: 16, color: '#3a4150', fontSize: 15 },
  track: { height: 8, backgroundColor: '#f4e8ed', borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', backgroundColor: '#ef8eaa' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: 24 },
  secondary: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#f2f4f7' },
  secondaryText: { color: '#67717d', fontWeight: '700' },
  primary: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#ef8eaa' },
  primaryText: { color: '#fff', fontWeight: '700' },
});
