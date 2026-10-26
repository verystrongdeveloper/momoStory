const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
const appConfig = require('../app.json');
global.IS_REACT_ACT_ENVIRONMENT = true;
const constants = { expoConfig: { version: '9.8.7' } };
let calls = 0, resolveUpdate, failUpdate = false, opened, checkedVersion;
let backHandler;
let tutorialOpened = 0, termsOpened = 0;
const rn = { Keyboard: { dismiss() {} }, BackHandler: { addEventListener: (_event, handler) => { backHandler = handler; return { remove() { backHandler = undefined; } }; } }, Platform: { OS: 'android' }, StyleSheet: { create: value => value } };
for (const name of ['KeyboardAvoidingView', 'Pressable', 'ScrollView', 'Text', 'TouchableOpacity', 'View', 'Modal']) rn[name] = name;
const mocks = {
  './InAppUpdate': 'InAppUpdate',
  './NotificationSettings': 'NotificationSettings',
  './ScreenOrientationPicker': 'ScreenOrientationPicker',
  '@expo/vector-icons': { Ionicons: 'Ionicons' },
  'react': React, 'react-native': rn, 'expo-constants': constants,
  '../../app.json': appConfig, './GeminiKeyField': 'GeminiKeyField',
  './ChatSoundPicker': 'ChatSoundPicker',
  './GeminiModelPicker': 'GeminiModelPicker',
  './SenseiModePicker': 'SenseiModePicker',
  '@/platform/openExternalUrl': { openExternalUrl: async url => { opened = url; } },
  '@/services/appUpdate': { checkAppUpdate: async (version) => {
    checkedVersion = version;
    calls++;
    if (failUpdate) throw new Error('offline');
    return new Promise(resolve => { resolveUpdate = resolve; });
  } },
  '@/services/bgmVolume': { getBgmVolume: () => 1, subscribeBgmVolume: () => () => {} },
  '@/services/sfxVolume': { getSfxVolume: () => 1, subscribeSfxVolume: () => () => {} },
  '@/services/appLanguage': { APP_LANGUAGES: [] },
  '@/i18n': { useI18n: () => ({ language: 'ko', t: key => key }) },
  '@/services/chatSize': { useChatSize: () => 1 },
  '@/storage/types': { MIN_CHAT_SIZE: 0.7, MAX_CHAT_SIZE: 1.5 },
  '@/components/chat/chatSizeStyles': { makeChatSizeStyles: () => ({ bubble: {} }) },
};
const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/layout/SettingsPanel.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
new Function('require', 'module', 'exports', code)(id => {
  assert.ok(Object.hasOwn(mocks, id), `Unexpected import ${id}`);
  return mocks[id];
}, mod, mod.exports);
(async () => {
  for (const [platform, config, expected] of [
    ['android', { version: '9.8.7' }, '9.8.7'],
    ['android', null, appConfig.expo.version],
    // Metro's stale web manifest must not override the current source version.
    ['web', { version: '1.0.1' }, appConfig.expo.version],
    ['web', null, appConfig.expo.version],
  ]) {
    rn.Platform.OS = platform;
    constants.expoConfig = config;
    let tree;
    await React.act(async () => { tree = Renderer.create(React.createElement(mod.exports.default, { onOpenTutorial() { tutorialOpened++; }, onOpenTerms() { termsOpened++; } })); });
    const button = key => tree.root.findAllByType('TouchableOpacity').find(node => node.props.accessibilityLabel === key || node.findAllByType('Text').some(text => text.props.children === key));
    const open = async key => { await React.act(async () => button(key).props.onPress()); };
    const back = async () => { await open('settingsBack'); };
    assert.equal(tree.root.findAllByType('TouchableOpacity').length, 7, 'settings opens with seven categories');
    for (const component of ['NotificationSettings', 'ScreenOrientationPicker', 'ChatSoundPicker', 'SenseiModePicker', 'GeminiKeyField', 'GeminiModelPicker']) assert.equal(tree.root.findAllByType(component).length, 0, 'detail controls stay inside their category');
    await open('notifications');
    assert.equal(tree.root.findAllByType('NotificationSettings').length, 1);
    if (platform === 'android') {
      assert.equal(typeof backHandler, 'function');
      await React.act(async () => assert.equal(backHandler(), true));
      assert.equal(backHandler, undefined, 'hardware back listener is removed on the list');
    } else await back();
    await open('settingsDisplay');
    assert.equal(tree.root.findAllByType('ScreenOrientationPicker').length, 1);
    assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === 'chatSize'));
    await back();
    await open('sound');
    assert.equal(tree.root.findAllByType('ChatSoundPicker').length, 1);
    assert.equal(tree.root.findAllByType('SenseiModePicker').length, 0);
    await back();
    await open('settingsAI');
    for (const component of ['SenseiModePicker', 'GeminiKeyField', 'GeminiModelPicker']) assert.equal(tree.root.findAllByType(component).length, 1);
    await back();
    await open('language');
    assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === 'language'));
    await back();
    await open('guide');
    const previousTutorial = tutorialOpened, previousTerms = termsOpened;
    await open('howToUse'); await open('terms');
    assert.equal(tutorialOpened, previousTutorial + 1); assert.equal(termsOpened, previousTerms + 1);
    await back();
    await open('settingsAbout');
    const texts = tree.root.findAllByType('Text');
    assert.ok(texts.some(text => text.props.children === 'appVersion'));
    assert.ok(texts.some(text => text.props.children === expected && text.props.selectable));
    assert.equal(button('conversationChatOnly'), undefined, 'room selection belongs to the profile, not settings');
    const previous = calls;
    await React.act(async () => { button('checkUpdate').props.onPress(); button('checkUpdate').props.onPress(); });
    assert.equal(calls, previous + 1);
    assert.equal(checkedVersion, expected, 'update check must use the same version as the display');
    assert.equal(button('updateChecking').props.disabled, true);
    await React.act(async () => resolveUpdate({ available: true, version: '10.0.0', url: 'https://github.com/verystrongdeveloper/momoStory/releases/tag/v10.0.0' }));
    assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === 'updateAvailable'));
    await React.act(async () => button('openUpdateDownload').props.onPress());
    assert.equal(opened, 'https://github.com/verystrongdeveloper/momoStory/releases/tag/v10.0.0');
    await React.act(async () => button('checkUpdate').props.onPress());
    await React.act(async () => resolveUpdate({ available: false, version: '1.0.3', url: '' }));
    assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === 'updateCurrent'));
    failUpdate = true;
    await React.act(async () => button('checkUpdate').props.onPress());
    assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === 'updateCheckFailed'));
    failUpdate = false;
    await React.act(async () => tree.unmount());
  }
  console.log('PASS settings categories, detail isolation, button/hardware back, help actions, native version, stale web manifest and update UI');
})().catch(error => { console.error(error); process.exitCode = 1; });
