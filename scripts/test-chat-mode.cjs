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
    if (id.startsWith('.')) return load(path.relative(root, path.resolve(root, path.dirname(file), `${id}.ts`)), mocks);
    return require(id);
  }, mod, mod.exports);
  return mod.exports;
}
(async () => {
  const types = load('storage/types.ts');
  assert.equal(types.parsePreferences(null).includeBondStory, true);
  assert.equal(types.parsePreferences('{"greetMode":true}').includeBondStory, true, 'existing installs retain story mode');
  let raw = JSON.stringify({ ...types.DEFAULT_PREFERENCES, includeBondStory: false });
  const prefsMocks = {
    './types': types,
    '@react-native-async-storage/async-storage': { getItem: async () => raw, setItem: async (_key, value) => { raw = value; } },
  };
  global.localStorage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  for (const file of ['storage/preferencesStorage.ts', 'storage/preferencesStorage.web.ts']) {
    const preferences = load(file, prefsMocks);
    await preferences.savePreferences({ ...types.DEFAULT_PREFERENCES, includeBondStory: false });
    assert.equal((await preferences.loadPreferences()).includeBondStory, false, `${file}: restart preserves chat-only mode`);
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
  assert.equal(storage.getSetting('includeBondStory'), false);
  storage.saveSetting('includeBondStory', true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(types.parsePreferences(raw).includeBondStory, true, 'settings persistence includes conversation mode');

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
  console.log('PASS conversation mode defaults, native/web persistence, storage hydration, and AI reset ordering after late or failed replies');
})().catch(error => { console.error(error); process.exitCode = 1; });
