import React, { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '@/i18n';
import { community, communityConfigured, communityErrorKey } from '@/services/community/client';
import type { StoryRecord } from '@/storage/types';

export default function PublishStoryModal({ story, onClose }: { story: StoryRecord; onClose: () => void }) {
  const { t } = useI18n();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState(false);
  const pending = useRef(false);
  const publish = async () => {
    if (pending.current || !consent) return;
    pending.current = true; setBusy(true); setNotice('');
    try {
      const result = await community.publish(story);
      setDone(true); setNotice(t(result.alreadyPublished ? 'communityAlreadyPublished' : 'communityPublished'));
    } catch (error) {
      let message = t(communityErrorKey(error));
      if (error && typeof error === 'object' && 'line' in error && typeof error.line === 'number') message += ` (${t('communityLine', { line: error.line })})`;
      setNotice(message);
    } finally { pending.current = false; setBusy(false); }
  };
  return <Modal transparent animationType="fade" onRequestClose={() => { if (!pending.current) onClose(); }}>
    <View style={styles.overlay}><ScrollView style={styles.card} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('communityPublish')}</Text>
      <Text style={styles.story}>{story.title}</Text>
      <Text style={styles.text}>{t('communityPublishNotice')}</Text>
      <Text style={styles.text}>{t('communityLimits')}</Text>
      <Text style={styles.text}>{t('communityPrivacy')}</Text>
      {!communityConfigured() && <Text style={styles.notice}>{t('communitySetup')}</Text>}
      {!done && <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: consent }} disabled={busy} onPress={() => setConsent(value => !value)} style={styles.consent}><Text>{consent ? '☑' : '☐'} {t('communityConsent')}</Text></TouchableOpacity>}
      {!!notice && <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
      <View style={styles.actions}>
        <TouchableOpacity disabled={busy} onPress={onClose} style={styles.button}><Text>{t(done ? 'close' : 'cancel')}</Text></TouchableOpacity>
        {!done && <TouchableOpacity disabled={busy || !consent || !communityConfigured()} onPress={() => void publish()} style={[styles.button, styles.primary, (!consent || busy || !communityConfigured()) && styles.disabled]}><Text style={styles.white}>{t(busy ? 'communityBusy' : 'communityPublish')}</Text></TouchableOpacity>}
      </View>
    </ScrollView></View>
  </Modal>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,.45)' }, card: { flexGrow: 0, maxHeight: '90%', width: '100%', maxWidth: 480, borderRadius: 18, backgroundColor: 'white' }, content: { padding: 24, gap: 14 }, title: { fontWeight: '700', fontSize: 22, color: '#243044' }, story: { color: '#486080', fontWeight: '600' }, text: { color: '#667085', lineHeight: 22 }, notice: { color: '#a33a54', lineHeight: 22 }, consent: { paddingVertical: 12 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }, button: { padding: 12, borderRadius: 10, backgroundColor: '#f0f2f6' }, primary: { backgroundColor: '#f18bad' }, white: { color: 'white', fontWeight: '700' }, disabled: { opacity: 0.45 } });
