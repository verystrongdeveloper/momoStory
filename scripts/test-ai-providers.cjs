const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, globals = {}) {
  const filename = path.join(root, file), localRequire = createRequire(filename), mod = { exports: {} };
  const source = fs.readFileSync(filename, 'utf8');
  const code = file.endsWith('.js') ? source : ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(id => Object.hasOwn(mocks, id) ? mocks[id] : localRequire(id), mod, mod.exports, ...Object.values(globals));
  return mod.exports;
}
(async () => {
  const policy = require('../shared/geminiModels');
  for (const id of ['openrouter:openrouter/free', 'openrouter:cognitivecomputations/dolphin-mistral-24b:free', 'venice:venice-uncensored', 'venice:auto']) assert.equal(policy.normalizeModel(id), id);
  for (const id of ['openrouter:', 'fake:model', 'venice:model?key=secret', 'openrouter:model\n']) assert.equal(policy.normalizeModel(id), 'auto');
  let selection = 'auto', secret = 'legacy-gemini-key', remember = false;
  const listeners = new Set(), emit = () => listeners.forEach(fn => fn());
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  const storage = { getApiKey: () => secret, getRememberApiKey: () => remember, saveApiKey: (value, next) => { secret = value; remember = next; emit(); }, subscribeStorage: subscribe };
  const keys = load('services/geminiKey.ts', { '@/storage': storage, './geminiModel': { getGeminiModel: () => selection } });
  assert.equal(keys.getGeminiKey(), 'legacy-gemini-key');
  selection = 'openrouter:auto'; assert.equal(keys.getGeminiKey(), '', 'never send the Gemini key to another provider');
  keys.setGeminiKey('router-key', true); assert.equal(keys.getGeminiKey(), 'router-key');
  selection = 'venice:auto'; assert.equal(keys.getGeminiKey(), ''); keys.setGeminiKey('venice-key');
  selection = 'auto'; assert.equal(keys.getGeminiKey(), 'legacy-gemini-key');
  keys.setGeminiKey('new-gemini-key', false); assert.equal(remember, false);
  selection = 'openrouter:auto'; assert.equal(keys.getGeminiKey(), 'router-key'); keys.setGeminiKey(''); assert.equal(keys.getGeminiKey(), '');
  selection = 'venice:auto'; assert.equal(keys.getGeminiKey(), 'venice-key');

  const listCalls = [];
  const providerPolicy = load('shared/aiProviders.js', {}, { fetch: async (url, options) => {
    listCalls.push({ url, options });
    return { ok: true, json: async () => ({ data: url.includes('venice') ? [{ id: 'chat-model', type: 'text' }, { id: 'image-model', type: 'image' }] : [
      { id: 'paid/model', name: 'Paid', architecture: { output_modalities: ['text'] }, pricing: { prompt: '1', completion: '1' } },
      { id: 'free/model:free', name: 'Free', architecture: { output_modalities: ['text'] }, pricing: { prompt: '0', completion: '0' } },
      { id: 'image/model', architecture: { output_modalities: ['image'] } },
      { id: 'batch/model:batch', architecture: { output_modalities: ['text'] } },
    ] }) };
  } });
  const models = await providerPolicy.listProviderModels('openrouter', 'router-key');
  assert.deepEqual(models.map(row => row.id), ['free/model:free', 'paid/model']); assert.equal(models[0].free, true);
  assert.equal(listCalls[0].options.headers.Authorization, 'Bearer router-key'); assert.ok(!listCalls[0].url.includes('router-key'));
  assert.deepEqual((await providerPolicy.listProviderModels('venice', 'venice-key')).map(row => row.id), ['chat-model']);

  const calls = []; let status = 200, finish = 'stop', suspended;
  const rest = load('services/geminiClient/rest.ts', {
    '../geminiModel': { getGeminiModel: () => selection }, './errors': { throwIfOffline() {} },
    '../../shared/geminiModels': { ...policy, modelOrder() { throw new Error('Must not discover Gemini models for other providers'); } },
  }, { fetch: async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    if (suspended) { const wait = suspended; suspended = undefined; await wait; }
    return { ok: status === 200, status, json: async () => ({ choices: [{ message: { content: 'reply' }, finish_reason: finish }] }) };
  } });
  selection = 'openrouter:auto';
  const send = (character = '호시노', signal) => rest.sendWithFallback(character, '', 'hello', undefined, 'router-key', 'en', 'bond', selection, signal);
  assert.equal(await send(), 'reply'); assert.equal(calls.at(-1).url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(calls.at(-1).body.model, 'openrouter/free'); assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer router-key');
  assert.ok(calls.at(-1).body.messages[0].content.includes('OUTPUT LANGUAGE: English.'));
  await send(); assert.deepEqual(calls.at(-1).body.messages.map(row => row.role), ['system', 'user', 'assistant', 'user']);
  selection = 'openrouter:paid/model'; status = 429; const before = calls.length;
  await assert.rejects(send(), /429/); assert.equal(calls.length, before + 1, 'no automatic switch or paid fallback');
  status = 200; await send(); assert.equal(calls.at(-1).body.messages.length, 6, 'failed requests never enter history');
  selection = 'venice:auto'; const beforeVenice = calls.length; await assert.rejects(send(), /Venice 모델/); assert.equal(calls.length, beforeVenice);
  selection = 'venice:chat-model'; await send('히나'); assert.equal(calls.at(-1).url, 'https://api.venice.ai/api/v1/chat/completions'); assert.equal(calls.at(-1).body.model, 'chat-model');
  for (const code of [401, 402, 404]) { status = code; await assert.rejects(send(), new RegExp(String(code))); }
  status = 200; finish = 'length'; await assert.rejects(send(), /길이 제한/); finish = 'stop';
  let release; suspended = new Promise(resolve => { release = resolve; });
  const controller = new AbortController(), pending = send('취소', controller.signal);
  const rejection = assert.rejects(pending, err => err.name === 'AbortError');
  controller.abort(); release(); await rejection; await send('취소'); assert.equal(calls.at(-1).body.messages.length, 2);
  const restored = { id: 'room', messages: [{ sender: 'user', text: 'previous' }, { sender: 'character', text: 'answer' }], scripts: [] };
  rest.restoreConversation('복원', 'router-key', 'bond', restored); await send('복원'); assert.equal(calls.at(-1).body.messages[1].content, 'previous');
  rest.resetChatSessions('복원', 'router-key'); await send('복원'); assert.equal(calls.at(-1).body.messages.length, 2);

  const transports = load('services/geminiClient/index.ts', {
    'react-native': { Platform: { OS: 'web' } }, './directClient': { directClient: {} }, './expressTransport': { expressTransport: {} }, './errors': {},
    '../geminiModel': { getGeminiModel: () => selection }, '../../platform/backgroundGeneration': { withBackgroundGeneration: fn => fn() },
  });
  assert.equal(transports.geminiTransport(), 'direct'); selection = 'auto'; assert.equal(transports.geminiTransport(), 'express');
  const errors = load('services/geminiClient/errors.ts'); assert.match(errors.geminiFailureText(Object.assign(new Error('Venice 요청 실패 (402)'), { code: 'AI_PROVIDER_ERROR' })), /402/);

  const React = require('react'), Renderer = require('react-test-renderer');
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const rn = Object.fromEntries(['Button', 'Switch', 'Text', 'TextInput', 'View', 'TouchableOpacity', 'ActivityIndicator', 'Modal', 'Pressable', 'ScrollView'].map(name => [name, name]));
  rn.StyleSheet = { create: styles => styles };
  const modelStore = { getGeminiModel: () => selection, subscribeGeminiModel: subscribe, setGeminiModel: value => { selection = value; emit(); } };
  const mocks = { react: React, 'react-native': rn, '@/i18n': { useI18n: () => ({ t: value => value }) }, '@/services/geminiKey': keys, '@/services/geminiModel': modelStore };
  const Field = load('components/layout/GeminiKeyField.tsx', mocks).default;
  secret = 'legacy-key'; selection = 'auto'; remember = false;
  let tree; await React.act(async () => { tree = Renderer.create(React.createElement(Field)); });
  const input = () => tree.root.findByType('TextInput');
  assert.equal(input().props.value, 'legacy-key');
  await React.act(async () => input().props.onChangeText('unsaved Gemini draft'));
  const radio = label => tree.root.findAllByType('TouchableOpacity').find(node => node.findByType('Text').props.children === label);
  await React.act(async () => radio('OpenRouter').props.onPress()); assert.equal(input().props.value, '', 'provider switch clears unsaved draft');
  await React.act(async () => input().props.onChangeText('ui-router-key'));
  await React.act(async () => tree.root.findByType('Button').props.onPress()); assert.equal(keys.getGeminiKey(), 'ui-router-key');
  await React.act(async () => modelStore.setGeminiModel('openrouter:paid/model'));
  await React.act(async () => radio('OpenRouter').props.onPress()); assert.equal(selection, 'openrouter:paid/model', 'current provider does not reset the model');
  await React.act(async () => radio('Gemini').props.onPress()); assert.equal(input().props.value, 'legacy-key');
  await React.act(async () => tree.unmount());
  selection = 'venice:auto';
  keys.setGeminiKey('ui-venice-key');
  const Picker = load('components/layout/GeminiModelPicker.tsx', {
    ...mocks, '@expo/vector-icons': { Ionicons: 'Ionicons' }, '@/shared/geminiModels': {},
    '../../shared/aiProviders': { ...providerPolicy, listProviderModels: async () => [{ id: 'chat-model', label: 'Venice model', free: false }] },
  }).default;
  await React.act(async () => { tree = Renderer.create(React.createElement(Picker)); });
  const button = label => tree.root.findAllByType('TouchableOpacity').find(node => node.props.accessibilityLabel === label);
  await React.act(async () => button('aiModel').props.onPress());
  assert.equal(button('geminiModelAuto'), undefined, 'Venice does not offer automatic paid model selection');
  await React.act(async () => modelStore.setGeminiModel('venice:old-model'));
  await React.act(async () => button('Venice model').props.onPress()); assert.equal(selection, 'venice:chat-model');
  await React.act(async () => tree.unmount());
  console.log('PASS provider selection, legacy and isolated credentials, model discovery/pricing/filter, auth/endpoints, language/history/reset, strict selection, quota/billing errors, truncation/cancellation, web transport');
})().catch(error => { console.error(error); process.exitCode = 1; });
