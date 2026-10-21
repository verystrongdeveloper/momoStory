import React, { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getGreetMode, setGreetMode, subscribeGreetMode } from '@/services/greetMode';
import { useI18n } from '@/i18n';

export default function GreetModeToggle() {
  const { t } = useI18n();
  const on = useSyncExternalStore(subscribeGreetMode, getGreetMode, () => false);

  const toggle = (next: boolean) => {
    setGreetMode(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>{t('greetFirst')}</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('greetFirst')}
          accessibilityState={{ checked: on }}
          hitSlop={8}
          onPress={() => toggle(!on)}
          style={[styles.toggle, on && styles.toggleOn]}
        ><View pointerEvents="none" style={[styles.thumb, on && styles.thumbOn]} /></Pressable>
      </View>
      <Text style={styles.hint}>{on ? t('greetOn') : t('greetOff')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e6ea',
    backgroundColor: '#f4f7f8',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flexShrink: 1,
    marginRight: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  toggle: {
    flexShrink: 0,
    width: 48,
    height: 28,
    padding: 3,
    borderRadius: 14,
    backgroundColor: '#aab4c0',
  },
  toggleOn: { backgroundColor: '#ef8fab' },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: 'flex-start' },
  thumbOn: { alignSelf: 'flex-end' },
  hint: {
    marginTop: 2,
    fontSize: 12,
    color: '#777',
  },
});
