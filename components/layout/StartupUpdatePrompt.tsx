import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import appConfig from '../../app.json';
import { useI18n } from '@/i18n';
import { getSetting, isStorageSynced, subscribeStorage } from '@/storage';
import { checkAppUpdate, type UpdateResult } from '@/services/appUpdate';

const onboardingComplete = () => isStorageSynced() && getSetting('termsAccepted') && getSetting('tutorialSeen');

/** Mounted in the root layout so navigating between screens never repeats the prompt. */
export default function StartupUpdatePrompt() {
  const { t } = useI18n();
  const ready = useSyncExternalStore(subscribeStorage, onboardingComplete, () => false);
  const [release, setRelease] = useState<UpdateResult | null>(null);
  const [opening, setOpening] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const openingRef = useRef(false);
  const appVersion = Platform.OS === 'web'
    ? appConfig.expo.version
    : Constants.expoConfig?.version ?? appConfig.expo.version;

  useEffect(() => {
    const request = new AbortController();
    void checkAppUpdate(appVersion, request.signal).then(result => {
      if (!request.signal.aborted && result.available) setRelease(result);
    }).catch(() => {
      // Startup checks stay silent offline, on timeout, or when GitHub is unavailable.
      // Settings still provides a manual check with error feedback.
    });
    return () => request.abort();
  }, [appVersion]);

  const dismiss = () => { if (!openingRef.current) setRelease(null); };
  const openDownload = async () => {
    if (!release || openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setLinkError(false);
    try {
      await Linking.openURL(release.url);
      setRelease(null);
    } catch {
      setLinkError(true);
    } finally {
      openingRef.current = false;
      setOpening(false);
    }
  };

  // Allow first-run language selection, consent, and the tutorial to finish first.
  if (!ready || !release) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">{t('updateTitle')}</Text>
          <Text style={styles.body}>{t('updateAvailable', { version: release.version })}</Text>
          <Text style={styles.version}>{t('appVersion')}: {appVersion}</Text>
          {linkError && <Text selectable style={styles.error} accessibilityRole="alert">{t('updateOpenFailed')} {release.url}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity accessibilityRole="button" disabled={opening} style={styles.button} onPress={dismiss}>
              <Text style={styles.later}>{t('updateLater')}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="link" disabled={opening} style={[styles.button, styles.primary, opening && styles.disabled]} onPress={() => void openDownload()}>
              <Text style={styles.primaryText}>{t('openUpdateDownload')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(36,32,40,0.45)' },
  card: { width: '100%', maxWidth: 440, padding: 24, borderRadius: 18, backgroundColor: '#fff', gap: 14 },
  title: { fontSize: 20, fontWeight: '700', color: '#243044' },
  body: { fontSize: 16, lineHeight: 24, color: '#3c4654' },
  version: { fontSize: 13, color: '#667085' },
  error: { color: '#a33a54', lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  button: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  primary: { backgroundColor: '#FB94A7' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  later: { color: '#6d5360', fontSize: 14 },
  disabled: { opacity: 0.5 },
});
