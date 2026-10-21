import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CHARACTERS, displayCharacterName } from '@/constants/characters';
import { useI18n } from '@/i18n';

export default function CharacterFilter({ value, onChange, characters = [] }: { value: string; onChange: (value: string) => void; characters?: string[] }) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const options = ['', ...new Set([...CHARACTERS.map(character => character.name), ...characters].filter(Boolean))];
  const label = (character: string) => character ? displayCharacterName(character, language) : t('characterFilterAll');
  return <View style={styles.root}>
    <Text style={styles.label}>{t('characterFilter')}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('characterFilter')} accessibilityState={{ expanded: open }}
      style={styles.choice} onPress={() => setOpen(true)}>
      <Text style={[styles.text, styles.choiceLabel]} numberOfLines={1} ellipsizeMode="tail">{label(value)}</Text><Text style={styles.text}>▾</Text>
    </TouchableOpacity>
    {open && <Modal transparent visible animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={t('close')} onPress={() => setOpen(false)} />
        <View style={styles.menu}>
          <Text style={styles.heading}>{t('characterFilter')}</Text>
          <ScrollView accessibilityRole="radiogroup" accessibilityLabel={t('characterFilter')} keyboardShouldPersistTaps="handled">
            {options.map(character => <TouchableOpacity key={character} accessibilityRole="radio" accessibilityLabel={label(character)} accessibilityState={{ checked: value === character }}
              style={[styles.option, value === character && styles.selected]} onPress={() => { onChange(character); setOpen(false); }}>
              <Text style={styles.text}>{label(character)}</Text>{value === character && <Text style={styles.text}>✓</Text>}
            </TouchableOpacity>)}
          </ScrollView>
          <TouchableOpacity accessibilityRole="button" style={styles.close} onPress={() => setOpen(false)}><Text style={styles.text}>{t('close')}</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>}
  </View>;
}
const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }, label: { fontSize: 13, fontWeight: '600', color: '#67717d', flexShrink: 1 },
  choice: { flex: 1, minWidth: 0, maxWidth: 220, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#d6e0e8', borderRadius: 10, backgroundColor: '#f8fafc' },
  choiceLabel: { flex: 1 }, text: { fontSize: 13, fontWeight: '600', color: '#3d6288' },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#18202b66' },
  menu: { width: 340, maxWidth: '100%', maxHeight: '80%', padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  heading: { fontSize: 16, fontWeight: '700', color: '#243e5c', marginBottom: 12 },
  option: { minHeight: 44, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selected: { backgroundColor: '#e7f1fa' }, close: { alignSelf: 'flex-end', padding: 10, marginTop: 8 },
});
