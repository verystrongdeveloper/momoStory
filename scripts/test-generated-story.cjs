const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const { prepareGeneratedStory, generateValidatedStory } = require('../shared/prompts/generatedStory');
const { validatePublicStory } = require('../shared/community/generatedValidation');
const assets = require('../shared/community/assets.json');
const title = '복구 완료';
const valid = `타이틀 : ${title}\n코유키(세미나) : [인증 성공]이라고 떴어요! [emotion : koyuki_happy.png, sound : SE_Confirm_01.mp3]\nendEvent`;
const invalid = valid.replace('SE_Confirm_01.mp3', 'missing.mp3');
const names = ['코유키'];
const checked = script => validatePublicStory({ title, character: '코유키', script, clientId: 'test-generated', chatMessages: [] }, assets);
function load(file, mocks) {
  const absolute = path.resolve(__dirname, '..', file), localRequire = createRequire(absolute), mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(id => Object.hasOwn(mocks, id) ? mocks[id] : localRequire(id), mod, mod.exports);
  return mod.exports;
}
(async () => {
  const prepared = prepareGeneratedStory(`\uFEFF\`\`\`text\n${valid}\n\`\`\``, names, 'ko');
  checked(prepared);
  assert.ok(prepared.includes('「인증 성공」'));
  assert.ok(prepared.includes('[emotion : koyuki_happy.png, sound : SE_Confirm_01.mp3]'));
  for (const language of ['ko', 'en', 'ja', 'zh']) checked(prepareGeneratedStory(valid, names, language));
  let requests = [];
  checked(await generateValidatedStory({ names, language: 'ko', generate: async repair => { requests.push(repair); return valid; } }));
  assert.equal(requests.length, 1, 'valid output must not incur a repair request');
  requests = [];
  const repaired = await generateValidatedStory({ names, language: 'ko', generate: async repair => { requests.push(repair); return repair ? valid : invalid; } });
  checked(repaired);
  assert.equal(requests.length, 2);
  assert.ok(requests[1].includes('2행 INVALID_ASSET'));
  assert.ok(requests[1].includes('missing.mp3'));
  requests = [];
  await assert.rejects(generateValidatedStory({ names, generate: async repair => { requests.push(repair); return invalid; } }), error => error.code === 'STORY_FORMAT_INVALID' && error.issues[0].line === 2);
  assert.equal(requests.length, 2, 'persistent format errors stop after one repair');
  for (const broken of [valid.replace('\nendEvent', ''), valid.replace(`타이틀 : ${title}`, 'No title'), valid.replace('sound : SE_Confirm_01.mp3', 'animation : jump')]) {
    let count = 0;
    checked(await generateValidatedStory({ names, generate: async () => ++count === 1 ? broken : valid }));
    assert.equal(count, 2);
  }
  let calls = 0;
  const offline = new Error('offline');
  await assert.rejects(generateValidatedStory({ names, generate: async () => { calls++; throw offline; } }), error => error === offline);
  assert.equal(calls, 1, 'network failures do not trigger a format-repair loop');

  let writerCalls = [], keepFailing = false;
  const writer = async prompt => { writerCalls.push(prompt); return keepFailing || writerCalls.length === 1 ? invalid : valid; };
  const context = { id: 'format-check-room', messages: [{ sender: 'user', text: '복구해 보자' }, { sender: 'character', text: '해 볼게요!' }], scripts: [] };
  const direct = load('services/geminiClient/directClient.ts', {
    '@/services/geminiKey': { getGeminiKey: () => 'test-key' }, '@/services/appLanguage': { getAppLanguage: () => 'ko' },
    '../senseiMode': { getSenseiMode: () => 'mild' }, '../geminiModel': { getGeminiModel: () => 'auto' },
    './rest': { userApiKey: key => key, resetChatSessions() {}, dialogKey: name => name,
      sendWithFallback: async (_name, session, prompt) => session === 'select' ? '{"characters":[],"direction":"복구 완료"}' : writer(prompt) },
  }).directClient;
  checked((await direct.createEvent('코유키', context)).eventScript);
  assert.equal(writerCalls.length, 2, 'mobile/direct path performs a single format repair');
  keepFailing = true; writerCalls = [];
  await assert.rejects(direct.createEvent('코유키', context), error => error.code === 'STORY_FORMAT_INVALID');
  assert.equal(writerCalls.length, 2);
  const controller = load('server/src/controllers/eventController.js', {
    '../services/geminiService': { GEMINI_MODEL: 'test', resetChatSessions() {}, getChat: async (_name, _model, session) => ({ sendMessage: async prompt => ({ response: { text: async () => session === 'select' ? '{"characters":[],"direction":"복구 완료"}' : writer(prompt) } }) }) },
    './chatController': { readKey: () => 'test-key' },
  });
  let status = 200, body;
  const res = { json: value => { body = value; return res; }, status: value => { status = value; return res; } };
  keepFailing = false; writerCalls = [];
  await controller.createEvent({ body: { character: '코유키', context, language: 'ko' } }, res);
  assert.equal(status, 200); checked(body.eventScript); assert.equal(writerCalls.length, 2);
  keepFailing = true; writerCalls = [];
  await controller.createEvent({ body: { character: '코유키', context, language: 'ko' } }, res);
  assert.equal(status, 502); assert.equal(body.code, 'STORY_FORMAT_INVALID'); assert.equal(body.eventScript, undefined);
  assert.equal(writerCalls.length, 2, 'Express refuses invalid scripts after one repair');
  const { geminiFailureText } = load('services/geminiClient/errors.ts', {});
  assert.match(geminiFailureText(Object.assign(new Error('STORY_FORMAT_INVALID'), { code: 'STORY_FORMAT_INVALID' })), /다시 생성/);
  console.log('PASS safe bracket/fence normalization, shared public validation, bounded repair, malformed output rejection, direct/Express integration and failure messaging');
})().catch(error => { console.error(error); process.exitCode = 1; });
