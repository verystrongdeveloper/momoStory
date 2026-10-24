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
rn.Keyboard = { dismiss() {} };
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
let keyboardInset = 0;
const List = load('components/chat/StoryLibraryList.tsx', {
  ...common, '@expo/vector-icons': { Ionicons: 'Ionicons' }, '@/constants/characters': { avatarOf: () => 1, displayCharacterName: name => name },
  '@/hooks/useLayout': { useLayout: () => ({ isCompact: compact }) }, '@/components/chat/StoryAssetPanel': 'StoryAssetPanel',
  '@/hooks/useKeyboardInset': { useKeyboardInset: () => keyboardInset },
  './VideoExportModal': 'VideoExportModal', '@/components/community/PublishStoryModal': 'PublishStoryModal', './StoryScriptEditor': 'StoryScriptEditor',
  './ChatMessageEditor': ChatEditor, '@/store/temporaryChats': { getTemporaryChat: () => ({ clear() {}, getSnapshot: () => ({ isWaiting: false }) }) }, '@/services/geminiKey': { getGeminiKey: () => '' }, '../../shared/conversation': require('../shared/conversation'), '@/store/storyLibrary': library, '@/utils/insertStoryAsset': {}, '@/platform/clipboard': {}, '@/utils/storyFile': {}, '@/utils/storyPrompt': {},
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
    if (compact) {
      assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'roomTitle' }).length, 0, 'mobile opens with the room details collapsed');
      const beforeFocus = tree.root.findByType('StoryScriptEditor').props.value;
      await React.act(async () => { keyboardInset = 300; tree.root.findByType('StoryScriptEditor').props.onFocus(); });
      assert.equal(tree.root.findAllByProps({ accessibilityRole: 'tablist' }).length, 0, 'typing gives the tab bar space to the script');
      assert.equal(tree.root.findByType('StoryScriptEditor').props.keyboardVisible, true);
      assert.equal(tree.root.findByType('StoryScriptEditor').props.value, beforeFocus, 'keyboard changes never replace the draft');
      assert.ok(button(tree, 'save'), 'saving remains available above the keyboard');
      await React.act(async () => { keyboardInset = 0; tree.root.findByType('StoryScriptEditor').props.onBlur(); });
      assert.equal(tree.root.findAllByProps({ accessibilityRole: 'tablist' }).length, 1, 'tabs return after keyboard dismissal');
      await React.act(async () => button(tree, 'roomDetails').props.onPress());
      assert.equal(tree.root.findByProps({ accessibilityLabel: 'roomTitle' }).props.value, rows[0].title, 'room title remains editable on demand');
      await React.act(async () => button(tree, 'roomDetails').props.onPress());
    }
    await React.act(async () => tree.root.findByType('StoryScriptEditor').props.onChangeText(script.replace('Test', 'Updated')));
    await React.act(async () => button(tree, 'editChat').props.onPress());
    assert.equal(tree.root.findAllByType('StoryAssetPanel').length, 0);
    const inputs = () => tree.root.findAllByType('TextInput').filter(node => node.props.accessibilityLabel !== 'roomTitle');
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
  const room = library.appendRoomStory(initial.id, 'title : Episode two\n호시노 : Second\nendEvent', [{ sender: 'user', text: 'later chat' }, { sender: 'character', text: 'later reply' }]);
  const originalEpisodes = JSON.parse(JSON.stringify(library.episodesOf(room)));
  await React.act(async () => { tree = Renderer.create(React.createElement(List, { initialEdit: room, onOpenStory() {} })); });
  if (compact) await React.act(async () => button(tree, 'roomDetails').props.onPress());
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: 'roomTitle' }).props.onChangeText('Renamed room'));
  await React.act(async () => tree.root.findByType('StoryScriptEditor').props.onChangeText('title : Edited second\nendEvent'));
  const episodeTabs = () => tree.root.findAllByProps({ accessibilityRole: 'tab' }).filter(node => node.findAllByType('Ionicons').some(icon => icon.props.name === 'book-outline'));
  await React.act(async () => episodeTabs()[0].props.onPress());
  await React.act(async () => tree.root.findByType('StoryScriptEditor').props.onChangeText('title : Edited first\nendEvent'));
  await React.act(async () => episodeTabs()[1].props.onPress());
  assert.match(tree.root.findByType('StoryScriptEditor').props.value, /Edited second/, 'switching episodes preserves each draft');
  await React.act(async () => button(tree, 'save').props.onPress());
  const editedRoom = library.listStories().find(item => item.id === initial.id);
  assert.equal(editedRoom.title, 'Renamed room', 'room title is independent of episode titles');
  assert.match(editedRoom.episodes[0].script, /Edited first/);
  assert.match(editedRoom.episodes[1].script, /Edited second/);
  assert.deepEqual(editedRoom.episodes.map(item => item.chatMessages), originalEpisodes.map(item => item.chatMessages), 'editing scripts preserves historical chat snapshots');
  await React.act(async () => tree.unmount());
  const positionMessages = Array.from({ length: 6 }, (_, index) => ({ sender: index % 2 ? 'character' : 'user', text: 'message ' + index }));
  let positionRoom = library.saveStory('호시노', '', positionMessages.slice(0, 2));
  positionRoom = library.appendRoomStory(positionRoom.id, script, positionMessages.slice(0, 2));
  positionRoom = library.appendRoomStory(positionRoom.id, script.replace('Test', 'Next'), positionMessages.slice(0, 4));
  positionRoom = library.updateRoom(positionRoom.id, { chatMessages: positionMessages });
  await React.act(async () => { tree = Renderer.create(React.createElement(List, { initialEdit: positionRoom, initialStoryId: positionRoom.episodes[0].id, onOpenStory() {} })); });
  assert.match(tree.root.findByType('StoryScriptEditor').props.value, /title : Test/, 'inline menu opens the selected script');
  await React.act(async () => button(tree, 'editChat').props.onPress());
  assert.deepEqual(tree.root.findByType(ChatEditor).props.storyBreaks.map(item => item.afterMessageCount), [2, 4]);
  await React.act(async () => button(tree, 'chatEditorDelete:1').props.onPress());
  assert.deepEqual(tree.root.findByType(ChatEditor).props.storyBreaks.map(item => item.afterMessageCount), [1, 3], 'removing earlier chat keeps both story buttons with their surrounding conversations');
  await React.act(async () => tree.root.findByType(ChatEditor).props.onStoryPress(positionRoom.episodes[1].id));
  assert.match(tree.root.findByType('StoryScriptEditor').props.value, /title : Next/, 'chat editor story marker selects its own script');
  await React.act(async () => button(tree, 'save').props.onPress());
  const savedPositions = library.listStories().find(item => item.id === positionRoom.id);
  assert.deepEqual(savedPositions.episodes.map(item => item.afterMessageCount), [1, 3]);
  assert.deepEqual(savedPositions.episodes.map(item => item.chatMessages.length), [2, 4], 'historical snapshots are unchanged by timeline edits');
  await React.act(async () => tree.unmount());
  console.log('PASS desktop/mobile chat editor tabs, text/order/sender/avatar edits, add/delete, draft retention, atomic save, blank validation, cancel, new stories and script-only compatibility');
})().catch(error => { console.error(error); process.exitCode = 1; });
