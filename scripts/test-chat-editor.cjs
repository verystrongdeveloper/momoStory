const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(file, mocks) {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', source)(id => {
    assert.ok(Object.hasOwn(mocks, id), `Unexpected import ${id}`);
    return mocks[id];
  }, mod, mod.exports);
  return mod.exports;
}
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'TouchableOpacity', 'ScrollView', 'Image'].map(name => [name, name]));
rn.StyleSheet = { create: value => value }; rn.Platform = { OS: 'web' };
const t = (key, values) => values?.index ? `${key}:${values.index}` : key;
const common = { react: React, 'react-native': rn, '@/i18n': { useI18n: () => ({ t, language: 'ko' }) } };
const ChatEditor = load('components/chat/ChatMessageEditor.tsx', common).default;
const button = (tree, label) => tree.root.findAllByType('TouchableOpacity').find(node => node.props.accessibilityLabel === label || node.findAllByType('Text').some(text => text.props.children === label));
let rows = [], listeners = new Set();
const library = load('store/storyLibrary.ts', {
  '@/storage': { loadStories: () => rows, saveStories: value => { rows = value; for (const notify of listeners) notify(); }, subscribeStorage: notify => { listeners.add(notify); return () => listeners.delete(notify); } },
  '../shared/prompts/speakerNames': { canonicalCharacterName: name => name },
});
const script = 'title : Test\n호시노 : Hello\nendEvent';
const messages = [{ sender: 'user', text: 'hello' }, { sender: 'character', text: 'reply', showImage: true }];
const initial = library.saveStory('호시노', script, messages);
library.updateStory(initial.id, script + '\n');
assert.deepEqual(rows[0].chatMessages, messages, 'old script-only callers preserve chat');
library.updateStory(initial.id, script, messages);
messages[0].text = 'external mutation';
assert.equal(rows[0].chatMessages[0].text, 'hello', 'saved chat is copied');
let compact = false;
const List = load('components/chat/StoryLibraryList.tsx', {
  ...common, '@expo/vector-icons': { Ionicons: 'Ionicons' }, '@/constants/characters': { avatarOf: () => 1, displayCharacterName: name => name },
  '@/hooks/useLayout': { useLayout: () => ({ isCompact: compact }) }, '@/components/chat/StoryAssetPanel': 'StoryAssetPanel',
  './VideoExportModal': 'VideoExportModal', '@/components/community/PublishStoryModal': 'PublishStoryModal', './StoryScriptEditor': 'StoryScriptEditor',
  './ChatMessageEditor': ChatEditor, '@/store/storyLibrary': library, '@/utils/insertStoryAsset': {}, '@/platform/clipboard': {}, '@/utils/storyFile': {}, '@/utils/storyPrompt': {},
  '@/components/CharacterAvatar': 'CharacterAvatar', '@/constants/eventAssets': { bgMap: {} }, '@/utils/parseEventScript': { __esModule: true, default: () => [] },
  './CharacterFilter': 'CharacterFilter', './Pagination': { __esModule: true, default: 'Pagination', PAGE_SIZE: 20 },
}).default;
(async () => {
  for (compact of [false, true]) {
    let tree;
    await React.act(async () => { tree = Renderer.create(React.createElement(List, { onOpenStory() {} })); });
    const openEdit = async () => {
      await React.act(async () => button(tree, 'storyMenu').props.onPress());
      await React.act(async () => button(tree, 'edit').props.onPress());
    };
    await openEdit();
    await React.act(async () => tree.root.findByType('StoryScriptEditor').props.onChangeText(script.replace('Test', 'Updated')));
    await React.act(async () => button(tree, 'editChat').props.onPress());
    assert.equal(tree.root.findAllByType('StoryAssetPanel').length, 0);
    const inputs = () => tree.root.findAllByType('TextInput');
    await React.act(async () => inputs()[0].props.onChangeText('edited\nmessage'));
    await React.act(async () => button(tree, 'chatEditorMoveUp:2').props.onPress());
    assert.deepEqual(inputs().map(node => node.props.value), ['reply', 'edited\nmessage']);
    await React.act(async () => tree.root.findByProps({ accessibilityRole: 'checkbox' }).props.onPress());
    await React.act(async () => button(tree, 'chatEditorAddCharacter').props.onPress());
    await React.act(async () => button(tree, 'save').props.onPress());
    assert.ok(tree.root.findAllByType('Text').some(node => node.props.children === 'chatEditorEmptyMessage'), 'blank messages block saving');
    await React.act(async () => inputs()[2].props.onChangeText('new reply'));
    await React.act(async () => button(tree, 'editStory').props.onPress());
    assert.ok(tree.root.findByType('StoryScriptEditor').props.value.includes('Updated'), 'story draft survives tab changes');
    await React.act(async () => button(tree, 'editChat').props.onPress());
    assert.equal(inputs()[0].props.value, 'reply', 'chat draft survives tab changes');
    await React.act(async () => button(tree, 'save').props.onPress());
    assert.ok(rows[0].script.includes('Updated'));
    assert.deepEqual(rows[0].chatMessages, [{ sender: 'character', text: 'reply', showImage: false }, { sender: 'user', text: 'edited\nmessage' }, { sender: 'character', text: 'new reply', showImage: true }]);
    assert.equal(rows[0].id, initial.id); assert.equal(rows[0].createdAt, initial.createdAt);
    const saved = JSON.stringify(rows);
    await openEdit();
    await React.act(async () => button(tree, 'editChat').props.onPress());
    await React.act(async () => inputs()[0].props.onChangeText('discard me'));
    await React.act(async () => button(tree, 'chatEditorUser').props.onPress());
    assert.equal(tree.root.findByType(ChatEditor).props.value[0].sender, 'user', 'message sender can be changed');
    await React.act(async () => button(tree, 'cancel').props.onPress());
    assert.equal(JSON.stringify(rows), saved, 'cancel leaves stored script and chat untouched');
    await openEdit();
    await React.act(async () => button(tree, 'editChat').props.onPress());
    while (inputs().length) await React.act(async () => button(tree, 'chatEditorDelete:1').props.onPress());
    await React.act(async () => button(tree, 'save').props.onPress());
    assert.deepEqual(rows[0].chatMessages, [], 'all chat can be removed');
    await React.act(async () => tree.unmount());
    library.updateStory(initial.id, script, [{ sender: 'user', text: 'hello' }, { sender: 'character', text: 'reply', showImage: true }]);
  }
  let tree;
  await React.act(async () => { tree = Renderer.create(React.createElement(List, { onOpenStory() {} })); });
  await React.act(async () => button(tree, 'createStory').props.onPress());
  await React.act(async () => button(tree, 'editChat').props.onPress());
  assert.equal(tree.root.findByType(ChatEditor).props.value.length, 0, 'new stories start without chat');
  await React.act(async () => button(tree, 'chatEditorAddUser').props.onPress());
  await React.act(async () => tree.root.findByType('TextInput').props.onChangeText('new story chat'));
  await React.act(async () => button(tree, 'save').props.onPress());
  assert.equal(rows.length, 1, 'new chat does not bypass the required story script');
  await React.act(async () => button(tree, 'editStory').props.onPress());
  await React.act(async () => tree.root.findByType('StoryScriptEditor').props.onChangeText(script));
  await React.act(async () => button(tree, 'save').props.onPress());
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].chatMessages, [{ sender: 'user', text: 'new story chat' }], 'new stories save chat with the script');
  await React.act(async () => tree.unmount());
  console.log('PASS desktop/mobile chat editor tabs, text/order/sender/avatar edits, add/delete, draft retention, atomic save, blank validation, cancel, new stories and script-only compatibility');
})().catch(error => { console.error(error); process.exitCode = 1; });
