const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const absolute = path.resolve(root, file), mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    const base = id.startsWith('@/') ? path.join(root, id.slice(2)) : id.startsWith('.') ? path.resolve(path.dirname(absolute), id) : null;
    if (base) for (const ext of ['.ts', '.tsx']) if (fs.existsSync(base + ext)) return load(base + ext, mocks);
    return createRequire(absolute)(id);
  }, mod, mod.exports);
  return mod.exports;
}

(async () => {
  const types = load('storage/types.ts');
  for (const raw of [null, '{}', '{broken', '{"screenOrientation":"auto"}', '{"screenOrientation":true}']) {
    assert.equal(types.parsePreferences(raw).screenOrientation, 'portrait', 'old and invalid settings must lock portrait');
  }
  assert.equal(types.parsePreferences('{"screenOrientation":"landscape"}').screenOrientation, 'landscape');
  let persisted = { ...types.DEFAULT_PREFERENCES, screenOrientation: 'landscape' };
  const storageMocks = {
    './preferencesStorage': { loadPreferences: async () => persisted, savePreferences: async value => { persisted = value; } },
    './secureStorage': { loadApiKey: async () => '', clearApiKey: async () => {}, saveApiKey: async () => {} },
    './storyStorage': { readStoryRecords: async () => [], writeStoryRecords: async () => {} },
    './migrate': { migrateLegacyStorage: async () => true }, './prime': { readInitialSync: () => null },
  };
  const storage = load('storage/index.ts', storageMocks);
  assert.equal(storage.getSetting('screenOrientation'), 'portrait');
  await storage.hydrateStorage();
  assert.equal(storage.getSetting('screenOrientation'), 'landscape', 'saved mode restores after hydration');
  for (const invalid of ['auto', '', true, 1]) storage.saveSetting('screenOrientation', invalid);
  assert.equal(storage.getSetting('screenOrientation'), 'landscape');
  storage.saveSetting('screenOrientation', 'portrait');
  assert.equal(persisted.screenOrientation, 'portrait');
  const reloaded = load('storage/index.ts', storageMocks);
  await reloaded.hydrateStorage();
  assert.equal(reloaded.getSetting('screenOrientation'), 'portrait', 'portrait survives restart');

  const orientation = load('services/screenOrientation.ts', { '@/storage': storage });
  const native = { Platform: { OS: 'android' }, StyleSheet: { create: styles => styles }, Text: 'Text', View: 'View', TouchableOpacity: 'TouchableOpacity' };
  const Stack = props => React.createElement('Stack', props);
  Stack.Screen = 'StackScreen';
  const mocks = {
    react: React, 'react-native': native,
    'expo-router': { Stack, Redirect: 'Redirect' },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    'react-native-reanimated': {},
    '@/storage': storage, '@/services/screenOrientation': orientation,
    '@/hooks/useSelectionFont': { useSelectionFont() {} },
    '@/platform/pwa': { registerAppShell() {} },
    '@/i18n': { I18nProvider: 'I18nProvider', useI18n: () => ({ t: key => key }) },
    '@/components/layout/StartupUpdatePrompt': 'StartupUpdatePrompt',
    '@/components/layout/VideoExportHost': 'VideoExportHost',
    '@/components/layout/NotificationHost': 'NotificationHost',
    '@/components/event/EventPlayer': 'EventPlayer',
    '@/store/eventStore': { consumePendingEvent: () => ({ script: 'title : Test\nendEvent' }) },
  };
  const Root = load('app/_layout.tsx', mocks).default;
  const Picker = load('components/layout/ScreenOrientationPicker.tsx', mocks).default;
  const Event = load('app/event.tsx', mocks).default;
  for (const platform of ['android', 'ios']) {
    native.Platform.OS = platform;
    orientation.setScreenOrientation('portrait');
    let tree, picker, event;
    await React.act(async () => {
      tree = Renderer.create(React.createElement(Root));
      picker = Renderer.create(React.createElement(Picker));
    });
    const stackMode = () => tree.root.findByType('Stack').props.screenOptions.orientation;
    const storyMode = () => tree.root.findAllByType('StackScreen').find(screen => screen.props.name === 'event').props.options.orientation;
    const choice = label => picker.root.findAllByType('TouchableOpacity').find(button => button.findByType('Text').props.children === label);
    assert.equal(stackMode(), 'portrait_up', 'all routes start with a portrait lock');
    assert.equal(storyMode(), 'portrait_up', 'story playback defaults to portrait');
    assert.equal(choice('screenPortrait').props.accessibilityState.checked, true);
    await React.act(async () => { event = Renderer.create(React.createElement(Event)); });
    assert.equal(stackMode(), 'portrait_up', 'entering a story must not unlock rotation');
    await React.act(async () => choice('screenLandscape').props.onPress());
    assert.equal(stackMode(), 'portrait_up', 'settings and other routes must stay in portrait');
    assert.equal(storyMode(), 'landscape', 'only story playback uses the selected landscape mode');
    assert.equal(persisted.screenOrientation, 'landscape');
    assert.equal(choice('screenLandscape').props.accessibilityState.checked, true);
    await React.act(async () => event.unmount());
    assert.equal(stackMode(), 'portrait_up', 'leaving a story restores the portrait route lock');
    assert.equal(storyMode(), 'landscape', 'leaving a story must preserve its selected mode');
    await React.act(async () => { tree.unmount(); tree = Renderer.create(React.createElement(Root)); });
    assert.equal(stackMode(), 'portrait_up', 'reopening the app with landscape saved keeps other routes in portrait');
    assert.equal(storyMode(), 'landscape', 'reopening the app restores landscape for story playback only');
    await React.act(async () => choice('screenPortrait').props.onPress());
    assert.equal(stackMode(), 'portrait_up');
    assert.equal(storyMode(), 'portrait_up');
    await React.act(async () => { tree.unmount(); picker.unmount(); });
  }
  orientation.setScreenOrientation('landscape');
  const landscapeReload = load('storage/index.ts', storageMocks);
  await landscapeReload.hydrateStorage();
  assert.equal(landscapeReload.getSetting('screenOrientation'), 'landscape', 'landscape also survives restart');
  native.Platform.OS = 'web';
  let web;
  await React.act(async () => { web = Renderer.create(React.createElement(Picker)); });
  assert.equal(web.toJSON(), null, 'browsers must not expose a native-only control');
  await React.act(async () => web.unmount());

  const translations = load('i18n/screenOrientation.ts').screenOrientationTranslations;
  for (const language of ['ko', 'en', 'ja', 'zh']) for (const key of ['screenOrientation', 'screenPortrait', 'screenLandscape', 'screenOrientationHint']) assert.ok(translations[language][key]);
  const config = require('../app.json').expo;
  assert.equal(config.orientation, 'default', 'iOS native build must permit both orientations');
  assert.equal(config.ios.requireFullScreen, true);
  assert.deepEqual(config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-screen-orientation')[1], { initialOrientation: 'PORTRAIT_UP' });
  console.log('PASS portrait default, invalid/legacy preferences, hydration, persistence, native settings, story-only route locks, story enter/exit, web exclusion and four languages');
})().catch(error => { console.error(error); process.exitCode = 1; });
