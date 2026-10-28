import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/i18n';
import { getGeminiKey, subscribeGeminiKey } from '@/services/geminiKey';
import { getGeminiModel, setGeminiModel, subscribeGeminiModel } from '@/services/geminiModel';
import { listGeminiModels, type GeminiModel } from '@/shared/geminiModels';
import { listProviderModels, parseSelection, qualifyModel } from '../../shared/aiProviders';

export default function GeminiModelPicker() {
  const { t } = useI18n();
  const selection = useSyncExternalStore(subscribeGeminiModel, getGeminiModel, () => 'auto');
  const { provider, model: selected } = parseSelection(selection);
  const apiKey = useSyncExternalStore(subscribeGeminiKey, getGeminiKey, () => '');
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<(GeminiModel & { free?: boolean })[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setModels([]); setFailed(false); setLoading(!!apiKey);
    const controller = new AbortController();
    if (apiKey) void (provider === 'gemini' ? listGeminiModels(apiKey, refresh > 0) : listProviderModels(provider, apiKey, controller.signal)).then(rows => {
      if (alive) setModels(rows);
    }).catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; controller.abort(); };
  }, [open, apiKey, refresh, provider]);
  const isFree = (id: string, free?: boolean) => provider === 'openrouter' && (free === true || id === 'auto' || id === 'openrouter/free' || id.endsWith(':free'));
  const autoLabel = t(provider === 'venice' ? 'aiSelectModel' : 'geminiModelAuto');
  const label = selected === 'auto' ? autoLabel : selected;
  const selectedFree = isFree(selected, models.find(model => model.id === selected)?.free);
  const options: (GeminiModel & { free?: boolean })[] = [...(provider === 'venice' ? [] : [{ id: 'auto', label: autoLabel }]), ...models];
  if (selected !== 'auto' && !models.some(model => model.id === selected)) options.push({ id: selected, label: selected });
  return <View style={styles.root}>
    <Text style={styles.heading}>{t('aiModel')}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('aiModel')} accessibilityState={{ expanded: open }} style={styles.choice} onPress={() => { setRefresh(0); setOpen(true); }}>
      <Text style={[styles.text, styles.grow]} numberOfLines={1}>{label}</Text>{selectedFree && <Text style={styles.freeBadge}>{t('aiFree')}</Text>}<Text style={styles.text}>▾</Text>
    </TouchableOpacity>
    <Text style={styles.hint}>{t(provider === 'openrouter' ? 'aiOpenRouterHint' : provider === 'venice' ? 'aiVeniceHint' : selected === 'auto' ? 'geminiModelAutoHint' : 'geminiModelManualHint')}</Text>
    {open && <Modal transparent visible animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={t('close')} onPress={() => setOpen(false)} />
        <View style={styles.menu}>
          <View style={styles.row}>
            <Text style={[styles.heading, styles.grow]}>{t('aiModel')}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('geminiModelRefresh')} accessibilityState={{ disabled: loading || !apiKey }} disabled={loading || !apiKey} style={styles.refresh} onPress={() => setRefresh(value => value + 1)}>
              <Ionicons name="refresh-outline" size={22} color="#87616e" />
            </TouchableOpacity>
          </View>
          {loading && <ActivityIndicator color="#dc7896" accessibilityLabel={t('geminiModelLoading')} />}
          {!apiKey && <Text style={styles.hint}>{t('geminiModelKeyRequired')}</Text>}
          {failed && <Text accessibilityRole="alert" style={styles.error}>{t('geminiModelFailed')}</Text>}
          {!loading && !failed && !!apiKey && !models.length && <Text style={styles.hint}>{t('geminiModelEmpty')}</Text>}
          <ScrollView accessibilityRole="radiogroup" accessibilityLabel={t('aiModel')} keyboardShouldPersistTaps="handled">
            {options.map(model => <TouchableOpacity key={model.id} accessibilityRole="radio" accessibilityLabel={`${model.label}${isFree(model.id, model.free) ? ` · ${t('aiFree')}` : ''}`} accessibilityState={{ checked: model.id === selected }} style={[styles.option, model.id === selected && styles.selected]} onPress={() => { setGeminiModel(qualifyModel(provider, model.id)); setOpen(false); }}>
              <View style={styles.grow}><Text style={styles.text}>{model.label}</Text>{model.id !== 'auto' && model.label !== model.id && <Text style={styles.hint}>{model.id}</Text>}</View>
              {isFree(model.id, model.free) && <Text style={styles.freeBadge}>{t('aiFree')}</Text>}
              {model.id === selected && <Text style={styles.text}>✓</Text>}
            </TouchableOpacity>)}
          </ScrollView>
          <TouchableOpacity accessibilityRole="button" style={styles.close} onPress={() => setOpen(false)}><Text style={styles.text}>{t('close')}</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>}
  </View>;
}
const styles = StyleSheet.create({
  root: { marginTop: 16, gap: 8 }, heading: { fontSize: 14, fontWeight: '700', color: '#243e5c' },
  choice: { minHeight: 44, maxWidth: 440, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#d6e0e8', borderRadius: 10, backgroundColor: '#f8fafc' },
  text: { fontSize: 13, color: '#3d6288', fontWeight: '600' }, hint: { fontSize: 12, color: '#758297', lineHeight: 18 },
  grow: { flex: 1, minWidth: 0 }, row: { flexDirection: 'row', alignItems: 'center' }, refresh: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#18202b66' },
  menu: { width: 440, maxWidth: '100%', maxHeight: '80%', padding: 16, gap: 8, borderRadius: 16, backgroundColor: '#fff' },
  option: { minHeight: 48, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, selected: { backgroundColor: '#e7f1fa' },
  error: { fontSize: 12, color: '#a33a54' }, close: { alignSelf: 'flex-end', padding: 10 },
  freeBadge: { overflow: 'hidden', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#def5e7', color: '#226540', fontSize: 12, fontWeight: '700' },
});
