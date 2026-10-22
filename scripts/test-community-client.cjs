const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function compile(file, mocks, globals = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), mod, mod.exports, ...Object.values(globals));
  return mod.exports;
}
(async () => {
  const validation = compile('shared/community/validation.ts', {});
  let sessions = 0, signIns = 0, creations = 0, appListeners = 0, authError = false;
  const requests = [], options = [];
  const mocks = {
    'react-native-url-polyfill/auto': {},
    '@react-native-async-storage/async-storage': { setItem() {}, getItem() {} },
    'react-native': { Platform: { OS: 'android' }, AppState: { currentState: 'active', addEventListener: () => { appListeners++; } } },
    '@supabase/supabase-js': { createClient: (_url, _key, value) => {
      creations++; options.push(value);
      return { auth: { getSession: async () => { sessions++; return { data: { session: null }, error: authError ? {} : null }; }, signInAnonymously: async () => { signIns++; return { data: { session: { access_token: 'session-token' } } }; }, startAutoRefresh() {}, stopAutoRefresh() {} } };
    } },
    '@/shared/community/assets.json': require('../shared/community/assets.json'),
    '@/shared/community/validation': validation,
  };
  const file = 'services/community/client.ts';
  const absent = compile(file, mocks, { process: { env: {} } });
  assert.equal(absent.communityConfigured(), false);
  await assert.rejects(() => absent.community.list({}), error => error.code === 'NOT_CONFIGURED');
  assert.equal(creations, 0, 'missing config must not create a broken auth client');
  let apiError = null;
  const connected = compile(file, mocks, {
    process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key' } },
    fetch: async (url, init) => {
      requests.push({ url, ...init, parsed: JSON.parse(init.body) });
      return { ok: !apiError, json: async () => apiError ? { error: apiError } : { data: [] } };
    },
  });
  await Promise.all([connected.community.list({ liked: false, query: '', offset: 0, sort: 'latest' }), connected.community.list({ liked: true, query: '', offset: 0, sort: 'latest' })]);
  assert.equal(creations, 1); assert.equal(sessions, 1); assert.equal(signIns, 1); assert.equal(appListeners, 1);
  assert.ok(options[0].auth.storage); assert.equal(options[0].auth.detectSessionInUrl, false);
  assert.equal(requests[0].headers.Authorization, 'Bearer session-token');
  assert.equal(requests[0].url, 'https://example.supabase.co/functions/v1/community');
  const story = { id: 'story-1', title: 'Hello', character: '호시노', script: 'title : Hello\n호시노 : hi\nendEvent', chatMessages: [{ sender: 'user', text: 'hi' }], apiKey: 'never-send', settings: { key: 'private' } };
  await connected.community.publish(story);
  const body = requests.at(-1).parsed;
  assert.equal(body.action, 'publish');
  assert.deepEqual(Object.keys(body.data).sort(), ['title', 'character', 'script', 'chatMessages', 'clientId'].sort());
  assert.equal(JSON.stringify(body).includes('never-send'), false);
  await connected.community.publish({ ...story, chatMessages: [] });
  const storyOnlyBody = requests.at(-1).parsed;
  assert.deepEqual(storyOnlyBody.data.chatMessages, [], 'story-only upload contains no saved chat');
  assert.equal(storyOnlyBody.data.script, story.script);
  assert.equal(storyOnlyBody.data.clientId, story.id, 'scope does not bypass duplicate-publication checks');
  assert.deepEqual(story.chatMessages, [{ sender: 'user', text: 'hi' }], 'upload does not mutate local chat');
  assert.throws(() => connected.community.publish({ ...story, script: 'invalid' }));
  apiError = 'RATE_LIMIT';
  await assert.rejects(() => connected.community.like('id', true), error => connected.communityErrorKey(error) === 'communityRateLimit');
  authError = true;
  await assert.rejects(() => connected.community.list({}), error => error.code === 'AUTH_FAILED');
  console.log('PASS missing setup, lazy persistent native session/single-flight auth, lifecycle registration, safe upload whitelist and server error handling');
})().catch(error => { console.error(error); process.exitCode = 1; });
