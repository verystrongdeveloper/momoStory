import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getGeminiKey, getRememberApiKey, setGeminiKey, subscribeGeminiKey } from '@/services/geminiKey';
import { useI18n } from '@/i18n';
import { getGeminiModel, setGeminiModel, subscribeGeminiModel } from '@/services/geminiModel';
import { parseSelection, providers, qualifyModel } from '../../shared/aiProviders';

export default function GeminiKeyField({ onFocus }: { onFocus?: () => void }) {
  const { t } = useI18n();
  const selection = useSyncExternalStore(subscribeGeminiModel, getGeminiModel, () => 'auto');
  const { provider } = parseSelection(selection);
  const stored = useSyncExternalStore(subscribeGeminiKey, getGeminiKey, () => '');
  const storedRemember = useSyncExternalStore(subscribeGeminiKey, getRememberApiKey, () => false);
  const [value, setValue] = useState(stored);
  const [remember, setRemember] = useState(storedRemember);
  const [touched, setTouched] = useState(false);
  const dirty = value.trim() !== stored || remember !== storedRemember;
  const previousProvider = useRef(provider);

  useEffect(() => {
    if (touched && previousProvider.current === provider) return;
    previousProvider.current = provider;
    setValue(stored);
    setRemember(storedRemember);
    setTouched(false);
  }, [provider, stored, storedRemember, touched]);

  const save = () => {
    const next = value.trim();
    setGeminiKey(next, remember);
    setTouched(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('aiProvider')}</Text>
      <View accessibilityRole="radiogroup" style={styles.providers}>
        {providers.map(id => <TouchableOpacity key={id} accessibilityRole="radio" accessibilityState={{ checked: provider === id }} style={[styles.provider, provider === id && styles.selectedProvider]} onPress={() => { if (provider !== id) setGeminiModel(qualifyModel(id, 'auto')); }}>
          <Text style={styles.label}>{id === 'openrouter' ? 'OpenRouter' : id === 'venice' ? 'Venice' : 'Gemini'}</Text>
        </TouchableOpacity>)}
      </View>
      <Text style={styles.hint}>{t('aiProviderHint')}</Text>
      <Text style={styles.label}>{provider === 'gemini' ? 'Gemini' : provider === 'openrouter' ? 'OpenRouter' : 'Venice'} · {t('apiKey').replace(/^Gemini\s*/, '')}</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(next) => {
            setTouched(true);
            setValue(next);
          }}
          placeholder={t('apiKeyPlaceholder')}
          placeholderTextColor="#777"
          selectionColor="#d85b76"
          cursorColor="#d85b76"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={onFocus}
          onSubmitEditing={save}
        />
        <Button title={t('save')} onPress={save} disabled={!dirty} />
      </View>
      <View style={styles.rememberRow}>
        <Text style={styles.hint}>{t('rememberKey')}</Text>
        <Switch
          value={remember}
          onValueChange={(next) => {
            setTouched(true);
            setRemember(next);
          }}
        />
      </View>
      <Text style={styles.hint}>
        {stored && remember
          ? t('keySaved')
          : stored
            ? t('keySession')
            : t('keyRequired')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  providers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  provider: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d6e0e8' },
  selectedProvider: { backgroundColor: '#e7f1fa', borderColor: '#3d6288' },
  wrap: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e6ea',
    backgroundColor: '#f4f7f8',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#fff',
    color: '#222',
    fontSize: 14,
  },
  rememberRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    color: '#777',
  },
});
