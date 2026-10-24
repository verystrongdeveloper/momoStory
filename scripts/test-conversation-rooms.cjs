const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(file, mocks = {}) {
  const absolute = path.resolve(__dirname, '..', file), req = createRequire(absolute), mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('.') && fs.existsSync(path.resolve(path.dirname(absolute), id + '.ts'))) return load(path.resolve(path.dirname(absolute), id + '.ts'), mocks);
    return req(id);
  }, mod, mod.exports);
  return mod.exports;
}
const listeners = new Set();
let rows = [], pendingEvent, route;
const library = load('store/storyLibrary.ts', { '@/storage': {
  loadStories: () => rows,
  saveStories: next => { rows = next; for (const listener of listeners) listener(); },
  subscribeStorage: listener => { listeners.add(listener); return () => listeners.delete(listener); },
} });
const types = load('storage/types.ts');
const conversation = require('../shared/conversation');
const messages = [{ sender: 'user', text: 'first question' }, { sender: 'character', text: 'first reply', showImage: true }];
const firstScript = 'title : First\n호시노 : First event\nendEvent';
const draftRoom = library.saveStory('호시노', '', messages);
library.updateRoom(draftRoom.id, { title: 'Chat with Hoshino', episodes: [] });
library.appendRoomStory(draftRoom.id, firstScript, messages);
assert.equal(library.listStories().find(story => story.id === draftRoom.id).title, 'First', 'first generation replaces the temporary conversation title');
library.appendRoomStory(draftRoom.id, 'title : Later\n호시노 : hi\nendEvent', messages);
assert.equal(library.listStories().find(story => story.id === draftRoom.id).title, 'First', 'later generation preserves the first story title');
library.updateRoom(draftRoom.id, { title: 'My room name' });
library.appendRoomStory(draftRoom.id, 'title : Third\n호시노 : hi\nendEvent', messages);
assert.equal(library.listStories().find(story => story.id === draftRoom.id).title, 'My room name', 'later generation preserves a manually edited room name');
library.deleteStory(draftRoom.id);
const legacy = library.saveStory('호시노', firstScript, messages);
assert.equal(library.episodesOf(legacy).length, 1);
assert.equal(library.episodesOf(legacy)[0].id, legacy.id);
library.appendRoomStory(legacy.id, 'title : Second\n호시노 : Second event\nendEvent', [...messages, { sender: 'user', text: 'next' }, { sender: 'character', text: 'answer' }]);
assert.equal(rows.length, 1, 'one card holds both episodes');
assert.equal(rows[0].title, 'First', 'legacy room also retains its first title');
assert.deepEqual(library.episodesOf(rows[0])[0].chatMessages, messages, 'later chat never changes the first episode snapshot');
library.updateRoom(legacy.id, { title: 'Independent room title' });
assert.equal(rows[0].title, 'Independent room title');
assert.equal(library.publicationStory(rows[0]).id, legacy.id, 'republication retains the library card ID even after another episode is added');
assert.equal(library.publicationStory(rows[0], legacy.id).id, library.publicationStory(rows[0]).id, 'every episode and card menu publish to the same archive card');
assert.equal(library.publicationStory(rows[0], legacy.id).title, 'First', 'publishing an earlier story uses that story title');
assert.equal(library.publicationStory(rows[0]).title, 'Second', 'publishing from the card menu uses the latest story title');
assert.match(rows[0].script, /title : Second/);
const validation = load('shared/community/validation.ts');
const assets = require('../shared/community/assets.json');
const publicCopy = library.publicationStory(rows[0]);
assert.doesNotThrow(() => validation.validatePublicStory({ ...publicCopy, clientId: publicCopy.id }, assets), 'a room title different from its script title must still be publishable');
assert.equal(publicCopy.script, rows[0].script, 'publication preserves the selected script unchanged');
assert.match(rows[0].script, /title : Second/, 'preparing publication must not rename the local script');
const earlierPublicCopy = library.publicationStory(rows[0], legacy.id);
assert.doesNotThrow(() => validation.validatePublicStory({ ...earlierPublicCopy, clientId: earlierPublicCopy.id }, assets), 'an earlier inline story is publishable under its own title');
assert.equal(earlierPublicCopy.id, publicCopy.id, 'different story titles retain the same republication identity');
const koreanRoom = { ...rows[0], title: '케이와의 대화', episodes: [{ ...rows[0].episodes[0], script: '\r\n타이틀 ： 원래 제목\r\n호시노 : 안녕하세요\r\nendEvent' }] };
assert.doesNotThrow(() => validation.validatePublicStory({ ...library.publicationStory(koreanRoom), clientId: koreanRoom.id }, assets), 'Korean title lines, full-width colons and CRLF are accepted unchanged');
assert.equal(library.publicationStory(koreanRoom).title, '원래 제목', 'published title follows the actual script even if episode metadata is stale');
assert.match(koreanRoom.episodes[0].script, /원래 제목/, 'local story titles remain intact');
rows = types.parseStories(JSON.stringify(rows));
assert.equal(rows[0].episodes.length, 2, 'native and web sanitization retain episodes across restart');
assert.equal(rows[0].episodes[0].chatMessages.length, 2);
assert.equal(rows[0].episodes[1].afterMessageCount, 4, 'story button positions survive persistent storage');
const history = conversation.conversationHistory({ id: legacy.id, messages: rows[0].chatMessages, scripts: rows[0].episodes.map(item => item.script) });
assert.ok(history[0].parts[0].text.includes('First event') && history[0].parts[0].text.includes('Second event'));
assert.equal(conversation.dialogPairs(rows[0].chatMessages).length, 2);
assert.equal(conversation.conversationContext({ id: '../invalid' }), null);
const rn = Object.fromEntries(['View', 'Text', 'TouchableOpacity', 'ScrollView', 'Modal'].map(name => [name, name]));
rn.StyleSheet = { create: value => value };
const snapshot = { isWaiting: false };
const Room = load('components/chat/ConversationRoom.tsx', {
  react: React, 'react-native': rn, 'expo-router': { useRouter: () => ({ push: value => { route = value; } }) },
  '@/constants/characters': { avatarOf: () => 1, displayCharacterName: name => name },
  '@/store/storyLibrary': library,
  '@/store/temporaryChats': { getTemporaryChat: () => ({ subscribe: () => () => {}, getSnapshot: () => snapshot }) },
  '@/services/geminiKey': { subscribeGeminiKey: () => () => {}, getGeminiKey: () => 'key' },
  '@/store/eventStore': { setPendingEvent: script => { pendingEvent = script; } },
  '@/i18n': { useI18n: () => ({ language: 'en', t: key => key }) },
  './CharacterChat': 'CharacterChat', './StoryLibraryList': 'StoryLibraryList', './VideoExportModal': 'VideoExportModal',
  '@/components/community/PublishStoryModal': 'PublishStoryModal', '@/utils/storyFile': { downloadStory: async () => {} },
}).default;
const button = (tree, text) => tree.root.findAllByType('TouchableOpacity').find(node => node.findAllByType('Text').some(item => item.props.children === text));
(async () => {
  let serverPayload;
  const handler = load('supabase/functions/community/handler.ts', { '../../../shared/community/validation.ts': validation }).createCommunityHandler({
    authenticate: async () => '11111111-1111-4111-8111-111111111111', assets,
    rpc: async (_actor, _action, payload) => { serverPayload = payload; return { data: { id: 'published-post' }, error: null }; },
  });
  const response = await handler(new Request('https://example.com/community', {
    method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'publish', data: { ...publicCopy, clientId: publicCopy.id } }),
  }));
  assert.equal(response.status, 200, 'the real Edge Function validator accepts a renamed-room publication');
  assert.equal(serverPayload.title, publicCopy.title);
  assert.equal(serverPayload.clientId, legacy.id);
  assert.equal(serverPayload.title, 'Second');
  assert.match(serverPayload.script, /^title : Second/);
  let tree;
  const loadingChanges = [];
  const setGlobalLoading = value => loadingChanges.push(value);
  await React.act(async () => { tree = Renderer.create(React.createElement(Room, { story: rows[0], setGlobalLoading })); });
  assert.equal(tree.root.findByType('CharacterChat').props.setGlobalLoading, setGlobalLoading, 'library chat forwards generation loading to the shared overlay');
  assert.equal(tree.root.findByType('CharacterChat').props.conversation.id, legacy.id);
  assert.equal(tree.root.findByType('CharacterChat').props.savedStory, undefined, 'library opens live room, not replay');
  assert.equal(tree.root.findAllByProps({ accessibilityRole: 'tab' }).length, 0, 'live room has no numbered story tabs');
  await React.act(async () => tree.root.findByType('CharacterChat').props.onStoryActions(legacy.id));
  await React.act(async () => button(tree, 'communityPublish').props.onPress());
  const published = tree.root.findByType('PublishStoryModal').props.story;
  assert.equal(published.id, legacy.id);
  assert.deepEqual(published.chatMessages, types.sanitizeStories([legacy])[0].chatMessages, 'publishing an earlier story uses its original chat snapshot');
  await React.act(async () => tree.root.findByType('PublishStoryModal').props.onClose());
  await React.act(async () => library.appendRoomStory(legacy.id, 'title : Third\n호시노 : Third event\nendEvent', rows[0].chatMessages));
  assert.equal(tree.root.findByType('CharacterChat').props.conversation.episodes.length, 3);
  const thirdId = rows[0].episodes.at(-1).id;
  await React.act(async () => tree.root.findByType('CharacterChat').props.onStoryActions(thirdId));
  await React.act(async () => button(tree, 'editStory').props.onPress());
  assert.equal(tree.root.findByType('StoryLibraryList').props.initialStoryId, thirdId, 'inline story menu edits that exact script');
  await React.act(async () => tree.root.findByType('StoryLibraryList').props.onFinishEdit());
  assert.equal(tree.root.findByType('CharacterChat').props.conversation.id, legacy.id);
  await React.act(async () => tree.unmount());
  console.log('PASS legacy room migration, episode persistence and snapshots, live library room, episode selection/playback/publishing, append and room editing');
})().catch(error => { console.error(error); process.exitCode = 1; });
