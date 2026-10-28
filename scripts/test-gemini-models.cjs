const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, globals = {}) {
  const absolute = path.join(root, file), mod = { exports: {} }, localRequire = createRequire(absolute);
  const source = fs.readFileSync(absolute, 'utf8');
  const code = /\.tsx?$/.test(file) ? ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText : source;
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(id => Object.hasOwn(mocks, id) ? mocks[id] : id === '../senseiMode' ? { getSenseiMode: () => 'mild' } : localRequire(id), mod, mod.exports, ...Object.values(globals));
  return mod.exports;
}
const model = id => ({ name: `models/${id}`, displayName: id, supportedGenerationMethods: ['generateContent'] });
(async () => {
  let calls = [];
  const policy = load('shared/geminiModels.js', {}, { fetch: async (url, options) => {
    calls.push({ url, options });
    if (options.headers['x-goog-api-key'] === 'bad') return { ok: false };
    const second = url.includes('pageToken=next');
    return { ok: true, json: async () => second ? { models: [model('gemini-4-argon'), model('gemini-4-flash-image'), model('gemini-4-flash-tts'), { ...model('gemini-4-embedding'), supportedGenerationMethods: ['embedContent'] }] } : {
      models: [model('gemini-3.8-flash'), model('gemini-3.1-flash-lite'), model('gemini-3.7-flash'), model('gemini-3.1-pro-preview')], nextPageToken: 'next',
    } };
  } });
  for (const value of [null, {}, '../gemini-bad', 'models/gemini-3.8-flash', 'gemini-3.7-flash', 'auto']) assert.equal(policy.normalizeModel(value), 'auto');
  assert.equal(policy.normalizeModel('gemini-4-argon'), 'gemini-4-argon');
  const [one, two] = await Promise.all([policy.listGeminiModels('key-a'), policy.listGeminiModels('key-a')]);
  assert.deepEqual(one, two); assert.equal(calls.length, 2, 'paginated discovery is shared by concurrent callers');
  assert.deepEqual(one.map(item => item.id), ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'], 'only current general-purpose models are exposed');
  assert.ok(calls.every(call => !call.url.includes('key-a')), 'credentials stay in headers');
  await policy.listGeminiModels('key-a'); assert.equal(calls.length, 2, 'metadata cache');
  const auto = await policy.modelOrder('key-a'); assert.ok(auto.every(id => id.includes('flash'))); assert.ok(auto.includes('gemini-3.7-flash'), 'automatic discovery remains independent from the shortened picker');
  policy.rememberModel('key-a', 'gemini-3.1-flash-lite');
  assert.equal((await policy.modelOrder('key-a'))[0], 'gemini-3.1-flash-lite');
  assert.deepEqual(await policy.modelOrder('key-a', 'gemini-4-argon'), ['gemini-4-argon']);
  assert.equal((await policy.modelOrder('key-a', 'auto', true))[0], 'gemini-3.8-flash');
  assert.equal((await policy.modelOrder('bad')).length, 4, 'discovery outage retains the existing automatic fallbacks');
  await policy.listGeminiModels('key-b'); assert.equal(calls.at(-1).options.headers['x-goog-api-key'], 'key-b');

  let selection = 'gemini-4-argon', status = 0, generation = [], orderCalls = [], delayedGeneration;
  const fakePolicy = { ...policy, modelOrder: async (_key, selected, force) => {
    orderCalls.push({ selected, force });
    return selected === 'auto' ? force ? ['gemini-5-flash'] : ['gemini-4-flash', 'gemini-3-flash'] : [selected];
  }, rememberModel() {} };
  const rest = load('services/geminiClient/rest.ts', {
    '../geminiModel': { getGeminiModel: () => selection }, '../../shared/geminiModels': fakePolicy, './errors': { throwIfOffline() {} },
  }, { fetch: async (url, options) => {
    const body = JSON.parse(options.body); generation.push({ url, body, signal: options.signal });
    if (delayedGeneration) { const waiting = delayedGeneration; delayedGeneration = undefined; await waiting; }
    const code = status; status = 0;
    return { ok: !code, status: code || 200, text: async () => code ? '{"error":{"message":"unavailable"}}' : '{"candidates":[{"content":{"parts":[{"text":"reply"}]}}]}' };
  } });
  const send = (character = '호시노', room = 'bond', session = '') => rest.sendWithFallback(character, session, 'hello', undefined, 'test-key', 'en', room);
  await send(); assert.ok(generation.at(-1).url.includes('gemini-4-argon:generateContent'));
  selection = 'gemini-3.8-flash'; await send(); assert.equal(generation.at(-1).body.contents.length, 3, 'manual model switch preserves chat');
  status = 503; const count = generation.length; await assert.rejects(send(), /unavailable/); assert.equal(generation.length, count + 1, 'manual mode never substitutes a model');
  selection = 'auto'; status = 404; await send();
  assert.ok(orderCalls.some(call => call.force)); assert.equal(generation.at(-1).body.contents.length, 5, 'fallback preserves confirmed history only');
  rest.resetChatSessions('호시노', 'test-key'); await send(); assert.equal(generation.at(-1).body.contents.length, 1);
  await send('히나'); assert.equal(generation.at(-1).body.contents.length, 1, 'character histories stay separate');
  await send('호시노', 'chat'); assert.equal(generation.at(-1).body.contents.length, 1, 'rooms stay separate');
  await send('호시노', 'bond', 'event'); assert.equal(generation.at(-1).body.contents.length, 1, 'story session stays separate');
  status = 403; const before = generation.length; await assert.rejects(send(), /unavailable/); assert.equal(generation.length, before + 1, 'auth failure does not cycle models');
  let releaseGeneration;
  delayedGeneration = new Promise(resolve => { releaseGeneration = resolve; });
  const directAbort = new AbortController();
  const canceledDirect = rest.sendWithFallback('cancel-direct', '', 'canceled message', undefined, 'test-key', 'en', 'bond', 'gemini-4-argon', directAbort.signal);
  const rejectedDirect = assert.rejects(canceledDirect, error => error.name === 'AbortError');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(generation.at(-1).signal, directAbort.signal, 'direct API fetch receives cancellation signal');
  directAbort.abort(); releaseGeneration(); await rejectedDirect;
  await send('cancel-direct');
  assert.equal(generation.at(-1).body.contents.length, 1, 'a late canceled reply never enters confirmed direct history');

  const sdkCalls = []; let sdkFailure = 0, delayedSdk;
  class SDK {
    getGenerativeModel(options) { return { startChat({ history }) {
      let failed = false; const log = history;
      return { getHistory: async () => { if (failed) throw new Error('poisoned SDK'); return log; }, sendMessage: async (text, requestOptions) => {
        sdkCalls.push({ model: options.model, history: [...log], signal: requestOptions?.signal });
        if (delayedSdk) { const waiting = delayedSdk; delayedSdk = undefined; await waiting; }
        if (sdkFailure) { failed = true; const status = sdkFailure; sdkFailure = 0; throw Object.assign(new Error('unavailable'), { status }); }
        log.push({ role: 'user', parts: [{ text }] }, { role: 'model', parts: [{ text: 'reply' }] }); return { response: { text: () => 'reply' } };
      } };
    } }; }
  }
  const server = load('server/src/services/geminiService.js', { '@google/generative-ai': { GoogleGenerativeAI: SDK }, '../../../shared/geminiModels': fakePolicy });
  const serverSend = async selected => (await server.getChat('호시노', undefined, '', undefined, 'server-key', 'en', 'bond', selected)).sendMessage('hello');
  await serverSend('gemini-4-argon'); sdkFailure = 503; await serverSend('auto');
  assert.equal(sdkCalls.at(-1).history.length, 2, 'server fallback survives rejected SDK history and keeps prior turns');
  assert.equal(sdkCalls.at(-1).model, 'gemini-3-flash');
  sdkFailure = 404; const sdkCount = sdkCalls.length; await assert.rejects(serverSend('gemini-4-argon')); assert.equal(sdkCalls.length, sdkCount + 1);
  server.resetChatSessions('호시노', 'server-key'); await serverSend('gemini-4-argon'); assert.equal(sdkCalls.at(-1).history.length, 0);
  let releaseSdk;
  delayedSdk = new Promise(resolve => { releaseSdk = resolve; });
  const serverAbort = new AbortController();
  const cancelChat = await server.getChat('cancel-server', undefined, '', undefined, 'server-key', 'en', 'bond', 'gemini-4-argon');
  const canceledServer = cancelChat.sendMessage('cancel me', { signal: serverAbort.signal });
  const rejectedServer = assert.rejects(canceledServer, error => error.name === 'AbortError');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sdkCalls.at(-1).signal, serverAbort.signal, 'Express forwards cancellation into the Gemini SDK');
  serverAbort.abort(); releaseSdk(); await rejectedServer;
  await cancelChat.sendMessage('retry');
  assert.equal(sdkCalls.at(-1).history.length, 0, 'aborted SDK history is discarded before retrying');
  const requests = [];
  const transport = load('services/geminiClient/expressTransport.ts', {
    '../geminiModel': { getGeminiModel: () => 'gemini-4-argon' }, '@/services/geminiKey': { getGeminiKey: () => 'key' }, '@/services/appLanguage': { getAppLanguage: () => 'en' }, './errors': { throwIfOffline() {} },
  }, { fetch: async (_url, options) => {
    requests.push(JSON.parse(options.body));
    if (options.signal) return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true }));
    return { ok: true, json: async () => ({}) };
  } }).expressTransport;
  await transport.trigger('호시노'); await transport.chat('호시노', 'hello'); await transport.createEvent('호시노');
  assert.ok(requests.every(request => request.model === 'gemini-4-argon'));
  const expressAbort = new AbortController();
  const canceledExpress = transport.chat('호시노', 'cancel', 'bond', undefined, expressAbort.signal);
  const rejectedExpress = assert.rejects(canceledExpress, error => error.name === 'AbortError');
  expressAbort.abort(); await rejectedExpress;
  // Closing an Express response cancels the upstream SDK and skips logs/output.
  let disconnectSignal, rejectDisconnected;
  const disconnectedService = {
    apiKeyFrom: () => 'key', keyId: () => 'key-id',
    getChat: async () => ({ sendMessage: (_message, options) => {
      disconnectSignal = options.signal;
      return new Promise((_resolve, reject) => { rejectDisconnected = reject; });
    } }),
  };
  const disconnectedChat = load('server/src/controllers/chatController.js', { '../services/geminiService': disconnectedService });
  const disconnectedTrigger = load('server/src/controllers/triggerController.js', {
    '../services/geminiService': disconnectedService, './chatController': disconnectedChat,
  });
  for (const handler of [disconnectedChat.sendChat, disconnectedTrigger.sendTrigger]) {
    const response = new (require('node:events').EventEmitter)();
    let outputs = 0;
    response.writableEnded = false;
    response.status = () => response; response.json = () => { outputs++; };
    const request = handler({ body: { character: 'disconnect-test', message: 'hello' } }, response);
    await new Promise(resolve => setImmediate(resolve));
    response.emit('close');
    assert.equal(disconnectSignal.aborted, true);
    rejectDisconnected(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await request;
    assert.equal(outputs, 0, 'closed requests have no late reply or error output');
    assert.equal(response.listenerCount('close'), 0, 'disconnect listeners are released');
  }
  assert.equal(disconnectedChat.chatLogs.size, 0);

  const rn = Object.fromEntries(['View', 'Text', 'TouchableOpacity', 'Pressable', 'Modal', 'ScrollView', 'ActivityIndicator'].map(name => [name, name])); rn.StyleSheet = { create: s => s };
  const listeners = new Set(); let key = '', chosen = 'auto', fail = false, forceCalls = [];
  const subscribe = callback => { listeners.add(callback); return () => listeners.delete(callback); };
  const Picker = load('components/layout/GeminiModelPicker.tsx', {
    react: React, 'react-native': rn, '@expo/vector-icons': { Ionicons: 'Ionicons' }, '@/i18n': { useI18n: () => ({ t: key => key }) },
    '@/services/geminiKey': { getGeminiKey: () => key, subscribeGeminiKey: subscribe },
    '@/services/geminiModel': { getGeminiModel: () => chosen, subscribeGeminiModel: subscribe, setGeminiModel: value => { chosen = value; listeners.forEach(fn => fn()); } },
    '@/shared/geminiModels': { listGeminiModels: async (_key, force) => { forceCalls.push(force); if (fail) throw new Error('offline'); return [{ id: 'gemini-4-argon', label: 'Gemini 4 Argon' }]; } },
  }).default;
  let tree; await React.act(async () => { tree = Renderer.create(React.createElement(Picker)); });
  const button = label => tree.root.findAllByType('TouchableOpacity').find(node => node.props.accessibilityLabel === label);
  await React.act(async () => button('aiModel').props.onPress());
  assert.ok(tree.root.findAllByType('Text').some(node => node.props.children === 'geminiModelKeyRequired'));
  await React.act(async () => { key = 'key'; listeners.forEach(fn => fn()); });
  await React.act(async () => button('Gemini 4 Argon').props.onPress()); assert.equal(chosen, 'gemini-4-argon');
  await React.act(async () => button('aiModel').props.onPress());
  fail = true; await React.act(async () => button('geminiModelRefresh').props.onPress()); assert.equal(forceCalls.at(-1), true);
  assert.ok(tree.root.findAllByType('Text').some(node => node.props.children === 'geminiModelFailed'));
  await React.act(async () => button('geminiModelAuto').props.onPress()); assert.equal(chosen, 'auto', 'automatic remains selectable after list failure');
  await React.act(async () => tree.unmount());
  console.log('PASS model discovery/pagination/filter/cache/key isolation, strict manual selection, automatic fallback/retirement refresh, direct and Express history/reset/room isolation, model picker/retry (mocked APIs)');
})().catch(error => { console.error(error); process.exitCode = 1; });
