import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { getGeminiKey, getRememberApiKey, setGeminiKey, subscribeGeminiKey } from '@/services/geminiKey';
import { useI18n } from '@/i18n';

export default function GeminiKeyField({ onFocus }: { onFocus?: () => void }) {
  const { t } = useI18n();
  const stored = useSyncExternalStore(subscribeGeminiKey, getGeminiKey, () => '');
  const storedRemember = useSyncExternalStore(subscribeGeminiKey, getRememberApiKey, () => false);
  const [value, setValue] = useState(stored);
  const [remember, setRemember] = useState(storedRemember);
  const [touched, setTouched] = useState(false);
  const dirty = value.trim() !== stored || remember !== storedRemember;

  useEffect(() => {
    if (touched) return;
    setValue(stored);
    setRemember(storedRemember);
  }, [stored, storedRemember, touched]);

  const save = () => {
    const next = value.trim();
    setGeminiKey(next, remember);
    setTouched(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('apiKey')}</Text>
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
