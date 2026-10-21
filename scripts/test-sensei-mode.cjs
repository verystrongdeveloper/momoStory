const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(file, mocks) {
  const absolute = path.resolve(__dirname, '..', file), mod = { exports: {} }, localRequire = createRequire(absolute);
  const source = fs.readFileSync(absolute, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(id => Object.hasOwn(mocks, id) ? mocks[id] : localRequire(id), mod, mod.exports);
  return mod.exports;
}
const { normalizeSenseiMode, senseiModeGuide } = require('../shared/senseiMode');
const { buildEventPromptPro } = require('../shared/prompts/promptBuilderPro');
const { buildSelectionPrompt } = require('../shared/prompts/selectionPromptBuilder');
const history = Array.from({ length: 3 }, () => ({ user: '도넛 사건의 범인은 바로 나다! 하하!', ai: '선생님도 참.' }));
const cast = [{ name: '후부키', emotions: ['fubuki_default.png'] }];
(async () => {
  for (const value of [null, {}, 'constructor', 'SPICY', undefined]) assert.equal(normalizeSenseiMode(value), 'mild');
  for (const mode of ['mild', 'spicy']) {
    for (const prompt of [buildSelectionPrompt(history, mode), buildEventPromptPro('후부키', history, cast, '도넛을 찾는다.', mode)]) {
      assert.ok(prompt.includes(senseiModeGuide(mode)), 'planning and writing share the same complete mode rules');
      assert.ok(prompt.includes(history[0].user));
    }
  }
  let mode = 'spicy', requests = [];
  const direct = load('services/geminiClient/directClient.ts', {
    '../senseiMode': { getSenseiMode: () => mode }, '../geminiModel': { getGeminiModel: () => 'auto' },
    '@/services/geminiKey': { getGeminiKey: () => 'test-key' }, '@/services/appLanguage': { getAppLanguage: () => 'ko' },
    './rest': { dialogKey: name => name, userApiKey: key => key, resetChatSessions() {}, sendWithFallback: async (_character, session, prompt) => {
      requests.push({ session, prompt });
      if (session === 'select') { mode = 'mild'; return '{"characters":[],"direction":"도넛을 찾는다."}'; }
      return session === 'event' ? 'title : Test\n후부키 : 안녕\nendEvent' : '선생님도 참.';
    } },
  }).directClient;
  for (const pair of history) await direct.chat('후부키', pair.user);
  await direct.createEvent('후부키');
  assert.ok(requests.filter(r => r.session).every(r => r.prompt.includes('[선생 모드: spicy]')), 'mode is captured before selection and survives a mid-request settings change');
  requests = [];
  await direct.createEvent('후부키');
  assert.ok(requests.filter(r => r.session).every(r => r.prompt.includes('[선생 모드: mild]')), 'next generation picks up the new setting');
  mode = 'spicy'; let posted;
  const transport = load('services/geminiClient/expressTransport.ts', {
    '../senseiMode': { getSenseiMode: () => mode }, '../geminiModel': { getGeminiModel: () => 'auto' },
    '@/services/geminiKey': { getGeminiKey: () => '' }, '@/services/appLanguage': { getAppLanguage: () => 'ko' },
    './errors': { throwIfOffline() {} },
  }).expressTransport;
  const oldFetch = global.fetch;
  try {
    global.fetch = async (_url, options) => { posted = JSON.parse(options.body); return { ok: true, json: async () => ({}) }; };
    await transport.createEvent('후부키'); assert.equal(posted.senseiMode, 'spicy');
  } finally { global.fetch = oldFetch; }
  requests = [];
  const controller = load('server/src/controllers/eventController.js', {
    '../services/geminiService': { getChat: async (_name, _model, session) => ({ sendMessage: async prompt => {
      requests.push({ session, prompt });
      return { response: { text: () => session === 'select' ? '{"characters":[],"direction":"도넛"}' : 'title : Test\n후부키 : 안녕\nendEvent' } };
    } }) },
    './chatController': { getDialogHistory: () => history, readKey: () => 'test-key' },
  });
  for (const value of ['spicy', 'invalid']) {
    requests = []; let result;
    await controller.createEvent({ body: { character: '후부키', senseiMode: value } }, { json: body => { result = body; }, status: () => { throw Error('Unexpected error response'); } });
    assert.ok(result.eventScript.includes('후부키'));
    assert.ok(requests.every(r => r.prompt.includes(`[선생 모드: ${normalizeSenseiMode(value)}]`)), 'Express normalizes incoming mode and applies it to both generation stages');
  }
  const listeners = new Set(); mode = 'mild';
  const Picker = load('components/layout/SenseiModePicker.tsx', {
    react: React, 'react-native': { StyleSheet: { create: v => v }, View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity' },
    '@/i18n': { useI18n: () => ({ t: key => key }) },
    '@/services/senseiMode': { getSenseiMode: () => mode, subscribeSenseiMode: fn => { listeners.add(fn); return () => listeners.delete(fn); }, setSenseiMode: value => { mode = value; listeners.forEach(fn => fn()); } },
  }).default;
  let tree;
  await React.act(async () => { tree = Renderer.create(React.createElement(Picker)); });
  const spicy = () => tree.root.findByProps({ accessibilityLabel: 'senseiModeSpicy' });
  assert.equal(spicy().props.accessibilityState.checked, false);
  await React.act(async () => spicy().props.onPress());
  assert.equal(spicy().props.accessibilityState.checked, true);
  assert.ok(tree.root.findAllByType('Text').some(node => node.props.children === 'senseiModeSpicyHint'));
  await React.act(async () => tree.unmount());
  console.log('PASS mild/spicy prompt policy, direct snapshot/next request, Express transport/controller normalization, settings selection and descriptions');
})().catch(error => { console.error(error); process.exitCode = 1; });
