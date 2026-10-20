import React, { useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '@/i18n';
import type { UpdateResult } from '@/services/appUpdate';
import { supportsInAppUpdate } from '@/platform/inAppUpdate';
import { appUpdateBusy, beginAppUpdate, getAppUpdateJob, installAppUpdate, subscribeAppUpdateJob } from '@/store/appUpdateJob';

/** Shared by startup and settings; the actual job survives navigation. */
export default function InAppUpdate({ release }: { release: UpdateResult }) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(false);
  const job = useSyncExternalStore(subscribeAppUpdateJob, getAppUpdateJob, getAppUpdateJob);
  if (!supportsInAppUpdate()) return null;
  const same = job.version === release.version;
  const ready = same && ['ready', 'permission', 'opened'].includes(job.status);
  const busy = appUpdateBusy();
  return <View style={styles.container}>
    <Text style={styles.hint}>{t('inAppUpdateNotice')}</Text>
    {same && job.status === 'downloading' && <Text accessibilityLiveRegion="polite">{t('inAppUpdateDownloading')}{job.progress == null ? '…' : ` ${Math.floor(job.progress * 100)}%`}</Text>}
    {same && job.status === 'installing' && <Text accessibilityLiveRegion="polite">{t('inAppUpdateInstalling')}</Text>}
    {same && job.status === 'permission' && <Text accessibilityRole="alert">{t('inAppUpdatePermission')}</Text>}
    {same && job.status === 'opened' && <Text>{t('inAppUpdateOpened')}</Text>}
    {same && job.status === 'error' && <Text accessibilityRole="alert">{t('inAppUpdateFailed')}</Text>}
    {((confirm && !busy) || ready) && <Text>{t('inAppUpdateConfirm')}</Text>}
    <TouchableOpacity accessibilityRole="button" disabled={busy} style={[styles.button, busy && { opacity: 0.5 }]}
      onPress={() => { if (ready) void installAppUpdate(); else if (!confirm) setConfirm(true); else void beginAppUpdate(release); }}>
      <Text style={styles.label}>{t(ready ? 'inAppUpdateInstall' : confirm ? 'inAppUpdateDownload' : 'inAppUpdateStart')}</Text>
    </TouchableOpacity>
  </View>;
}
const styles = StyleSheet.create({ container: { gap: 10, marginVertical: 8 }, hint: { color: '#667085', lineHeight: 21 }, button: { alignSelf: 'flex-start', backgroundColor: '#FB94A7', padding: 12, borderRadius: 10 }, label: { color: '#fff', fontWeight: '700' } });
