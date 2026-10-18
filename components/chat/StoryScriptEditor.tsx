import React, { useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useI18n } from '@/i18n';
import { ScriptIssues, useScriptDiagnostics, type ScriptEditorProps } from './scriptEditorShared';

/** Native input keeps OS/IME editing intact; diagnostics select the offending range. */
export default function StoryScriptEditor({ value, onChangeText, onSelectionChange, style }: ScriptEditorProps) {
  const { t } = useI18n();
  const input = useRef<TextInput>(null);
  const { issues, pending } = useScriptDiagnostics(value);
  return <View style={[styles.root, style]}>
    <TextInput ref={input} accessibilityLabel={t('editStory')} style={[styles.input, !!issues.length && styles.invalid]} value={value} onChangeText={onChangeText}
      onSelectionChange={event => onSelectionChange(event.nativeEvent.selection)} multiline textAlignVertical="top" autoCapitalize="none" autoCorrect={false} spellCheck={false} />
    <ScriptIssues value={value} issues={issues} pending={pending} onSelect={issue => {
      input.current?.focus();
      input.current?.setNativeProps({ selection: { start: issue.start, end: issue.end } });
      onSelectionChange({ start: issue.start, end: issue.end });
    }} />
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, minWidth: 0, minHeight: 0 }, input: { flex: 1, minHeight: 120, padding: 16, borderWidth: 1, borderColor: '#e2e6ea', borderRadius: 12, backgroundColor: 'white', fontSize: 15, lineHeight: 22, color: '#222' }, invalid: { borderColor: '#d44b60' } });
