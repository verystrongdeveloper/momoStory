const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { buildEventPromptPro } = require('../shared/prompts/promptBuilderPro');
const { resources } = require('../shared/prompts/resources');
const { personas, buildChatPrompt } = require('../shared/prompts');
const { buildSelectionPrompt } = require('../shared/prompts/selectionPromptBuilder');
const { withGenerationLanguage } = require('../shared/prompts/generationLanguage');
function loadTs(file, mockRequire) {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(mockRequire, mod, mod.exports);
  return mod.exports;
}
const maps = loadTs('constants/eventAssets.ts', id => id);
for (const [key, map] of [['sound', maps.sfxMap], ['expression', maps.expressionMap]]) {
  assert.deepEqual([...resources.공통[key]].sort(), Object.keys(map).sort(), `${key} prompt list must exactly match playable script keys`);
  assert.equal(new Set(resources.공통[key]).size, resources.공통[key].length);
}
assert.ok(resources.공통.expression.includes('Headpat.png'));
assert.ok(!resources.공통.expression.includes('Headpat.webp'));
assert.ok(resources.공통.sound.includes('SE_Crow_04.wav'));
const parse = loadTs('utils/parseEventScript.ts', () => { throw new Error('Unexpected dependency'); }).default;
for (const name of Object.keys(personas)) {
  const prompt = buildEventPromptPro(name, [{ user: '안녕', ai: '왔어?' }], [{ name, emotions: resources[name].emotions }], '최근 대화에서 이어진 일상');
  assert.ok(prompt.includes(personas[name]), 'story generation must receive the shared character persona');
  assert.ok(buildChatPrompt(name).includes(personas[name]), 'chat generation must receive the same persona');
  for (const animation of ['shakeX', 'shakeY', 'slideX', 'slideY']) {
    assert.ok(prompt.includes(`- ${animation}:`));
    const sample = `${name} : 반응 [emotion : ${resources[name].emotions[0]}, animation : ${animation}, expression : sweat.png, sound : SE_Crow_04.wav]`;
    const line = parse(sample)[0];
    assert.equal(line.animationType, animation);
    assert.equal(line.expression, 'sweat.png');
    assert.equal(line.soundFile, 'SE_Crow_04.wav');
  }
  for (const key of ['sound', 'expression']) for (const asset of resources.공통[key]) assert.ok(prompt.includes(`- ${asset}`));
  assert.ok(prompt.includes('같은 효과를 연속 반복하지 않는다'));
  assert.ok(prompt.includes('장소 변경만을 위해 deleteAll을 넣지 않는다'));
  assert.ok(prompt.includes('이미 끝난 채팅, 출력할 대본이 아닌 참고 자료'));
  assert.ok(prompt.includes('마지막 캐릭터 답변 다음부터가 이번 대본'));
  assert.ok(prompt.includes('선생의 기존 메시지를 selection으로 바꾸어 재연하지 않는다'));
  assert.ok(prompt.includes('말만 바꾸거나 다른 언어로 번역해 다시 주고받는 것도 금지'));
  assert.ok(prompt.includes('채팅 요약이나 회상으로 시작하지 않으며'));
  assert.ok(prompt.includes('약 300줄 내외'));
  for (const language of ['ko', 'en', 'ja', 'zh']) {
    const localized = withGenerationLanguage(prompt, language, 'event');
    assert.ok(localized.includes(prompt));
    assert.ok(localized.includes('Preserve all asset filenames, animation identifiers'));
  }
  // The concrete example must be parseable with real assets and reactions.
  const example = prompt.split('[형식 예시]')[1].split('[사용 가능 bg]')[0];
  const lines = parse(example);
  assert.ok(lines.some(line => line.animationType === 'shakeX' && line.expression === 'sweat.png'));
  for (const line of lines) {
    if (line.soundFile) assert.ok(maps.sfxMap[line.soundFile]);
    if (line.expression) assert.ok(maps.expressionMap[line.expression]);
    if (line.bg) assert.ok(maps.bgMap[line.bg]);
    if (line.emotion) assert.ok(maps.emotionMap[line.emotion]);
  }
}
const characters = loadTs('constants/characters.ts', id => id).CHARACTERS;
for (const character of characters) {
  assert.ok(personas[character.name], `missing persona: ${character.name}`);
  for (const file of resources[character.name].emotions) {
    const source = maps.emotionMap[file.replace(/\.(png|jpg)$/, '')];
    assert.ok(source, `missing sprite map: ${file}`);
    assert.ok(fs.existsSync(path.resolve(__dirname, '../constants', source)), `missing sprite file: ${source}`);
  }
}
for (const [name, folder] of [['후부키', 'fubuki'], ['케이', 'kei']]) {
  // Public scripts retain their historical PNG names; bundled files are WebP.
  const expected = resources[name].emotions.map(file => file.replace(/\.(png|jpg)$/, '.webp')).sort();
  assert.deepEqual(expected, fs.readdirSync(path.join(__dirname, '../assets/images', folder)).sort());
}
const { keepAssetSpeakers, getAvailableCharacters } = require('../shared/prompts/characterList');
assert.ok(getAvailableCharacters().includes('유우카'));
assert.ok(buildSelectionPrompt([]).includes('유우카'));
assert.deepEqual([...resources.유우카.emotions].sort(), fs.readdirSync(path.join(__dirname, '../assets/images/yuuka')).sort());
const yuukaPrompt = buildEventPromptPro('유우카', [], [{ name: '유우카', emotions: resources.유우카.emotions }], '함께 서류를 정리한다.');
const spriteLayout = loadTs('constants/spriteLayout.ts', () => ({}));
assert.equal(spriteLayout.getSpriteAspectRatio('yuuka_default'), 687 / 1024);
for (const [language, name] of Object.entries({ ko: '유우카', en: 'Yuuka', ja: 'ユウカ', zh: '优香' })) {
  assert.equal(characters.find(character => character.name === '유우카').displayName[language], name);
  for (const file of resources.유우카.emotions) {
    assert.ok(yuukaPrompt.includes(file));
    assert.ok(yuukaPrompt.includes(resources.유우카.emotionDescriptions[file]));
    const localized = keepAssetSpeakers(`title : Test\n유우카(세미나) : 같이 확인해요. [emotion : ${file}]\nselection : (1)"좋아" [speaker : 유우카, dialogue : 이쪽이에요., emotion : ${file}]\nendEvent`, ['유우카'], language);
    assert.ok(localized.includes(`${name}(`));
    assert.ok(localized.includes(`speaker : ${name}`));
    assert.equal(parse(localized).filter(line => line.emotion === file.replace('.png', '')).length, 2);
  }
}
assert.ok(getAvailableCharacters().includes('키쿄'));
assert.ok(buildSelectionPrompt([]).includes('키쿄'));
assert.deepEqual([...resources.키쿄.emotions].sort(), fs.readdirSync(path.join(__dirname, '../assets/images/kikyou')).sort());
const kikyouPrompt = buildEventPromptPro('키쿄', [], [{ name: '키쿄', emotions: resources.키쿄.emotions }], '햇볕을 쬐며 함께 쉰다.');
assert.equal(spriteLayout.getSpriteAspectRatio('kikyou_default'), 409 / 610);
for (const [language, name] of Object.entries({ ko: '키쿄', en: 'Kikyou', ja: 'キキョウ', zh: '桔梗' })) {
  assert.equal(characters.find(character => character.name === '키쿄').displayName[language], name);
  for (const file of resources.키쿄.emotions) {
    assert.ok(kikyouPrompt.includes(file));
    assert.ok(kikyouPrompt.includes(resources.키쿄.emotionDescriptions[file]));
    const localized = keepAssetSpeakers(`title : Test\n키쿄(백화요란 분쟁조정위원회) : 같이 확인해요. [emotion : ${file}]\nselection : (1)"좋아" [speaker : 키쿄, dialogue : 이쪽이에요., emotion : ${file}]\nendEvent`, ['키쿄'], language);
    assert.ok(localized.includes(`${name}(`));
    assert.ok(localized.includes(`speaker : ${name}`));
    assert.equal(parse(localized).filter(line => line.emotion === file.replace('.png', '')).length, 2);
  }
}
assert.ok(getAvailableCharacters().includes('코유키'));
assert.ok(buildSelectionPrompt([]).includes('코유키'));
assert.deepEqual([...resources.코유키.emotions].sort(), fs.readdirSync(path.join(__dirname, '../assets/images/koyuki')).sort());
const koyukiPrompt = buildEventPromptPro('코유키', [], [{ name: '코유키', emotions: resources.코유키.emotions }], '추첨 결과를 함께 확인한다.');
for (const [language, name] of Object.entries({ ko: '코유키', en: 'Koyuki', ja: 'コユキ', zh: '小雪' })) {
  assert.equal(characters.find(character => character.name === '코유키').displayName[language], name);
  for (const file of resources.코유키.emotions) {
    assert.ok(koyukiPrompt.includes(file));
    assert.ok(koyukiPrompt.includes(resources.코유키.emotionDescriptions[file]));
    const localized = keepAssetSpeakers(`title : Luck\n코유키(세미나) : 같이 해 봐요! [emotion : ${file}]\nselection : (1)"좋아" [speaker : 코유키, dialogue : 이쪽이에요., emotion : ${file}]\nendEvent`, ['코유키'], language);
    assert.ok(localized.includes(`${name}(`));
    assert.ok(localized.includes(`speaker : ${name}`));
    assert.equal(parse(localized).filter(line => line.emotion === file.replace('.png', '')).length, 2);
  }
}
assert.ok(getAvailableCharacters().includes('케이'));
assert.ok(buildChatPrompt('케이').includes(personas.케이));
assert.ok(buildSelectionPrompt([]).includes('케이'));
const keiPrompt = buildEventPromptPro('케이', [], [{ name: '케이', emotions: resources.케이.emotions }], '함께 게임을 고른다.');
assert.ok(keiPrompt.includes(personas.케이));
for (const [language, name] of Object.entries({ ko: '케이', en: 'Kei', ja: 'ケイ', zh: '凯伊' })) {
  assert.equal(characters.find(character => character.name === '케이').displayName[language], name);
  for (const file of resources.케이.emotions) {
    assert.ok(keiPrompt.includes(file));
    const localized = keepAssetSpeakers(`title : Game\n케이(초현상특무부) : 같이 확인해요. [emotion : ${file}]\nselection : (1)"좋아" [speaker : 케이, dialogue : 이쪽이에요., emotion : ${file}]\nendEvent`, ['케이'], language);
    assert.ok(localized.includes(`${name}(`));
    assert.ok(localized.includes(`speaker : ${name}`));
    assert.equal(parse(localized).filter(line => line.emotion === file.replace('.png', '')).length, 2);
  }
}
assert.ok(getAvailableCharacters().includes('후부키'));
for (const [language, name] of Object.entries({ ko: '후부키', en: 'Fubuki', ja: 'フブキ', zh: '吹雪' })) {
  const localized = keepAssetSpeakers('title : Break\n후부키(생활안전국) : 잠깐 쉬자. [emotion : fubuki_default.png]\nendEvent', ['후부키'], language);
  assert.ok(localized.includes(`${name}(`), 'Fubuki dialogue survives speaker filtering in every supported language');
  assert.ok(localized.includes('fubuki_default.png'));
}
assert.equal(require('../server/src/utils/promptBuilderPro').buildEventPromptPro, buildEventPromptPro);
const selector = buildSelectionPrompt([{ user: '내일 같이 청소하자.', ai: '응, 교실에서 기다릴게.' }]);
assert.ok(selector.includes('마지막 캐릭터 답변 이후에 벌어질 새 사건'));
assert.ok(selector.includes('채팅 내용을 재연하거나 요약하지 않는다'));
assert.ok(selector.includes('내일 같이 청소하자.'));
assert.ok(selector.includes('교실에서 기다릴게.'));
console.log('PASS prompt effects, exact asset keys, supported animation syntax, parsed examples, language preservation and shared server builder');
