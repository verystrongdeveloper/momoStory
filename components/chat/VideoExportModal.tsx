import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SavedStory } from '@/store/storyLibrary';
import { useI18n } from '@/i18n';
import { prepareVideo } from '@/services/videoExport/prepare';
import type { VideoRatio } from '@/services/videoExport/timeline';
import { videoFileName, type ExportProgress, type VideoPayload } from '@/services/videoExport/types';
import { chooseVideoSaveTarget } from '@/platform/videoSave';
import type { FileSaveTarget } from '@/platform/fileSave.types';
import VideoExportWorker from '@/platform/VideoExportWorker';

export default function VideoExportModal({ story, onClose }: { story: SavedStory; onClose: () => void }) {
  const { language, t } = useI18n();
  const [ratio, setRatio] = useState<VideoRatio>('16:9');
  const [status, setStatus] = useState<'idle' | 'picking' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<ExportProgress>({ phase: 'preparing', progress: 0 });
  const [payload, setPayload] = useState<VideoPayload | null>(null);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const destination = useRef<FileSaveTarget | undefined>(undefined);
  const alive = useRef(true);
  const starting = useRef(false);
  const phase = useRef<'picking' | ExportProgress['phase']>('preparing');
  const reportProgress = useCallback((value: ExportProgress) => {
    phase.current = value.phase;
    setProgress(value);
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; controller.current?.abort(); void destination.current?.cancel?.().catch(() => {}); };
  }, []);

  const failed = useCallback((failure: Error) => {
    if (!alive.current || controller.current?.signal.aborted) return;
    starting.current = false;
    setPayload(null);
    void destination.current?.cancel?.().catch(() => {});
    if (failure.message.includes('EXPORT_CANCELED')) { setStatus('idle'); return; }
    console.error('[VideoExport]', phase.current, failure);
    const key = failure.message === 'VIDEO_UNSUPPORTED' ? 'videoUnsupported'
      : failure.message === 'VIDEO_NATIVE_REBUILD' ? 'videoNativeRebuild'
      : failure.message === 'VIDEO_TOO_LONG' ? 'videoTooLong'
      : failure.message === 'VIDEO_TOO_LARGE' ? 'videoTooLarge'
      : failure.message === 'SAVE_LOCATION_UNSUPPORTED' ? 'fileSaveUnsupported'
      : phase.current === 'preparing' ? 'videoPrepareFailed'
      : phase.current === 'encoding' ? 'videoEncodeFailed'
      : 'videoSaveFailed';
    setError(key); setStatus('error');
  }, []);

  const start = async () => {
    if (starting.current) return;
    starting.current = true;
    const abort = new AbortController(); controller.current = abort;
    phase.current = 'picking';
    setError(''); setStatus('picking');
    try {
      const target = await chooseVideoSaveTarget(videoFileName(story.title, ratio), abort.signal);
      if (!alive.current || abort.signal.aborted) { await target?.cancel?.(); return; }
      if (target === null) { starting.current = false; setStatus('idle'); return; }
      destination.current = target;
      setStatus('working'); reportProgress({ phase: 'preparing', progress: 0 });
      const prepared = await prepareVideo(story, ratio, language, {
        bondEvent: t('bondEvent'), bondStory: t('bondStory', { name: story.character }),
      }, { signal: abort.signal, onProgress: (value) => { if (alive.current && !abort.signal.aborted) reportProgress(value); } });
      if (alive.current && !abort.signal.aborted) { phase.current = 'encoding'; setPayload(prepared); }
    } catch (failure) { failed(failure instanceof Error ? failure : new Error(String(failure))); }
  };

  const completed = useCallback(() => {
    if (!alive.current) return;
    setPayload(null); setStatus('done'); setProgress({ phase: 'saving', progress: 1 });
    starting.current = false;
  }, []);
  const canClose = status !== 'working' || progress.phase !== 'saving';
  const close = () => { if (canClose) { controller.current?.abort(); onClose(); } };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.heading}>{t('exportVideo')}</Text>
            <Text style={styles.storyTitle} numberOfLines={2}>{story.title}</Text>
            {status === 'idle' || status === 'error' ? (
              <>
                <Text style={styles.hint}>{t('videoExportHint')}</Text>
                <Text style={styles.hint}>{t('videoLimitHint')}</Text>
                <View style={styles.ratios} accessibilityRole="radiogroup" accessibilityLabel={t('videoRatio')}>
                  {(['16:9', '9:16'] as const).map((value) => (
                    <TouchableOpacity
                      key={value} accessibilityRole="radio" accessibilityState={{ checked: ratio === value }}
                      accessibilityLabel={value} onPress={() => setRatio(value)}
                      style={[styles.ratio, ratio === value && styles.selectedRatio]}
                    >
                      <View style={[styles.ratioShape, value === '9:16' ? { width: 27, height: 48 } : { width: 64, height: 36 }]} />
                      <Text style={styles.ratioText}>{value}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{t(error)}</Text>}
              </>
            ) : status === 'picking' ? (
              <Text style={styles.hint} accessibilityLiveRegion="polite">{t('videoChooseLocation')}</Text>
            ) : status === 'working' ? (
              <View style={styles.progressArea}>
                <ActivityIndicator color="#d85b76" size="large" />
                <Text style={styles.status} accessibilityLiveRegion="polite">
                  {t(progress.phase === 'preparing' ? 'videoPreparing' : progress.phase === 'saving' ? 'videoSaving' : 'videoEncoding')} {Math.floor(progress.progress * 100)}%
                </Text>
                <View style={styles.track}><View style={[styles.fill, { width: `${progress.progress * 100}%` }]} /></View>
                <Text style={styles.hint}>{t('videoKeepOpen')}</Text>
              </View>
            ) : <Text style={styles.hint}>{t(Platform.OS === 'android' ? 'videoSavedDownloads' : destination.current?.kind === 'save-as' ? 'videoSavedFile' : 'videoDownloadStarted')}</Text>}
            <View style={styles.actions}>
              <TouchableOpacity onPress={close} disabled={!canClose} style={[styles.secondary, !canClose && { opacity: 0.4 }]}>
                <Text style={styles.secondaryText}>{t(status === 'working' || status === 'picking' ? 'cancel' : 'close')}</Text>
              </TouchableOpacity>
              {(status === 'idle' || status === 'error') && (
                <TouchableOpacity onPress={() => void start()} style={styles.primary} accessibilityRole="button">
                  <Text style={styles.primaryText}>{t('videoDownload')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
        {payload && controller.current && (
          <VideoExportWorker payload={payload} options={{ signal: controller.current.signal, onProgress: reportProgress }} destination={destination.current} onComplete={completed} onError={failed} />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
