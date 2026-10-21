import React, { useSyncExternalStore } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '@/i18n';
import { getSenseiMode, setSenseiMode, subscribeSenseiMode } from '@/services/senseiMode';

export default function SenseiModePicker() {
  const { t } = useI18n();
  const selected = useSyncExternalStore(subscribeSenseiMode, getSenseiMode, () => 'mild');
  return <View style={styles.card}>
    <Text style={styles.heading}>{t('senseiMode')}</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel={t('senseiMode')} style={styles.options}>
      {(['mild', 'spicy'] as const).map(mode => <TouchableOpacity key={mode}
        accessibilityRole="radio" accessibilityLabel={t(mode === 'mild' ? 'senseiModeMild' : 'senseiModeSpicy')}
        accessibilityState={{ checked: selected === mode }} onPress={() => setSenseiMode(mode)}
        style={[styles.option, selected === mode && styles.active]}>
        <Text style={styles.label}>{t(mode === 'mild' ? 'senseiModeMild' : 'senseiModeSpicy')}{selected === mode ? ' ✓' : ''}</Text>
        <Text style={styles.hint}>{t(mode === 'mild' ? 'senseiModeMildHint' : 'senseiModeSpicyHint')}</Text>
      </TouchableOpacity>)}
    </View>
    <Text style={styles.hint}>{t('senseiModeHint')}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { alignSelf: 'flex-start', width: 420, maxWidth: '100%', padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#eceff3', borderRadius: 16, backgroundColor: '#fff', gap: 12 },
  heading: { fontSize: 16, fontWeight: '700', color: '#42343c' },
  options: { gap: 8 },
  option: { padding: 12, borderWidth: 1, borderColor: '#eadfe4', borderRadius: 10, gap: 6 },
  active: { borderColor: '#dc7896', backgroundColor: '#fff1f6' },
  label: { fontSize: 15, fontWeight: '600', color: '#42343c' },
  hint: { fontSize: 13, lineHeight: 20, color: '#73636d' },
});
