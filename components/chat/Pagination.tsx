import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/i18n';

export const PAGE_SIZE = 20;

export default function Pagination({ page, totalPages, disabled = false, onChange }: {
  page: number; totalPages: number; disabled?: boolean; onChange: (page: number) => void;
}) {
  const { t } = useI18n();
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
  return <View style={styles.container}>
    <View style={styles.row}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('paginationPrevious')} accessibilityState={{ disabled: disabled || page <= 1 }} disabled={disabled || page <= 1} onPress={() => onChange(page - 1)} style={[styles.button, (disabled || page <= 1) && styles.disabled]}>
        <Ionicons name="chevron-back" size={20} color="#87616e" />
      </TouchableOpacity>
      {pages.map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={t('paginationPage', { page: value })} accessibilityState={{ selected: value === page, disabled }} disabled={disabled} onPress={() => onChange(value)} style={[styles.button, value === page && styles.selected, disabled && styles.disabled]}>
        <Text style={[styles.text, value === page && styles.selectedText]}>{value}</Text>
      </TouchableOpacity>)}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('paginationNext')} accessibilityState={{ disabled: disabled || page >= totalPages }} disabled={disabled || page >= totalPages} onPress={() => onChange(page + 1)} style={[styles.button, (disabled || page >= totalPages) && styles.disabled]}>
        <Ionicons name="chevron-forward" size={20} color="#87616e" />
      </TouchableOpacity>
    </View>
    <Text style={styles.text}>{page} / {totalPages}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  row: { flexDirection: 'row', gap: 4 },
  button: { minWidth: 36, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: '#f9d6e2' },
  text: { fontSize: 13, color: '#87616e' },
  selectedText: { fontWeight: '700', color: '#af4d6c' },
  disabled: { opacity: 0.4 },
});
