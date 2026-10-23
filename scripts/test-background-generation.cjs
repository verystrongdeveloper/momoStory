const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    assert.ok(Object.hasOwn(mocks, id), `Unexpected import ${id}`);
    return mocks[id];
  }, mod, mod.exports);
  return mod.exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const active = new Set();
  let serial = 0, beginError, endError;
  const events = [];
  const native = {
    async begin() {
      if (beginError) throw beginError;
      const token = String(++serial); active.add(token); events.push(`begin:${token}`); return token;
    },
    async end(token) {
      active.delete(token); events.push(`end:${token}`);
      if (endError) throw endError;
    },
  };
  const rn = { Platform: { OS: 'android' }, NativeModules: { MomoBackgroundGeneration: native } };
  const { withBackgroundGeneration } = load('platform/backgroundGeneration.ts', { 'react-native': rn });
  const first = deferred(), second = deferred();
  const a = withBackgroundGeneration(async () => { assert.equal(active.size, 2); return first.promise; });
  const b = withBackgroundGeneration(() => second.promise);
  await flush(); assert.equal(active.size, 2);
  first.resolve('reply'); assert.equal(await a, 'reply'); assert.equal(active.size, 1, 'One finished room must not stop another');
  const offline = new Error('network lost'); second.reject(offline);
  await assert.rejects(b, error => error === offline); assert.equal(active.size, 0, 'Network failure releases the service');
  endError = new Error('cleanup failed');
  assert.equal(await withBackgroundGeneration(async () => 'complete'), 'complete', 'Cleanup failure cannot lose a reply');
  await assert.rejects(withBackgroundGeneration(async () => { throw offline; }), error => error === offline);
  endError = undefined;
  beginError = new Error('OS denied background start'); let executed = false;
  await assert.rejects(withBackgroundGeneration(async () => { executed = true; }), error => error === beginError);
  assert.equal(executed, false, 'Do not dispatch a paid API request when service startup fails');
  beginError = undefined;

  const selector = deferred(), writer = deferred();
  const transport = {
    reset: async () => {}, trigger: async () => ({ triggerLine: 'hi' }), chat: async () => ({ reply: 'hi' }),
    async createEvent() {
      events.push('select'); await selector.promise;
      assert.equal(active.size, 1, 'The same lease must span selection and writing in background');
      events.push('write'); await writer.promise; return { eventScript: 'story' };
    },
  };
  const { geminiClient } = load('services/geminiClient/index.ts', {
    'react-native': rn, './directClient': { directClient: transport },
    './expressTransport': { expressTransport: transport }, './errors': {},
    '../../platform/backgroundGeneration': { withBackgroundGeneration },
  });
  const before = serial;
  const story = geminiClient.createEvent('히나'); await flush();
  assert.equal(active.size, 1); assert.equal(serial, before + 1);
  selector.resolve(); await flush(); assert.equal(events.at(-1), 'write'); assert.equal(active.size, 1);
  writer.resolve(); assert.deepEqual(await story, { eventScript: 'story' }); assert.equal(active.size, 0);
  await geminiClient.reset('히나'); assert.equal(serial, before + 1, 'Reset does not start a generation service');
  for (const method of ['trigger', 'chat']) { await geminiClient[method]('히나', 'hello'); assert.equal(active.size, 0); }
  assert.equal(serial, before + 3, 'Both greeting and regular chat acquire a lease');
  rn.Platform.OS = 'ios';
  assert.equal(await withBackgroundGeneration(async () => 'ios'), 'ios'); assert.equal(serial, before + 3);
  rn.Platform.OS = 'android'; delete rn.NativeModules.MomoBackgroundGeneration;
  assert.equal(await withBackgroundGeneration(async () => 'expo-go'), 'expo-go');
  const web = load('platform/backgroundGeneration.web.ts', {});
  assert.equal(await web.withBackgroundGeneration(async () => 'web'), 'web');
  console.log('PASS concurrent room lifetimes, startup failure, network/cleanup errors, whole-story lease, greeting/chat/reset, iOS/Expo Go/web fallback');
})().catch(error => { console.error(error); process.exitCode = 1; });
