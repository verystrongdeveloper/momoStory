const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

let compact = false;
const characters = ['Hoshino', 'Hina'].map(name => ({ name, displayName: { en: name }, displayStatus: { en: '' }, image: 1 }));
const rn = Object.fromEntries(['ActivityIndicator', 'Modal', 'ScrollView', 'Text', 'TouchableOpacity', 'View'].map(name => [name, name]));
rn.StyleSheet = { create: value => value };
const mocks = {
  react: React, 'react-native': rn, '@expo/vector-icons': { Ionicons: 'Ionicons' },
  './GreetModeToggle': 'GreetModeToggle', './StoryHeader': 'StoryHeader', './StorySidebar': 'StorySidebar', './SettingsPanel': 'SettingsPanel',
  '@/components/chat/ChatEntry': 'ChatEntry', '@/components/chat/CharacterChat': 'CharacterChat', '@/components/chat/StoryLibraryList': 'StoryLibraryList', '@/components/chat/ConversationRoom': 'ConversationRoom',
  '@/components/community/CommunityPanel': 'CommunityPanel', '@/components/guide/AppGuide': 'AppGuide',
  '@/constants/characters': { CHARACTERS: characters, avatarOf: () => 1, displayCharacterName: name => name },
  '@/hooks/useLayout': { useLayout: () => ({ isCompact: compact }) },
  '@/i18n': { useI18n: () => ({ language: 'en', t: key => key }) },
};
const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/layout/StoryContainer.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
new Function('require', 'module', 'exports', code)(id => {
  assert.ok(Object.hasOwn(mocks, id), `Unexpected import ${id}`);
  return mocks[id];
}, mod, mod.exports);

(async () => {
  for (compact of [false, true]) {
    let tree;
    await React.act(async () => { tree = Renderer.create(React.createElement(mod.exports.default)); });
    const profile = () => tree.root.findAllByType('ChatEntry')[0];
    const option = label => tree.root.findAllByType('TouchableOpacity').find(node => node.findAllByType('Text').some(text => text.props.children === label));
    await React.act(async () => profile().props.onSelect());
    assert.equal(tree.root.findAllByType('CharacterChat').length, 0, 'selecting a profile first asks for a room');
    await React.act(async () => option('cancel').props.onPress());
    assert.equal(tree.root.findAllByType('CharacterChat').length, 0);
    await React.act(async () => profile().props.onSelect());
    await React.act(async () => option('conversationChatOnly').props.onPress());
    assert.equal(tree.root.findByType('CharacterChat').props.room, 'chat');
    if (compact) await React.act(async () => tree.root.findByType('StoryHeader').props.onBack());
    await React.act(async () => profile().props.onSelect());
    await React.act(async () => option('conversationWithStory').props.onPress());
    assert.equal(tree.root.findByType('CharacterChat').props.room, 'bond');
    assert.ok(tree.root.findByType('StoryHeader').props.title.includes('conversationWithStory'));
    await React.act(async () => tree.unmount());
  }
  let greet = false;
  const greetListeners = new Set();
  const toggleModule = { exports: {} };
  const toggleCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/layout/GreetModeToggle.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', toggleCode)(id => id === 'react-native' ? { ...rn, Pressable: 'Pressable' } : id === '@/services/greetMode' ? {
    getGreetMode: () => greet,
    setGreetMode: value => { greet = value; greetListeners.forEach(listener => listener()); },
    subscribeGreetMode: listener => { greetListeners.add(listener); return () => greetListeners.delete(listener); },
  } : mocks[id], toggleModule, toggleModule.exports);
  let toggleTree;
  await React.act(async () => { toggleTree = Renderer.create(React.createElement(toggleModule.exports.default)); });
  const control = () => toggleTree.root.findByProps({ accessibilityRole: 'switch' });
  assert.equal(control().props.accessibilityState.checked, false);
  await React.act(async () => control().props.onPress());
  assert.equal(greet, true);
  assert.equal(control().props.accessibilityState.checked, true);
  await React.act(async () => control().props.onPress());
  assert.equal(greet, false);
  await React.act(async () => toggleTree.unmount());
  console.log('PASS desktop/mobile profile picker, cancel, chat/bond navigation, room title and accessible greeting toggle');
})().catch(error => { console.error(error); process.exitCode = 1; });
