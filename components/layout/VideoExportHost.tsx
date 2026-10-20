import React, { useSyncExternalStore } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/i18n';
import VideoExportWorker from '@/platform/VideoExportWorker';
import { cancelVideoExport, completeVideoExport, dismissVideoExport, failVideoExport, getVideoExportJob, reportVideoExport, subscribeVideoExportJob } from '@/store/videoExportJob';

export default function VideoExportHost() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const job = useSyncExternalStore(subscribeVideoExportJob, getVideoExportJob, () => null);
  if (!job || job.status === 'picking') return null;
  const working = job.status === 'working';
  const saving = working && job.progress.phase === 'saving';
  const label = working ? `${t(job.progress.phase === 'preparing' ? 'videoPreparing' : saving ? 'videoSaving' : 'videoEncoding')} ${Math.floor(job.progress.progress * 100)}%`
    : t(job.status === 'error' ? job.error : job.status === 'canceled' ? 'videoExportCanceled'
      : Platform.OS === 'android' ? 'videoSavedDownloads' : job.destination?.kind === 'save-as' ? 'videoSavedFile' : 'videoDownloadStarted');
  return <View pointerEvents="box-none" style={styles.root}>
    <View style={[styles.banner, { top: insets.top + 64 }]}>
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>{job.title}</Text>
        <Text style={[styles.status, job.status === 'error' && styles.error]} accessibilityLiveRegion="polite">{label}</Text>
        {working && <View style={styles.track}><View style={[styles.fill, { width: `${job.progress.progress * 100}%` }]} /></View>}
      </View>
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => working ? cancelVideoExport(job.id) : dismissVideoExport()} style={[styles.button, saving && styles.disabled]}>
        <Text style={styles.buttonText}>{t(working ? 'cancel' : 'close')}</Text>
      </TouchableOpacity>
    </View>
    {working && job.payload && <VideoExportWorker key={job.id} payload={job.payload} destination={job.destination}
      options={{ signal: job.controller.signal, onProgress: progress => reportVideoExport(job.id, progress) }}
      onComplete={() => completeVideoExport(job.id)} onError={error => failVideoExport(job.id, error)} />}
  </View>;
}
const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 40 },
  banner: { position: 'absolute', right: 12, left: 12, maxWidth: 440, alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, backgroundColor: '#fff5f8', borderWidth: 1, borderColor: '#efb3c3', borderRadius: 12, elevation: 5 },
  texts: { flex: 1, minWidth: 0 }, title: { fontSize: 13, fontWeight: '700', color: '#243044' },
  status: { fontSize: 12, lineHeight: 18, marginTop: 3, color: '#67717d' }, error: { color: '#a33a54' },
  track: { height: 4, marginTop: 6, borderRadius: 2, overflow: 'hidden', backgroundColor: '#f0dce3' }, fill: { height: '100%', backgroundColor: '#dc7394' },
  button: { padding: 8 }, buttonText: { color: '#87616e', fontWeight: '600', fontSize: 13 }, disabled: { opacity: 0.4 },
});
