import React, { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '@/i18n';
import { ScriptIssues, useScriptDiagnostics, type ScriptEditorProps } from './scriptEditorShared';

// One native textarea retains selection, undo, IME and accessibility. A non-interactive
// transparent mirror paints only diagnostics, with identical wrapping and scroll metrics.
export default function StoryScriptEditor({ value, onChangeText, onSelectionChange, style }: ScriptEditorProps) {
  const { t } = useI18n();
  const input = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const { issues, pending } = useScriptDiagnostics(value);
  const syncScroll = () => {
    if (!input.current || !mirror.current) return;
    mirror.current.style.width = `${input.current.clientWidth}px`;
    mirror.current.scrollTop = input.current.scrollTop;
    mirror.current.scrollLeft = input.current.scrollLeft;
  };
  useLayoutEffect(() => {
    syncScroll();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncScroll);
    if (input.current) observer?.observe(input.current);
    return () => observer?.disconnect();
  }, [value, issues.length]);
  const lines = value.split('\n');
  const highlights = new Map(issues.map(issue => [issue.line, issue]));
  const paint = value.length <= 100_000 && lines.length <= 2_000;
  const reportSelection = () => {
    if (input.current) onSelectionChange({ start: input.current.selectionStart, end: input.current.selectionEnd });
  };
  return <View style={[styles.root, style]}>
    <div style={{ position: 'relative', flex: 1, minHeight: 120, overflow: 'hidden', border: `1px solid ${issues.length ? '#d44b60' : '#e2e6ea'}`, borderRadius: 12, background: 'white' }}>
      <div ref={mirror} aria-hidden="true" style={{ ...metrics, position: 'absolute', inset: 0, overflow: 'hidden', color: 'transparent', pointerEvents: 'none', userSelect: 'none' }}>
        {paint && lines.map((line, index) => <span key={index} data-script-line={index + 1} style={highlights.has(index + 1) ? squiggle : undefined}>{line || '\u200b'}{index < lines.length - 1 ? '\n' : ''}</span>)}
      </div>
      <textarea ref={input} aria-label={t('editStory')} aria-invalid={!!issues.length} value={value} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="soft"
        style={{ ...metrics, position: 'absolute', inset: 0, width: '100%', height: '100%', resize: 'none', border: 0, outline: 'none', background: 'transparent', color: '#222', caretColor: '#222', overflow: 'auto' }}
        onChange={event => { onChangeText(event.currentTarget.value); reportSelection(); }} onSelect={reportSelection} onScroll={syncScroll} />
    </div>
    <ScriptIssues value={value} issues={issues} pending={pending} onSelect={issue => {
      const textarea = input.current;
      if (!textarea) return;
      textarea.focus(); textarea.setSelectionRange(issue.start, issue.end);
      const row = mirror.current?.querySelector<HTMLElement>(`[data-script-line="${issue.line}"]`);
      if (row && mirror.current) {
        const top = row.getBoundingClientRect().top - mirror.current.getBoundingClientRect().top + textarea.scrollTop;
        textarea.scrollTop = Math.max(0, top - textarea.clientHeight * 0.4);
      }
      syncScroll(); reportSelection();
    }} />
  </View>;
}
const metrics: CSSProperties = { boxSizing: 'border-box', margin: 0, padding: 16, fontSize: 15, lineHeight: '22px', fontFamily: 'Consolas, "Malgun Gothic", monospace', fontWeight: 400, fontVariantLigatures: 'none', letterSpacing: 0, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'normal', tabSize: 4, textAlign: 'left' };
const squiggle: CSSProperties = { textDecorationLine: 'underline', textDecorationStyle: 'wavy', textDecorationColor: '#d72f48', textUnderlineOffset: '3px', textDecorationSkipInk: 'none' };
const styles = StyleSheet.create({ root: { flex: 1, minWidth: 0, minHeight: 0 } });
