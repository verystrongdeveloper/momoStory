import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { getSetting, saveSetting, subscribeStorage } from '@/storage';
import { useI18n } from '@/i18n';
import { clearNotifications, notificationsAllowed, notificationsSupported, openNotificationSettings, requestNotifications, showNotification } from '@/platform/notifications';

export default function NotificationSettings() {
  const { t } = useI18n();
  const enabled = useSyncExternalStore(subscribeStorage, () => getSetting('notificationsEnabled'));
  const chat = useSyncExternalStore(subscribeStorage, () => getSetting('chatNotifications'));
  const story = useSyncExternalStore(subscribeStorage, () => getSetting('storyNotifications'));
  const video = useSyncExternalStore(subscribeStorage, () => getSetting('exportNotifications'));
  const preview = useSyncExternalStore(subscribeStorage, () => getSetting('notificationPreview'));
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const supported = notificationsSupported();
  useEffect(() => {
    let active = true;
    const refresh = () => { void notificationsAllowed().then(value => { if (active) setAllowed(value); }).catch(() => { if (active) setAllowed(false); }); };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; subscription.remove(); };
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setNotice('');
    try { await action(); } catch { setNotice('notificationError'); } finally { setBusy(false); }
  };
  return <View style={styles.card}>
    <Text style={styles.title}>{t('notifications')}</Text>
    {!supported ? <Text style={styles.hint}>{t('notificationUnsupported')}</Text> : <>
      <View style={styles.row}><Text style={styles.label}>{t('notificationsEnabled')}</Text><Switch accessibilityLabel={t('notificationsEnabled')} value={enabled} disabled={busy} onValueChange={value => void run(async () => {
        if (!value) { saveSetting('notificationsEnabled', false); await clearNotifications(); return; }
        const granted = await requestNotifications(); setAllowed(granted);
        saveSetting('notificationsEnabled', granted);
        if (!granted) setNotice('notificationDenied');
      })} /></View>
      {([['chatNotifications', chat], ['storyNotifications', story], ['exportNotifications', video], ['notificationPreview', preview]] as const).map(([key, value]) => <View key={key} style={styles.row}>
        <Text style={styles.label}>{t(key)}</Text><Switch accessibilityLabel={t(key)} value={value} disabled={!enabled || busy} onValueChange={next => { saveSetting(key, next); void clearNotifications().catch(() => {}); }} />
      </View>)}
      <Text style={styles.hint}>{t('notificationHint')}</Text>
      {enabled && !allowed && <Text style={styles.hint}>{t('notificationDenied')}</Text>}
      <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => void run(openNotificationSettings)}><Text>{t('notificationSystem')}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={!enabled || !allowed || busy} style={[styles.button, (!enabled || !allowed || busy) && styles.disabled]} onPress={() => void run(async () => {
        const sent = await showNotification('test', t('notifications'), t('notificationTestTitle'), t('notificationTestBody'));
        setNotice(sent ? 'notificationTestSent' : 'notificationDenied');
      })}><Text>{t('notificationTest')}</Text></TouchableOpacity>
      {!!notice && <Text accessibilityLiveRegion="polite" style={styles.hint}>{t(notice)}</Text>}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 18, gap: 12, backgroundColor: '#fff', borderRadius: 14 },
  title: { fontSize: 17, fontWeight: '700', color: '#243044' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, label: { flex: 1, color: '#3a4150' },
  hint: { fontSize: 13, lineHeight: 20, color: '#67717d' },
  button: { padding: 12, borderRadius: 10, backgroundColor: '#f2f4f7' }, disabled: { opacity: 0.4 },
});
