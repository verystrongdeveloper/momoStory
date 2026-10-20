const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { buildEventPromptPro } = require('../shared/prompts/promptBuilderPro');
const { resources } = require('../shared/prompts/resources');
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
for (const name of ['호시노', '히나', '마리']) {
  const prompt = buildEventPromptPro(name, [{ user: '안녕', ai: '왔어?' }], [{ name, emotions: resources[name].emotions }], '최근 대화에서 이어진 일상');
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
assert.equal(require('../server/src/utils/promptBuilderPro').buildEventPromptPro, buildEventPromptPro);
const selector = buildSelectionPrompt([{ user: '내일 같이 청소하자.', ai: '응, 교실에서 기다릴게.' }]);
assert.ok(selector.includes('마지막 캐릭터 답변 이후에 벌어질 새 사건'));
assert.ok(selector.includes('채팅 내용을 재연하거나 요약하지 않는다'));
assert.ok(selector.includes('내일 같이 청소하자.'));
assert.ok(selector.includes('교실에서 기다릴게.'));
console.log('PASS prompt effects, exact asset keys, supported animation syntax, parsed examples, language preservation and shared server builder');
