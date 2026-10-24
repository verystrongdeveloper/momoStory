const NAMES = {
  코유키: { ko: '코유키', en: 'Koyuki', ja: 'コユキ', zh: '小雪' },
  케이: { ko: '케이', en: 'Kei', ja: 'ケイ', zh: '凯伊' },
  후부키: { ko: '후부키', en: 'Fubuki', ja: 'フブキ', zh: '吹雪' },
  호시노: { ko: '호시노', en: 'Hoshino', ja: 'ホシノ', zh: '星野' },
  히나: { ko: '히나', en: 'Hina', ja: 'ヒナ', zh: '日奈' },
  마리: { ko: '마리', en: 'Mari', ja: 'マリー', zh: '玛丽' },
};
const AFFILIATIONS = {
  세미나: { en: 'Seminar', ja: 'セミナー', zh: '研讨会' },
  '밀레니엄 사이언스 스쿨': { en: 'Millennium Science School', ja: 'ミレニアムサイエンススクール', zh: '千年科学学园' },
  초현상특무부: { en: 'Super Phenomenon Task Force', ja: '特異現象捜査部', zh: '超现象特务部' },
  밀레니엄: { en: 'Millennium', ja: 'ミレニアム', zh: '千年' },
  '발키리 경찰학교': { en: 'Valkyrie Police School', ja: 'ヴァルキューレ警察学校', zh: '瓦尔基里警察学校' },
  생활안전국: { en: 'Public Safety Bureau', ja: '生活安全局', zh: '生活安全局' },
  '아비도스 고등학교': { en: 'Abydos High School', ja: 'アビドス高等学校', zh: '阿拜多斯高中' },
  '게헨나 학원': { en: 'Gehenna Academy', ja: 'ゲヘナ学園', zh: '格黑娜学园' },
  대책위원회: { en: 'Foreclosure Task Force', ja: '対策委員会', zh: '对策委员会' },
  선도부: { en: 'Prefect Team', ja: '風紀委員会', zh: '风纪委员会' },
  선도부장: { en: 'Head Prefect', ja: '風紀委員長', zh: '风纪委员长' },
  아비도스: { en: 'Abydos', ja: 'アビドス', zh: '阿拜多斯' },
  게헨나: { en: 'Gehenna', ja: 'ゲヘナ', zh: '格黑娜' },
  '트리니티 종합학원': { en: 'Trinity General School', ja: 'トリニティ総合学園', zh: '圣三一综合学园' },
  시스터후드: { en: 'Sisterhood', ja: 'シスターフッド', zh: '修女会' },
  트리니티: { en: 'Trinity', ja: 'トリニティ', zh: '圣三一' },
};
function canonicalCharacterName(name) {
  const text = name.trim();
  return Object.keys(NAMES).find(key => Object.values(NAMES[key]).some(value => value.toLowerCase() === text.toLowerCase())) || text;
}
function localizedCharacterName(name, language) {
  const canonical = canonicalCharacterName(name);
  return NAMES[canonical]?.[language] || canonical;
}
function visibleNames(text, language) {
  const replacements = { ...NAMES, ...AFFILIATIONS };
  for (const key of Object.keys(replacements).sort((a, b) => b.length - a.length)) {
    text = text.split(key).join(replacements[key][language] || key);
  }
  return text;
}
function localizeStoryScript(script, language) {
  if (!['ko', 'en', 'ja', 'zh'].includes(language)) return script;
  return script.split(/\r?\n/).map(line => {
    // Metadata identifiers and filenames must never be translated.
    let localized = line.split(/(\[[^\]]*\])/g).map((part, index) => index % 2
      ? part.replace(/(\bspeaker\s*:\s*)([^,\]]+)/g, (_all, prefix, name) => prefix + localizeLabel(name, language))
      : visibleNames(part, language)).join('');
    localized = localized.replace(/^([^:：]+)([:：])/, (_all, head, colon) => localizeLabel(head, language) + colon);
    if (language !== 'ko') localized = localized.replace(/^\s*타이틀\s*[:：]/, 'title :');
    return localized;
  }).join('\n');
}
function localizeLabel(label, language) {
  const match = label.trim().match(/^([^()（）]+)(?:[（(]([^()（）]*)[）)])?$/);
  if (!match) return visibleNames(label, language);
  const name = localizedCharacterName(match[1], language);
  return `${name}${match[2] !== undefined ? `(${visibleNames(match[2], language)})` : ''} `;
}
function speakerLanguageGuide(language) {
  return Object.entries(NAMES).map(([key, values]) => `${key} => ${values[language] || key}`).join('; ')
    + '. Affiliations: ' + Object.entries(AFFILIATIONS).map(([key, values]) => `${key} => ${values[language] || key}`).join('; ');
}
module.exports = { canonicalCharacterName, localizedCharacterName, localizeStoryScript, speakerLanguageGuide };
