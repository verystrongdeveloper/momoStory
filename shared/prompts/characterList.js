const { personas, npcs, resources } = require('./index');
const { canonicalCharacterName, localizeStoryScript } = require('./speakerNames');

function hasStoryAssets(name) {
  const emotions = resources[name]?.emotions;
  return Array.isArray(emotions) && emotions.length > 0;
}

function getAvailableCharacters() {
  return [...Object.keys(personas), ...Object.keys(npcs)].filter(hasStoryAssets);
}

function speakerName(line) {
  const match = line.trim().match(/^([^:：]+)[:：]/);
  if (!match) return null;
  const head = match[1].trim();
  if (/^(타이틀|title|narration|selection|deleteAll|deleteEmotion|endEvent|waitSecond|bg|music|sound|animation)$/i.test(head)) {
    return null;
  }
  return canonicalCharacterName(head.replace(/\s*[（(].*$/, '').trim());
}

/** 표정 에셋이 없는 화자의 대사 줄만 뺀다. */
function keepAssetSpeakers(script, allowedNames = getAvailableCharacters(), language) {
  const allowed = new Set(allowedNames.map(canonicalCharacterName));
  const filtered = script
    .split(/\r?\n/)
    .filter((line) => {
      const name = speakerName(line);
      return !name || allowed.has(name);
    })
    .join('\n');
  return language ? localizeStoryScript(filtered, language) : filtered;
}

module.exports = { getAvailableCharacters, hasStoryAssets, keepAssetSpeakers };
