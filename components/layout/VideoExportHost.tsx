import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/i18n';
import VideoExportWorker from '@/platform/VideoExportWorker';
import { cancelVideoExport, completeVideoExport, dismissVideoExport, failVideoExport, getVideoExportJob, getVideoExportQueue, reportVideoExport, subscribeVideoExportJob } from '@/store/videoExportJob';

export default function VideoExportHost() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const job = useSyncExternalStore(subscribeVideoExportJob, getVideoExportJob, () => null);
  const queue = useSyncExternalStore(subscribeVideoExportJob, getVideoExportQueue, getVideoExportQueue);
  const [queueOpen, setQueueOpen] = useState(false);
  useEffect(() => { if (!queue.length) setQueueOpen(false); }, [queue.length]);
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    opacity.setValue(1);
    if (job?.status !== 'done') return;
    const id = job.id;
    let fade: Animated.CompositeAnimation | undefined;
    const timer = setTimeout(() => {
      fade = Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true });
      fade.start(({ finished }) => {
        const current = getVideoExportJob();
        if (finished && current?.id === id && current.status === 'done') dismissVideoExport();
      });
    }, 5000);
    return () => { clearTimeout(timer); fade?.stop(); };
  }, [job?.id, job?.status, opacity]);
  if (!job || job.status === 'picking') return null;
  const working = job.status === 'working';
  const saving = working && job.progress.phase === 'saving';
  const label = working ? `${t(job.progress.phase === 'preparing' ? 'videoPreparing' : saving ? 'videoSaving' : 'videoEncoding')} ${Math.floor(job.progress.progress * 100)}%`
    : t(job.status === 'error' ? job.error : job.status === 'canceled' ? 'videoExportCanceled'
      : Platform.OS === 'android' ? 'videoSavedDownloads' : job.destination?.kind === 'save-as' ? 'videoSavedFile' : 'videoDownloadStarted');
  return <View pointerEvents="box-none" style={[styles.root, { paddingBottom: insets.bottom + 8 }]}>
    <Animated.View style={[styles.banner, { opacity }]}>
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>{job.title}</Text>
        <Text style={[styles.status, job.status === 'error' && styles.error]} accessibilityLiveRegion="polite">{label}</Text>
        {queue.length > 1 && <>
          <Text style={styles.status}>{t('videoQueueSummary', { done: queue.filter(item => item.status === 'done').length, total: queue.length })}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => setQueueOpen(true)}><Text style={styles.buttonText}>{t('videoQueueList', { count: queue.filter(item => item.status === 'queued' || item.status === 'picking').length })}</Text></TouchableOpacity>
        </>}
        {working && <View style={styles.track}><View style={[styles.fill, { width: `${job.progress.progress * 100}%` }]} /></View>}
      </View>
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => working ? cancelVideoExport(job.id) : dismissVideoExport()} style={[styles.button, saving && styles.disabled]}>
        <Text style={styles.buttonText}>{t(working ? 'cancel' : 'close')}</Text>
      </TouchableOpacity>
    </Animated.View>
    {queueOpen && <Modal transparent visible animationType="fade" onRequestClose={() => setQueueOpen(false)}>
      <View style={styles.overlay}><View style={styles.queueCard} accessibilityViewIsModal>
        <Text style={styles.title}>{t('videoQueueTitle')}</Text>
        <ScrollView style={styles.queueList} keyboardShouldPersistTaps="handled">
          {queue.map((item, index) => {
            const cancelable = ['queued', 'picking', 'working'].includes(item.status) && !(item.status === 'working' && item.progress.phase === 'saving');
            const status = item.status === 'working' ? t(item.progress.phase === 'preparing' ? 'videoPreparing' : item.progress.phase === 'saving' ? 'videoSaving' : 'videoEncoding')
              : t(item.status === 'queued' ? 'videoQueueWaiting' : item.status === 'picking' ? 'videoChooseLocation' : item.status === 'done' ? 'videoQueueDone' : item.status === 'canceled' ? 'videoExportCanceled' : item.error);
            return <View key={item.id} style={styles.queueRow}>
              <View style={styles.texts}><Text style={styles.title} numberOfLines={1}>{index + 1}. {item.title}</Text><Text style={[styles.status, item.status === 'error' && styles.error]}>{status}</Text></View>
              {cancelable && <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('videoQueueCancel', { name: item.title })} style={styles.button} onPress={() => cancelVideoExport(item.id)}><Text style={styles.buttonText}>{t('cancel')}</Text></TouchableOpacity>}
            </View>;
          })}
        </ScrollView>
        <TouchableOpacity accessibilityRole="button" style={styles.queueClose} onPress={() => setQueueOpen(false)}><Text style={styles.buttonText}>{t('close')}</Text></TouchableOpacity>
      </View></View>
    </Modal>}
    {working && job.payload && <View pointerEvents="none" style={styles.worker} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <VideoExportWorker key={job.id} payload={job.payload} destination={job.destination}
      options={{ signal: job.controller.signal, onProgress: progress => reportVideoExport(job.id, progress) }}
      onComplete={() => completeVideoExport(job.id)} onError={error => failVideoExport(job.id, error)} />
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  // Reserve space below the navigator so progress never covers navigation or scrolling.
  root: { flexShrink: 0, paddingTop: 8, paddingHorizontal: 12, backgroundColor: '#fff5f8' },
  worker: { position: 'absolute', width: 1, height: 1, bottom: 0, right: 0, overflow: 'hidden' },
  banner: { width: '100%', maxWidth: 440, alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, backgroundColor: '#fff5f8', borderWidth: 1, borderColor: '#efb3c3', borderRadius: 12, elevation: 5 },
  texts: { flex: 1, minWidth: 0 }, title: { fontSize: 13, fontWeight: '700', color: '#243044' },
  status: { fontSize: 12, lineHeight: 18, marginTop: 3, color: '#67717d' }, error: { color: '#a33a54' },
  track: { height: 4, marginTop: 6, borderRadius: 2, overflow: 'hidden', backgroundColor: '#f0dce3' }, fill: { height: '100%', backgroundColor: '#dc7394' },
  button: { padding: 8 }, buttonText: { color: '#87616e', fontWeight: '600', fontSize: 13 }, disabled: { opacity: 0.4 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#18202b88' },
  queueCard: { width: 440, maxWidth: '100%', maxHeight: '80%', padding: 18, borderRadius: 16, backgroundColor: '#fff' },
  queueList: { flexGrow: 0, marginTop: 12 }, queueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0e6eb' },
  queueClose: { alignSelf: 'flex-end', padding: 10, marginTop: 8 },
});
