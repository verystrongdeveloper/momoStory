const { personas, npcs, resources } = require('./index');
const { canonicalCharacterName, localizeStoryScript } = require('./speakerNames');

function hasStoryAssets(name) {
  const emotions = resources[name]?.emotions;
  return Array.isArray(emotions) && emotions.length > 0;
}

function getAvailableCharacters() {
  return [...Object.keys(personas), ...Object.keys(npcs)].filter(hasStoryAssets);
}

/** Model JSON is untrusted: at most two distinct, supported guests. */
function parseStorySelection(mainCharacter, text) {
  const fallback = { characters: [], direction: `최근 대화를 이어 '${mainCharacter}' 중심의 인연 스토리를 진행한다.` };
  let value;
  try { value = JSON.parse(text.match(/\{[\s\S]*}/)?.[0] || 'null'); } catch { return fallback; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const seen = new Set([canonicalCharacterName(mainCharacter)]);
  const characters = [];
  for (const item of Array.isArray(value.characters) ? value.characters : []) {
    if (!item || typeof item.name !== 'string') continue;
    const name = canonicalCharacterName(item.name);
    if (seen.has(name) || !hasStoryAssets(name)) continue;
    seen.add(name); characters.push({ name });
    if (characters.length === 2) break;
  }
  return { characters, direction: typeof value.direction === 'string' && value.direction.trim() ? value.direction.trim() : fallback.direction };
}

function speakerName(line) {
  const match = line.trim().match(/^([^:：]+)[:：]/);
  if (!match) return null;
  const head = match[1].trim();
  if (/^(타이틀|title|narration|selection|deleteAll|deleteEmotion|endEvent|waitSecond|bg|music|sound|animation|emotion|expression)$/i.test(head)) {
    return null;
  }
  return canonicalCharacterName(head.replace(/\s*[（(].*$/, '').trim());
}

/** 표정 에셋이 없는 화자의 대사 줄만 뺀다. */
function keepAssetSpeakers(script, allowedNames = getAvailableCharacters(), language) {
  const allowed = new Set(allowedNames.map(canonicalCharacterName));
  const emotions = new Set([...allowed].flatMap(name => resources[name]?.emotions || []).map(file => file.replace(/\.(png|jpg)$/, '')));
  const filtered = script
    .split(/\r?\n/)
    .filter((line) => {
      const name = speakerName(line);
      if (name && !allowed.has(name)) return false;
      const standaloneEmotion = line.match(/^\s*emotion\s*:\s*(.+?)\s*$/)?.[1];
      if (standaloneEmotion && !emotions.has(standaloneEmotion.replace(/\.(png|jpg)$/, ''))) return false;
      // Choices can also carry a speaker; do not let an unselected character in.
      for (const match of line.matchAll(/\[[^\]]*?\bspeaker\s*:\s*([^,\]]+)/g)) {
        const speaker = canonicalCharacterName(match[1].trim().replace(/\s*[（(].*$/, ''));
        if (!allowed.has(speaker)) return false;
      }
      return true;
    })
    .map(line => line.replace(/\[([^\]]*)\]/g, (_block, contents) => {
      const entries = contents.split(/,\s*(?=[A-Za-z]+\s*:)/).filter(entry => {
        const emotion = entry.match(/^\s*emotion\s*:\s*(.+?)\s*$/)?.[1];
        return !emotion || emotions.has(emotion.replace(/\.(png|jpg)$/, ''));
      });
      return entries.length ? `[${entries.join(', ')}]` : '';
    }))
    .filter(line => line.trim())
    .join('\n');
  return language ? localizeStoryScript(filtered, language) : filtered;
}

module.exports = { getAvailableCharacters, hasStoryAssets, keepAssetSpeakers, parseStorySelection };
