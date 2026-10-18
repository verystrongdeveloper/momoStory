/** Pure validation shared by the app and the Edge Function. Never trust client validation alone. */
export const COMMUNITY_LIMITS = { postsPerDay: 5, commentsPerDay: 10, commentChars: 300, titleChars: 100, storyChars: 50_000, storyBytes: 200_000, lines: 1_000, chatMessages: 300 } as const;
export type CommunityChat = { sender: 'user' | 'character'; text: string; showImage?: boolean };
export type PublicStoryInput = { title: string; character: string; script: string; chatMessages: CommunityChat[]; clientId: string };
export type AssetManifest = { bg: string[]; music: string[]; sound: string[]; expression: string[]; emotions: Record<string, string[]> };
export class CommunityValidationError extends Error {
  constructor(public code: string, public line?: number) { super(code); }
}
const fail = (code: string, line?: number): never => { throw new CommunityValidationError(code, line); };
export const charCount = (text: string) => Array.from(text).length;
const controls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const aliases: Record<string, string> = { '호시노': '호시노', hoshino: '호시노', 'ホシノ': '호시노', '星野': '호시노', '히나': '히나', hina: '히나', 'ヒナ': '히나', '日奈': '히나' };
function speaker(value: string) {
  const name = value.match(/^([^()（）:：\[\]]+?)(?:\s*[（(][^()（）\[\]]{1,80}[）)])?$/)?.[1]?.trim();
  return name ? aliases[name.toLowerCase()] : undefined;
}
const animations = new Set(['shakeX', 'shakeY', 'slideX', 'slideY']);

export function validateComment(value: unknown): string {
  if (typeof value !== 'string' || controls.test(value)) return fail('INVALID_COMMENT');
  if (charCount(value) > COMMUNITY_LIMITS.commentChars || !value.trim()) return fail('INVALID_COMMENT');
  return value.trim();
}

export function validatePublicStory(value: unknown, assets: AssetManifest): PublicStoryInput {
  if (!value || typeof value !== 'object') return fail('INVALID_STORY');
  const raw = value as Record<string, unknown>;
  if (typeof raw.title !== 'string' || !raw.title.trim() || charCount(raw.title) > 100 || /[\r\n]/.test(raw.title)) return fail('INVALID_TITLE');
  if (typeof raw.script !== 'string' || controls.test(raw.script) || typeof raw.character !== 'string' || !assets.emotions[raw.character]) return fail('INVALID_STORY');
  if (typeof raw.clientId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(raw.clientId)) return fail('INVALID_STORY');
  if (raw.script.length > 100_000 || !Array.isArray(raw.chatMessages) || raw.chatMessages.length > 300) return fail('STORY_TOO_LONG');
  const chatMessages: CommunityChat[] = raw.chatMessages.map((message: unknown) => {
    if (!message || typeof message !== 'object') return fail('INVALID_CHAT');
    const item = message as Record<string, unknown>;
    if ((item.sender !== 'user' && item.sender !== 'character') || typeof item.text !== 'string' || !item.text.trim() || controls.test(item.text) || charCount(item.text) > 3_000 || (item.showImage !== undefined && typeof item.showImage !== 'boolean')) return fail('INVALID_CHAT');
    return { sender: item.sender, text: item.text, ...(typeof item.showImage === 'boolean' ? { showImage: item.showImage } : {}) };
  });
  const content = raw.script + chatMessages.map(message => message.text).join('');
  if (charCount(content) > 50_000 || new TextEncoder().encode(content).length > 200_000) return fail('STORY_TOO_LONG');
  const script = raw.script.trim();
  const lines = script.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length > 1_000) return fail('STORY_TOO_LONG');
  const title = lines[0]?.match(/^(?:타이틀|title)\s*[:：]\s*(.+)$/i)?.[1]?.trim();
  if (!title || title !== raw.title.trim() || lines.at(-1) !== 'endEvent') return fail('INVALID_STRUCTURE');
  let readable = 0, waitTotal = 0;
  const usedCharacters = new Set<string>();
  for (let i = 1; i < lines.length - 1; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    if (line.length > 4_000) return fail('STORY_TOO_LONG', lineNo);
    if (/^(deleteAll|deleteEmotion)$/.test(line)) continue;
    if (/^waitSecond\s*:\s*(?:[1-9]|[12]\d|30)$/.test(line)) {
      waitTotal += Number(line.split(':')[1]);
      if (waitTotal > 120) return fail('INVALID_COMMAND', lineNo);
      continue;
    }
    if (/^animation\s*:\s*\w+$/.test(line)) {
      if (!animations.has(line.split(':')[1].trim())) return fail('INVALID_COMMAND', lineNo);
      continue;
    }
    const assetOnly = /^(?:bg|music|sound)\s*:/.test(line);
    const metaAt = line.indexOf('[');
    const plain = assetOnly ? '' : (metaAt < 0 ? line : line.slice(0, metaAt)).trim();
    const metadata = assetOnly ? `[${line}]` : metaAt < 0 ? '' : line.slice(metaAt);
    if (metadata && !/^\[[^\[\]\r\n]+\]$/.test(metadata)) return fail('INVALID_METADATA', lineNo);
    let kind: 'selection' | 'narration' | 'dialogue' | 'assets';
    if (plain.startsWith('selection :') || /^selection\s*:/.test(plain)) {
      kind = 'selection';
      const optionsText = plain.replace(/^selection\s*:\s*/, '');
      const options = [...optionsText.matchAll(/\((\d+)\)\s*(?:"([^"\r\n]+)"|\(([^()\r\n]+)\))/g)];
      if (!options.length || options.length > 4 || options.some((option, index) => Number(option[1]) !== index + 1 || charCount(option[2] ?? option[3]) > 300) || optionsText.replace(/\(\d+\)\s*(?:"[^"\r\n]+"|\([^()\r\n]+\))/g, '').trim()) return fail('INVALID_SELECTION', lineNo);
      readable++;
    } else if (/^narration\s*:/.test(plain)) {
      kind = 'narration';
      if (!plain.replace(/^narration\s*:\s*/, '').trim()) return fail('INVALID_STRUCTURE', lineNo);
      readable++;
    } else if (!plain && metadata) {
      kind = 'assets';
    } else {
      kind = 'dialogue';
      const match = plain.match(/^([^:]+):\s*(.+)$/);
      const name = match && speaker(match[1].trim());
      if (!name || !assets.emotions[name] || !match![2].trim()) return fail('INVALID_SPEAKER', lineNo);
      usedCharacters.add(name);
      readable++;
    }
    const seen = new Set<string>();
    for (const entry of metadata ? metadata.slice(1, -1).split(/,\s*(?=[A-Za-z]+\s*:)/) : []) {
      const match = entry.match(/^\s*([A-Za-z]+)\s*:\s*(.+?)\s*$/);
      if (!match || seen.has(match[1])) return fail('INVALID_METADATA', lineNo);
      const [, key, text] = match; seen.add(key);
      const allowed = kind === 'dialogue' ? ['emotion', 'bg', 'music', 'sound', 'expression', 'animation'] : kind === 'selection' ? ['emotion', 'bg', 'music', 'sound', 'speaker', 'dialogue'] : ['bg', 'music', 'sound'];
      if (!allowed.includes(key)) return fail('INVALID_METADATA', lineNo);
      if (key === 'speaker') {
        const name = speaker(text);
        if (!name) return fail('INVALID_SPEAKER', lineNo);
        usedCharacters.add(name);
      } else if (key === 'dialogue') {
        if (charCount(text) > 1_000) return fail('STORY_TOO_LONG', lineNo);
      } else if (key === 'animation') {
        if (!animations.has(text)) return fail('INVALID_COMMAND', lineNo);
      } else if (key === 'emotion') {
        if (!Object.values(assets.emotions).some(files => files.includes(text))) return fail('INVALID_ASSET', lineNo);
      } else if (!(key === 'music' && text === 'none') && !assets[key as 'bg' | 'music' | 'sound' | 'expression'].includes(text)) return fail('INVALID_ASSET', lineNo);
    }
  }
  if (!readable || usedCharacters.size > 3) return fail('INVALID_STRUCTURE');
  // Explicit whitelist: API keys, local paths and preferences can never hitchhike on an upload.
  return { title, character: raw.character, script, chatMessages, clientId: raw.clientId };
}
