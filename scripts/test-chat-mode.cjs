const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id === '../shared/geminiModels') return require('../shared/geminiModels');
    if (id === '../shared/senseiMode') return require('../shared/senseiMode');
    if (id.startsWith('.')) return load(path.relative(root, path.resolve(root, path.dirname(file), `${id}.ts`)), mocks);
    return require(id);
  }, mod, mod.exports);
  return mod.exports;
}
(async () => {
  const types = load('storage/types.ts');
  assert.equal('includeBondStory' in types.parsePreferences('{"greetMode":true,"includeBondStory":false}'), false, 'legacy mode setting is ignored');
  let raw = JSON.stringify({ ...types.DEFAULT_PREFERENCES, includeBondStory: false });
  const prefsMocks = {
    './types': types,
    '@react-native-async-storage/async-storage': { getItem: async () => raw, setItem: async (_key, value) => { raw = value; } },
  };
  global.localStorage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  for (const file of ['storage/preferencesStorage.ts', 'storage/preferencesStorage.web.ts']) {
    const preferences = load(file, prefsMocks);
    await preferences.savePreferences({ ...types.DEFAULT_PREFERENCES });
    assert.equal('includeBondStory' in await preferences.loadPreferences(), false, `${file}: no global room preference remains`);
  }
  const mocks = {
    './types': types,
    './secureStorage': { clearApiKey: async () => {}, loadApiKey: async () => '', saveApiKey: async () => {} },
    './preferencesStorage': { loadPreferences: async () => types.parsePreferences(raw), savePreferences: async value => { raw = JSON.stringify(value); } },
    './storyStorage': { readStoryRecords: async () => [], writeStoryRecords: async () => {} },
    './migrate': { migrateLegacyStorage: async () => true }, './prime': { readInitialSync: () => null },
  };
  const storage = load('storage/index.ts', mocks);
  await storage.hydrateStorage();
  assert.equal(storage.getSetting('greetMode'), false);
  storage.saveSetting('greetMode', true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(types.parsePreferences(raw).greetMode, true, 'other preferences still persist');
  assert.equal(types.parsePreferences('{}').geminiModel, 'auto', 'existing users default to automatic');
  assert.equal(types.parsePreferences('{}').senseiMode, 'mild');
  assert.equal(types.parsePreferences('{"senseiMode":"unknown"}').senseiMode, 'mild');
  storage.saveSetting('senseiMode', 'spicy');
  storage.saveSetting('geminiModel', 'gemini-4-argon');
  await new Promise(resolve => setImmediate(resolve));
  const restored = load('storage/index.ts', mocks);
  await restored.hydrateStorage();
  assert.equal(restored.getSetting('geminiModel'), 'gemini-4-argon', 'model selection survives restart');
  assert.equal(restored.getSetting('senseiMode'), 'spicy', 'Sensei mode survives restart');
  assert.equal(types.parsePreferences('{"geminiModel":"../invalid"}').geminiModel, 'auto');

  let resolveReply, rejectReply, resets = [];
  const transport = {
    chat: () => new Promise((resolve, reject) => { resolveReply = resolve; rejectReply = reject; }),
    reset: async character => { resets.push(character); },
    trigger: async () => ({ triggerLine: 'hello' }),
    createEvent: async () => ({ eventScript: 'story' }),
  };
  const { geminiClient } = load('services/geminiClient/index.ts', {
    'react-native': { Platform: { OS: 'android' } },
    './directClient': { directClient: transport }, './expressTransport': { expressTransport: transport }, './errors': {},
  });
  const oldReply = geminiClient.chat('Hoshino', 'old chat');
  const reset = geminiClient.reset('Hoshino');
  await geminiClient.reset('Hina');
  assert.deepEqual(resets, ['Hina'], 'a different character can reset independently');
  resolveReply({ reply: 'late answer', eventReady: true });
  await oldReply; await reset;
  assert.deepEqual(resets, ['Hina', 'Hoshino'], 'reset drains old requests before clearing AI memory');
  const failedReply = geminiClient.chat('Hoshino', 'failed chat');
  const afterFailure = geminiClient.reset('Hoshino');
  const caughtFailure = assert.rejects(failedReply, /offline/);
  rejectReply(new Error('offline'));
  await caughtFailure; await afterFailure;
  assert.equal(resets.length, 3, 'failed old requests do not prevent reset');
  const chatOnlyReply = geminiClient.chat('Hoshino', 'keep general chat', 'chat');
  await geminiClient.reset('Hoshino', 'bond');
  assert.equal(resets.length, 4, 'bond reset does not wait for another room');
  resolveReply({ reply: 'general chat', eventReady: false });
  await chatOnlyReply;
  console.log('PASS legacy mode ignored, preferences preserved, AI reset ordering and independent room requests');
})().catch(error => { console.error(error); process.exitCode = 1; });
