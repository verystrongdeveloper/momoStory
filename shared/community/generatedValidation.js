// Generated from validation.ts by scripts/build-community-validation.cjs. Do not edit.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.charCount = exports.CommunityValidationError = exports.COMMUNITY_LIMITS = void 0;
exports.validateComment = validateComment;
exports.validatePublicStory = validatePublicStory;
exports.diagnoseStoryScript = diagnoseStoryScript;
/** Pure validation shared by the app and the Edge Function. Never trust client validation alone. */
exports.COMMUNITY_LIMITS = { postsPerDay: 5, commentsPerDay: 10, commentChars: 300, titleChars: 100, storyChars: 50_000, storyBytes: 200_000, lines: 1_000, chatMessages: 300 };
class CommunityValidationError extends Error {
    code;
    line;
    constructor(code, line) {
        super(code);
        this.code = code;
        this.line = line;
    }
}
exports.CommunityValidationError = CommunityValidationError;
const fail = (code, line) => { throw new CommunityValidationError(code, line); };
const charCount = (text) => Array.from(text).length;
exports.charCount = charCount;
const controls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const aliases = { '코유키': '코유키', koyuki: '코유키', 'コユキ': '코유키', '小雪': '코유키', '케이': '케이', kei: '케이', 'ケイ': '케이', '凯伊': '케이', '후부키': '후부키', fubuki: '후부키', 'フブキ': '후부키', '吹雪': '후부키', '호시노': '호시노', hoshino: '호시노', 'ホシノ': '호시노', '星野': '호시노', '히나': '히나', hina: '히나', 'ヒナ': '히나', '日奈': '히나', '마리': '마리', mari: '마리', 'マリー': '마리', '玛丽': '마리' };
function speaker(value) {
    const name = value.match(/^([^()（）:：\[\]]+?)(?:\s*[（(][^()（）\[\]]{1,80}[）)])?$/)?.[1]?.trim();
    return name ? aliases[name.toLowerCase()] : undefined;
}
const animations = new Set(['shakeX', 'shakeY', 'slideX', 'slideY']);
function validateComment(value) {
    if (typeof value !== 'string' || controls.test(value))
        return fail('INVALID_COMMENT');
    if ((0, exports.charCount)(value) > exports.COMMUNITY_LIMITS.commentChars || !value.trim())
        return fail('INVALID_COMMENT');
    return value.trim();
}
function validatePublicStory(value, assets) {
    if (!value || typeof value !== 'object')
        return fail('INVALID_STORY');
    const raw = value;
    if (typeof raw.title !== 'string' || !raw.title.trim() || (0, exports.charCount)(raw.title) > 100 || /[\r\n]/.test(raw.title))
        return fail('INVALID_TITLE');
    if (typeof raw.script !== 'string' || typeof raw.character !== 'string' || !assets.emotions[raw.character])
        return fail('INVALID_STORY');
    if (typeof raw.clientId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(raw.clientId))
        return fail('INVALID_STORY');
    if (raw.script.length > 100_000 || !Array.isArray(raw.chatMessages) || raw.chatMessages.length > 300)
        return fail('STORY_TOO_LONG');
    const chatMessages = raw.chatMessages.map((message) => {
        if (!message || typeof message !== 'object')
            return fail('INVALID_CHAT');
        const item = message;
        if ((item.sender !== 'user' && item.sender !== 'character') || typeof item.text !== 'string' || !item.text.trim() || controls.test(item.text) || (0, exports.charCount)(item.text) > 3_000 || (item.showImage !== undefined && typeof item.showImage !== 'boolean'))
            return fail('INVALID_CHAT');
        return { sender: item.sender, text: item.text, ...(typeof item.showImage === 'boolean' ? { showImage: item.showImage } : {}) };
    });
    const content = raw.script + chatMessages.map(message => message.text).join('');
    if ((0, exports.charCount)(content) > 50_000 || new TextEncoder().encode(content).length > 200_000)
        return fail('STORY_TOO_LONG');
    const issues = diagnoseStoryScript(raw.script, assets, raw.title.trim());
    if (issues.length)
        return fail(issues[0].code, issues[0].line);
    // Explicit whitelist: API keys, local paths and preferences can never hitchhike on an upload.
    return { title: raw.title.trim(), character: raw.character, script: raw.script.trim(), chatMessages, clientId: raw.clientId };
}
/** UTF-16 ranges match textarea/TextInput selection offsets; line numbers include blank lines. */
function diagnoseStoryScript(script, assets, expectedTitle) {
    const issues = [];
    let offset = 0;
    const rows = script.split('\n').map((raw, index) => {
        const row = { text: raw.trim(), line: index + 1, start: offset + Math.max(0, raw.search(/\S/)), end: offset + raw.replace(/\r$/, '').length };
        offset += raw.length + 1;
        return row;
    });
    const lines = rows.filter(row => !!row.text);
    const add = (code, row = rows[0]) => {
        if (issues.length < 100 && !issues.some(issue => issue.line === row.line && issue.code === code))
            issues.push({ code, line: row.line, start: row.start, end: Math.max(row.start, row.end) });
    };
    if (script.length > 100_000 || (0, exports.charCount)(script) > 50_000 || new TextEncoder().encode(script).length > 200_000 || lines.length > 1_000 || rows.length > 10_000) {
        add('STORY_TOO_LONG');
        return issues;
    }
    const title = lines[0]?.text.match(/^(?:타이틀|title)\s*[:：]\s*(.+)$/i)?.[1]?.trim();
    if (!title || (expectedTitle !== undefined && title !== expectedTitle))
        add('INVALID_TITLE_LINE', lines[0]);
    else if ((0, exports.charCount)(title) > 100)
        add('INVALID_TITLE', lines[0]);
    const hasEnd = lines.at(-1)?.text === 'endEvent';
    if (!hasEnd)
        add('MISSING_END', lines.at(-1));
    for (const row of rows)
        if (controls.test(row.text))
            add('INVALID_STORY', row);
    let readable = 0, waitTotal = 0;
    const usedCharacters = new Set();
    const checkLine = (line, lineNo) => {
        if (line.length > 4_000)
            return fail('STORY_TOO_LONG', lineNo);
        if (controls.test(line))
            return fail('INVALID_STORY', lineNo);
        if (/^(deleteAll|deleteEmotion)$/.test(line))
            return;
        if (/^waitSecond\b/.test(line)) {
            const wait = line.match(/^waitSecond\s*[:=]\s*([1-9]|[12]\d|30)$/);
            if (!wait)
                return fail('INVALID_COMMAND', lineNo);
            waitTotal += Number(wait[1]);
            if (waitTotal > 120)
                return fail('INVALID_COMMAND', lineNo);
            return;
        }
        if (/^animation\s*:\s*\w+$/.test(line)) {
            if (!animations.has(line.split(':')[1].trim()))
                return fail('INVALID_COMMAND', lineNo);
            return;
        }
        const assetOnly = /^(?:bg|music|sound|emotion|expression)\s*:/.test(line);
        // Plain bracketed prose is dialogue, e.g. [인증 성공]. Reserve key:value
        // blocks and known effect keys (including malformed ones) for validation.
        const metaAt = line.search(/\[\s*(?:[A-Za-z]+\s*:|(?:emotion|bg|music|sound|expression|animation|speaker|dialogue)\b)/);
        const plain = assetOnly ? '' : (metaAt < 0 ? line : line.slice(0, metaAt)).trim();
        const metadata = assetOnly ? `[${line}]` : metaAt < 0 ? '' : line.slice(metaAt);
        // Generators and the editor may split effects across adjacent metadata blocks.
        if (metadata && !/^(?:\[[^\[\]\r\n]+\]\s*)+$/.test(metadata))
            return fail('INVALID_METADATA', lineNo);
        let kind;
        if (plain.startsWith('selection :') || /^selection\s*:/.test(plain)) {
            kind = 'selection';
            const optionsText = plain.replace(/^selection\s*:\s*/, '');
            const options = [...optionsText.matchAll(/\((\d+)\)\s*(?:"([^"\r\n]+)"|\(([^()\r\n]+)\))/g)];
            if (!options.length || options.length > 4 || options.some((option, index) => Number(option[1]) !== index + 1 || (0, exports.charCount)(option[2] ?? option[3]) > 300) || optionsText.replace(/\(\d+\)\s*(?:"[^"\r\n]+"|\([^()\r\n]+\))/g, '').trim())
                return fail('INVALID_SELECTION', lineNo);
            readable++;
        }
        else if (/^narration\s*:/.test(plain)) {
            kind = 'narration';
            if (!plain.replace(/^narration\s*:\s*/, '').trim())
                return fail('INVALID_STRUCTURE', lineNo);
            readable++;
        }
        else if (!plain && metadata) {
            kind = 'assets';
        }
        else {
            kind = 'dialogue';
            const match = plain.match(/^([^:]+):\s*(.+)$/);
            const name = match && speaker(match[1].trim());
            if (!name || !assets.emotions[name] || !match[2].trim())
                return fail('INVALID_SPEAKER', lineNo);
            usedCharacters.add(name);
            readable++;
        }
        const seen = new Set();
        const entries = [...metadata.matchAll(/\[([^\[\]]+)\]/g)].flatMap(block => block[1].split(/,\s*(?=[A-Za-z]+\s*:)/));
        for (const entry of entries) {
            const match = entry.match(/^\s*([A-Za-z]+)\s*:\s*(.+?)\s*$/);
            if (!match || seen.has(match[1]))
                return fail('INVALID_METADATA', lineNo);
            const [, key, text] = match;
            seen.add(key);
            const effects = ['emotion', 'bg', 'music', 'sound', 'expression', 'animation'];
            const allowed = kind === 'selection' ? [...effects, 'speaker', 'dialogue'] : effects;
            if (!allowed.includes(key))
                return fail('INVALID_METADATA', lineNo);
            if (key === 'speaker') {
                const name = speaker(text);
                if (!name)
                    return fail('INVALID_SPEAKER', lineNo);
                usedCharacters.add(name);
            }
            else if (key === 'dialogue') {
                if ((0, exports.charCount)(text) > 1_000)
                    return fail('STORY_TOO_LONG', lineNo);
            }
            else if (key === 'animation') {
                if (!animations.has(text))
                    return fail('INVALID_COMMAND', lineNo);
            }
            else if (key === 'emotion') {
                if (!Object.values(assets.emotions).some(files => files.some(file => file === text || file.replace(/\.(png|jpg)$/, '') === text)))
                    return fail('INVALID_ASSET', lineNo);
            }
            else if (!(key === 'music' && text === 'none') && !assets[key].includes(text))
                return fail('INVALID_ASSET', lineNo);
        }
    };
    for (const row of lines.slice(1, hasEnd ? -1 : undefined)) {
        if (issues.length >= 100)
            break;
        try {
            checkLine(row.text, row.line);
        }
        catch (error) {
            if (error instanceof CommunityValidationError)
                add(error.code, row);
            else
                throw error;
        }
    }
    if ((!readable && !issues.length) || usedCharacters.size > 3)
        add('INVALID_STRUCTURE', lines[0]);
    return issues.sort((a, b) => a.line - b.line);
}
