const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
const appConfig = require('../app.json');

global.IS_REACT_ACT_ENVIRONMENT = true;
const listeners = new Set();
let synced = true, termsAccepted = true, tutorialSeen = true;
let language = 'en', calls = [], opened = [], failOpen = false;
const constants = { expoConfig: { version: '1.0.1' } };
const rn = {
  Platform: { OS: 'web' }, StyleSheet: { create: value => value },
  Linking: { openURL: async url => { opened.push(url); if (failOpen) throw new Error('cannot open'); } },
};
for (const name of ['Modal', 'View', 'Text', 'TouchableOpacity']) rn[name] = name;
const mocks = {
  react: React, 'react-native': rn, 'expo-constants': constants, '../../app.json': appConfig,
  '@/i18n': { useI18n: () => ({ t: (key, values) => `${language}:${key}${values?.version ? ':' + values.version : ''}` }) },
  '@/storage': {
    isStorageSynced: () => synced,
    getSetting: key => key === 'termsAccepted' ? termsAccepted : tutorialSeen,
    subscribeStorage: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  },
  '@/services/appUpdate': { checkAppUpdate: (version, signal) => new Promise((resolve, reject) => { calls.push({ version, signal, resolve, reject }); }) },
};
const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/layout/StartupUpdatePrompt.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
new Function('require', 'module', 'exports', code)(id => {
  assert.ok(Object.hasOwn(mocks, id), `Unexpected import ${id}`);
  return mocks[id];
}, mod, mod.exports);
const Prompt = mod.exports.default;
const release = { available: true, version: '2.0.0', url: 'https://github.com/verystrongdeveloper/momoStory/releases/tag/v2.0.0' };
let tree;
const mount = async () => { await React.act(async () => { tree = Renderer.create(React.createElement(Prompt)); }); return calls.at(-1); };
const unmount = async () => { await React.act(async () => tree.unmount()); assert.equal(listeners.size, 0); };
const button = key => tree.root.findAllByType('TouchableOpacity').find(node => node.findAllByType('Text').some(text => text.props.children === `${language}:${key}`));
const emit = async () => { await React.act(async () => { for (const listener of [...listeners]) listener(); }); };

(async () => {
  // Same and newer installed versions produce no startup UI; errors are silent too.
  for (const result of [{ available: false, version: appConfig.expo.version }, { available: false, version: '1.0.0' }, new Error('offline'), new Error('timeout'), new Error('HTTP 403')]) {
    const request = await mount();
    assert.equal(request.version, appConfig.expo.version, 'web uses bundled version, not a stale Metro manifest');
    assert.equal(tree.toJSON(), null, 'no checking indicator or startup modal while pending');
    await React.act(async () => result instanceof Error ? request.reject(result) : request.resolve(result));
    assert.equal(tree.toJSON(), null);
    await unmount();
    assert.equal(request.signal.aborted, true);
  }
  let request = await mount();
  await React.act(async () => request.resolve(release));
  assert.ok(button('openUpdateDownload'));
  assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === 'en:updateAvailable:2.0.0'));
  const count = calls.length;
  language = 'ko';
  await React.act(async () => tree.update(React.createElement(Prompt)));
  assert.equal(calls.length, count, 'language changes do not recheck or duplicate prompts');
  assert.ok(button('updateLater'));
  await React.act(async () => button('updateLater').props.onPress());
  assert.equal(tree.toJSON(), null);
  await emit();
  assert.equal(tree.toJSON(), null, 'dismissed prompt stays closed this run');
  await unmount();

  // A release found during startup waits for saved preferences and onboarding.
  synced = false; termsAccepted = false; tutorialSeen = false;
  request = await mount();
  await React.act(async () => request.resolve(release));
  assert.equal(tree.toJSON(), null);
  synced = true; await emit(); assert.equal(tree.toJSON(), null);
  termsAccepted = true; await emit(); assert.equal(tree.toJSON(), null);
  tutorialSeen = true; await emit(); assert.ok(button('openUpdateDownload'));
  failOpen = true;
  await React.act(async () => button('openUpdateDownload').props.onPress());
  assert.ok(tree.root.findAllByType('Text').some(text => text.props.accessibilityRole === 'alert'));
  failOpen = false;
  const previousOpens = opened.length;
  await React.act(async () => { button('openUpdateDownload').props.onPress(); button('openUpdateDownload').props.onPress(); });
  assert.equal(opened.length, previousOpens + 1);
  assert.equal(opened.at(-1), release.url);
  assert.equal(tree.toJSON(), null);
  await unmount();

  // Native builds use their embedded manifest, with the bundled config as fallback.
  rn.Platform.OS = 'android';
  for (const config of [{ version: '1.0.2' }, null]) {
    constants.expoConfig = config;
    request = await mount();
    assert.equal(request.version, config?.version ?? appConfig.expo.version);
    await React.act(async () => request.resolve(release));
    await React.act(async () => tree.root.findByType('Modal').props.onRequestClose());
    assert.equal(tree.toJSON(), null, 'system back closes the optional update prompt');
    await unmount();
  }
  request = await mount();
  await unmount();
  assert.equal(request.signal.aborted, true);
  await React.act(async () => request.resolve(release));
  console.log('PASS startup update: silent current/newer/offline/timeout/errors, version sources, onboarding gating, localized modal, dismissal, trusted download, duplicate taps, link retry, unmount cancellation');
})().catch(error => { console.error(error); process.exitCode = 1; });
