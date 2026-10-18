export type AssetKind = 'bg' | 'emotion' | 'music' | 'sound' | 'expression';

const DIALOGUE_KINDS: AssetKind[] = ['emotion', 'bg', 'sound', 'music', 'expression'];
const NARRATION_KINDS: AssetKind[] = ['bg', 'sound', 'music'];
const SELECTION_KINDS: AssetKind[] = ['emotion', 'bg', 'sound', 'music'];

function allowedKinds(line: string): AssetKind[] | null {
  const trimmed = line.trim();
  if (!trimmed || /^(타이틀|title|deleteAll|deleteEmotion|endEvent|waitSecond)(\s|[:：]|$)/i.test(trimmed)) return null;
  if (trimmed.startsWith('narration')) return NARRATION_KINDS;
  if (trimmed.startsWith('selection')) return SELECTION_KINDS;
  if (trimmed.includes(':')) return DIALOGUE_KINDS;
  return null;
}

function lineBounds(script: string, cursor: number) {
  const index = Math.max(0, Math.min(cursor, script.length));
  const start = script.lastIndexOf('\n', Math.max(0, index - 1)) + 1;
  const breakAt = script.indexOf('\n', start);
  const end = breakAt === -1 ? script.length : breakAt;
  return { start, end };
}

const BLOCKED = '커서 앞에 [ 가 있을 때만 넣을 수 있습니다.';
const CLOSE_BRACKET = '대괄호를 닫고 넣어주세요. []';

export type AssetInsert =
  | { ok: true; script: string; cursor: number }
  | { ok: false; notice: string };

/** 커서 앞의 [ ] 안에만 에셋을 넣는다. 괄호가 없으면 만들지 않는다. 같은 항목이 있으면 그 값만 바꾼다. */
export function insertAssetIntoScript(
  script: string,
  cursor: number,
  kind: AssetKind,
  file: string,
): AssetInsert {
  const { start, end } = lineBounds(script, cursor);
  const line = script.slice(start, end);
  const at = Math.max(0, Math.min(cursor, script.length)) - start;
  const open = line.slice(0, at).lastIndexOf('[');
  const close = open === -1 ? -1 : line.indexOf(']', open);
  if (open !== -1 && close === -1) return { ok: false, notice: CLOSE_BRACKET };

  const allowed = allowedKinds(line);
  if (!allowed || !allowed.includes(kind) || open === -1 || at > close) {
    return { ok: false, notice: BLOCKED };
  }

  const entry = `${kind} : ${file}`;
  const inner = line.slice(open + 1, close);
  const existing = new RegExp(`\\b${kind}\\s*:\\s*[^,\\]]+`, 'i');
  const nextInner = existing.test(inner)
    ? inner.replace(existing, entry).replace(/\s+,/g, ',').replace(/,\s*,/g, ',')
    : inner.trim()
      ? `${inner.trim().replace(/,\s*$/, '')}, ${entry}`
      : entry;
  const nextLine = line.slice(0, open + 1) + nextInner + line.slice(close);
  const nextScript = script.slice(0, start) + nextLine + script.slice(end);
  const nextCursor = start + nextLine.lastIndexOf(']');
  return { ok: true, script: nextScript, cursor: nextCursor };
}
