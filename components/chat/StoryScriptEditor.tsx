import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useI18n } from '@/i18n';
import { ScriptIssues, useScriptDiagnostics, type ScriptEditorProps } from './scriptEditorShared';

/** Native input keeps OS/IME editing intact; diagnostics select the offending range. */
export default function StoryScriptEditor({ value, onChangeText, onSelectionChange, style, compact, keyboardVisible, onFocus, onBlur }: ScriptEditorProps) {
  const { t } = useI18n();
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const [browsing, setBrowsing] = useState(false);
  const [target, setTarget] = useState<{ start: number; end: number } | null>(null);
  const scrollY = useRef(0);
  const focused = useRef(false);
  const selection = useRef({ start: 0, end: 0 });
  const { issues, pending } = useScriptDiagnostics(value);
  const editRange = (range: { start: number; end: number }) => {
    setBrowsing(false);
    setTarget(range);
    selection.current = range;
    onSelectionChange(range);
  };
  useEffect(() => {
    if (browsing || !target) return;
    input.current?.focus();
    input.current?.setNativeProps({ selection: target });
    setTarget(null);
  }, [browsing, target]);
  let offset = 0;
  return <View style={[styles.root, style]}>
    <View style={styles.toolbar}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: browsing }} style={[styles.button, browsing && styles.active]} onPress={() => { Keyboard.dismiss(); onBlur?.(); setBrowsing(!browsing); }}>
        <Text style={styles.buttonText}>{t(browsing ? 'scriptResumeEditing' : 'scriptScrollMode')}</Text>
      </TouchableOpacity>
      {keyboardVisible && !browsing && <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('scriptHideKeyboard')} style={styles.button} onPress={() => Keyboard.dismiss()}><Text style={styles.buttonText}>{t('scriptHideKeyboard')}</Text></TouchableOpacity>}
      {browsing && <>
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => scroll.current?.scrollTo({ y: 0, animated: true })}><Text style={styles.buttonText}>{t('scriptScrollTop')}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => scroll.current?.scrollToEnd({ animated: true })}><Text style={styles.buttonText}>{t('scriptScrollBottom')}</Text></TouchableOpacity>
      </>}
    </View>
    {browsing ? <>
      <Text style={styles.hint}>{t('scriptScrollHint')}</Text>
      <ScrollView ref={scroll} style={[styles.reader, !!issues.length && styles.invalid]} contentContainerStyle={styles.readerContent}
        contentOffset={{ x: 0, y: scrollY.current }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" nestedScrollEnabled showsVerticalScrollIndicator
        onScroll={event => { scrollY.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}>
        {value.split('\n').map((line, index) => {
          const start = offset;
          offset += line.length + 1;
          return <Text key={index} accessibilityRole="button" accessibilityLabel={t('scriptEditLine', { line: index + 1 })} style={styles.readerLine} onPress={() => editRange({ start, end: start })}>{line || ' '}</Text>;
        })}
      </ScrollView>
    </> : <TextInput ref={input} accessibilityLabel={t('editStory')} style={[styles.input, !!issues.length && styles.invalid]} value={value} onChangeText={onChangeText}
      onFocus={() => { focused.current = true; onFocus?.(); }} onBlur={() => { focused.current = false; onBlur?.(); }}
      onLayout={() => { if (focused.current) input.current?.setNativeProps({ selection: selection.current }); }}
      onScroll={event => { scrollY.current = event.nativeEvent.contentOffset.y; }} scrollEnabled
      onSelectionChange={event => { selection.current = event.nativeEvent.selection; onSelectionChange(selection.current); }} multiline textAlignVertical="top" autoCapitalize="none" autoCorrect={false} spellCheck={false} disableFullscreenUI />}
    <ScriptIssues value={value} issues={issues} pending={pending} compact={compact} keyboardVisible={keyboardVisible} onSelect={issue => editRange({ start: issue.start, end: issue.end })} />
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, minHeight: 0 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  button: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#eceff3' },
  active: { backgroundColor: '#f8d6e3' }, buttonText: { fontSize: 13, fontWeight: '600', color: '#6a5361' },
  hint: { fontSize: 12, color: '#748094', paddingBottom: 8 },
  reader: { flex: 1, minHeight: 0, borderWidth: 1, borderColor: '#e2e6ea', borderRadius: 12, backgroundColor: 'white' },
  readerContent: { padding: 16, paddingBottom: 80 }, readerLine: { fontSize: 15, lineHeight: 22, color: '#222', minHeight: 22 },
  input: { flex: 1, minHeight: 0, padding: 12, paddingBottom: 32, borderWidth: 1, borderColor: '#e2e6ea', borderRadius: 12, backgroundColor: 'white', fontSize: 15, lineHeight: 22, color: '#222' },
  invalid: { borderColor: '#d44b60' },
});
