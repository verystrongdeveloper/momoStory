const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
function load(file, mocks = {}) {
  const absolute = path.resolve(__dirname, '..', file), req = createRequire(absolute), mod = { exports: {} };
  const source = fs.readFileSync(absolute, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(id => Object.hasOwn(mocks, id) ? mocks[id] : req(id), mod, mod.exports);
  return mod.exports;
}
const { parseStorySelection, keepAssetSpeakers } = require('../shared/prompts/characterList');
const assets = require('../shared/community/assets.json');
const { validatePublicStory } = load('shared/community/validation.ts');
const response = JSON.stringify({ characters: [null, {}, { name: 'Fubuki' }, { name: 'Unknown' }, { name: 'Hoshino' }, { name: '호시노' }, { name: 'ヒナ' }, { name: '마리' }], direction: '새 사건' });
assert.deepEqual(parseStorySelection('후부키', response).characters, [{ name: '호시노' }, { name: '히나' }]);
for (const raw of ['oops', '{broken}', 'null', '{"characters":{}}', '{"characters":[null,42]}']) {
  const parsed = parseStorySelection('후부키', raw);
  assert.deepEqual(parsed.characters, []); assert.ok(parsed.direction);
}
const rawScript = 'title : Test\n후부키 : hi [emotion : fubuki_default.png]\n호시노 : hi\n히나 : hi\n마리 : hi\nselection : (1)"hi" [speaker : Mari, dialogue : hello]\nnarration : End [emotion : mari_smile.png, bg : BG_AbydosCouncilRoom.jpg]\nemotion : mari_default.png\nendEvent';
const cast = ['후부키', '호시노', '히나'];
function check(script) {
  assert.ok(!/마리|Mari|mari_/.test(script), 'unselected dialogue, choice speaker and sprites must be removed');
  validatePublicStory({ clientId: 'test', title: 'Test', character: '후부키', script, chatMessages: [] }, assets);
}
for (const language of ['ko', 'en', 'ja', 'zh']) check(keepAssetSpeakers(rawScript, cast, language));
const history = Array.from({ length: 3 }, () => ({ user: 'hi', ai: 'hi' }));
(async () => {
  let eventPrompt, selectionPrompt;
  const direct = load('services/geminiClient/directClient.ts', {
    '../senseiMode': { getSenseiMode: () => 'mild' }, '../geminiModel': { getGeminiModel: () => 'auto' },
    '@/services/geminiKey': { getGeminiKey: () => 'test-key' }, '@/services/appLanguage': { getAppLanguage: () => 'ko' },
    './rest': { dialogKey: c => c, userApiKey: k => k, sendWithFallback: async (_c, session, prompt) => {
      if (session === 'select') { selectionPrompt = prompt; return response; }
      if (session === 'event') { eventPrompt = prompt; return rawScript; }
      return 'hi';
    } },
  }).directClient;
  await assert.rejects(direct.createEvent('후부키'), /최소 1쌍/);
  for (let count = 1; count <= 10; count++) {
    const reply = await direct.chat('후부키', `message ${count}`);
    assert.equal(reply.eventReady, true, 'generation is available after any completed pair');
    check((await direct.createEvent('후부키')).eventScript);
    assert.ok(selectionPrompt.includes(`최근 ${count}쌍`));
    for (let turn = 1; turn <= count; turn++) assert.ok(eventPrompt.includes(`message ${turn}`), 'current completed conversation reaches story generation');
  }
  assert.ok(eventPrompt.includes('등장 인물: 후부키, 호시노, 히나\n'));
  const controller = load('server/src/controllers/eventController.js', {
    '../services/geminiService': { GEMINI_MODEL: 'auto', getChat: async (_c, _m, session) => ({ sendMessage: async prompt => {
      if (session === 'event') eventPrompt = prompt;
      return { response: { text: () => session === 'select' ? response : rawScript } };
    } }) },
    './chatController': { getDialogHistory: () => history, readKey: () => 'test-key' },
  });
  let result, status;
  const res = { json: value => { result = value; }, status: value => { status = value; return res; } };
  for (let count = 0; count <= 10; count++) {
    history.splice(0, history.length, ...Array.from({ length: count }, () => ({ user: 'hi', ai: 'hi' })));
    status = 200;
    await controller.createEvent({ body: { character: '후부키' } }, res);
    if (count === 0) {
      assert.equal(status, 400); assert.match(result.error, /최소 1쌍/);
    } else {
      assert.equal(status, 200);
      check(result.eventScript);
      assert.deepEqual(result.selection.characters.map(c => c.name), cast.slice(1));
    }
  }
  console.log('PASS malformed selection fallback, supported unique cast capped at 3, dialogue/choice/sprite filtering, direct + Express outputs accepted by public validation');
})().catch(error => { console.error(error); process.exitCode = 1; });
