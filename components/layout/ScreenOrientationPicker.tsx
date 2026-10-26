import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '@/i18n';
import { setScreenOrientation, useScreenOrientation } from '@/services/screenOrientation';

export default function ScreenOrientationPicker() {
  const { t } = useI18n();
  const orientation = useScreenOrientation();
  // Browser windows follow browser/OS policy rather than native stack locks.
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('screenOrientation')}</Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {(['portrait', 'landscape'] as const).map(mode => (
          <TouchableOpacity
            key={mode}
            accessibilityRole="radio"
            accessibilityState={{ checked: orientation === mode }}
            style={[styles.option, orientation === mode && styles.selected]}
            onPress={() => setScreenOrientation(mode)}
          >
            <Text style={[styles.optionText, orientation === mode && styles.selectedText]}>
              {t(mode === 'portrait' ? 'screenPortrait' : 'screenLandscape')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>{t('screenOrientationHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'flex-start', width: 420, maxWidth: '100%', padding: 20, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eceff3', marginBottom: 16 },
  label: { fontSize: 15, fontWeight: '700', color: '#243e5c' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  option: { borderRadius: 10, borderWidth: 1, borderColor: '#d6e0e8', backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingVertical: 10 },
  selected: { borderColor: '#4d8ec9', backgroundColor: '#e7f1fa' },
  optionText: { color: '#56708b', fontSize: 14, fontWeight: '700' },
  selectedText: { color: '#2d6ea8' },
  hint: { marginTop: 14, fontSize: 13, color: '#6a8298' },
});
