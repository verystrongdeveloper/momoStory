const LANGUAGES = { ko: 'Korean', en: 'English', ja: 'Japanese', zh: 'Simplified Chinese' };
const { speakerLanguageGuide } = require('./speakerNames');

function normalizeGenerationLanguage(value) {
  return typeof value === 'string' && Object.hasOwn(LANGUAGES, value) ? value : 'ko';
}

/** Shared by direct REST and Express; never translate the script's machine identifiers. */
function withGenerationLanguage(instruction, language, mode = 'chat') {
  const target = LANGUAGES[normalizeGenerationLanguage(language)];
  const rules = [
    `OUTPUT LANGUAGE: ${target}.`,
    `Write all new user-visible content in ${target}, even if the user's message, history, persona, instructions or examples are in another language.`,
    'Language selection overrides the language of examples, not the character personality, relationships, tone or required output format.',
    'Do not explain or announce the language choice. Do not output a bilingual translation.',
    `Use names, school names and departments in ${target}, including speaker labels, narration and dialogue. Speaker labels contain only the short character name; do not append affiliations or roles in parentheses. The app displays each character's fixed affiliation automatically. Do not leave Korean names or departments in non-Korean output.`,
    speakerLanguageGuide(normalizeGenerationLanguage(language)),
  ];
  if (mode === 'event') rules.push(
    `Write the story title, dialogue, narration and choice text in ${target}. Omit affiliations from speaker labels and speaker metadata.`,
    `Speaker names before the colon are visible text: localize them into ${target} using the name guide. The allowed cast still limits who may appear; do not add other characters.`,
    'Never translate script keywords or metadata keys: 타이틀, narration, selection, deleteEmotion, deleteAll, waitSecond, endEvent, bg, emotion, music, sound, expression, animation.',
    'Preserve all asset filenames, animation identifiers, delimiters, choice numbering, and command syntax exactly. Translate only human-readable text.',
    normalizeGenerationLanguage(language) === 'ko' ? 'Use 타이틀 : for the title command.' : 'Use title : for the title command. Both title and 타이틀 are supported, but do not translate title into another keyword.',
  );
  if (mode === 'select') rules.push(
    `Write direction and reason in ${target}. Return only the requested JSON.`,
    'Preserve JSON keys and canonical character names exactly as listed in the available cast. Do not translate or romanize character identifiers.',
  );
  return `${instruction}\n\n[Generation language]\n${rules.join('\n')}`;
}

module.exports = { normalizeGenerationLanguage, withGenerationLanguage };
