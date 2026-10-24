import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useI18n } from '@/i18n';
import assets from '@/shared/community/assets.json';
import { diagnoseStoryScript, type ScriptIssue } from '@/shared/community/validation';

export type ScriptEditorProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSelectionChange: (selection: { start: number; end: number }) => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  keyboardVisible?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};
export function useScriptDiagnostics(value: string) {
  const [checked, setChecked] = useState(() => ({ value, issues: value.trim() ? diagnoseStoryScript(value, assets) : [] }));
  useEffect(() => {
    const timer = setTimeout(() => setChecked({ value, issues: value.trim() ? diagnoseStoryScript(value, assets) : [] }), 180);
    return () => clearTimeout(timer);
  }, [value]);
  return { issues: checked.value === value ? checked.issues : [], pending: checked.value !== value };
}
export function ScriptIssues({ value, issues, pending, onSelect, compact = false, keyboardVisible = false }: { value: string; issues: ScriptIssue[]; pending: boolean; onSelect: (issue: ScriptIssue) => void; compact?: boolean; keyboardVisible?: boolean }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (keyboardVisible) setExpanded(false); }, [keyboardVisible]);
  if (!value.trim()) return null;
  return <View style={styles.panel}>
    {!!issues.length && compact ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('scriptIssueSummary', { count: issues.length })} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.toggle}>
      <Text style={styles.error}>{t('scriptIssueSummary', { count: issues.length })} {expanded ? '▴' : '▾'}</Text>
    </TouchableOpacity> : <Text style={issues.length ? styles.error : styles.status}>{t(pending ? 'scriptChecking' : issues.length ? 'scriptIssueCount' : 'scriptValid', { count: issues.length })}</Text>}
    {!!issues.length && (!compact || expanded) && <ScrollView style={[styles.list, keyboardVisible && { maxHeight: 76 }]} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
      {issues.map((issue, index) => <TouchableOpacity key={`${issue.line}-${issue.code}-${index}`} accessibilityRole="button" onPress={() => onSelect(issue)} style={styles.item}>
        <Text style={styles.error}>{t('communityLine', { line: issue.line })} · {t(`scriptError_${issue.code}`)}</Text>
      </TouchableOpacity>)}
    </ScrollView>}
  </View>;
}
const styles = StyleSheet.create({ panel: { flexShrink: 0, paddingTop: 8, gap: 4 }, toggle: { minHeight: 32, justifyContent: 'center' }, list: { maxHeight: 132 }, status: { color: '#748094', fontSize: 12 }, error: { color: '#c53047', fontSize: 12, lineHeight: 19 }, item: { paddingVertical: 5 } });
