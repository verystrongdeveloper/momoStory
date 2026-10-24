const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

let apiKey = 'test-key', greet = false, chatCalls = [], triggerCalls = [], resetCalls = [], eventCalls = [], savedStories = [], failSave = false;
const pending = queue => new Promise((resolve, reject) => queue.push({ resolve, reject }));
const timers = new Map();
let timerId = 0;
const appStateListeners = new Set();
const rn = { StyleSheet: { create: value => value }, Keyboard: { addListener: () => ({ remove() {} }) }, AppState: { currentState: 'active', addEventListener: (_event, listener) => { appStateListeners.add(listener); return { remove: () => appStateListeners.delete(listener) }; } } };
const temporaryModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../store/temporaryChats.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(temporaryModule, temporaryModule.exports);
const temporaryChats = temporaryModule.exports;
const eventModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../store/eventStore.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(eventModule, eventModule.exports);
const eventStore = eventModule.exports;
let storedRows = [];
const libraryModule = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../store/storyLibrary.ts'), 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(id => id === '@/storage' ? { loadStories: () => storedRows, saveStories: rows => { storedRows = rows; }, subscribeStorage: () => () => {} } : require('../shared/prompts/speakerNames'), libraryModule, libraryModule.exports);
const library = libraryModule.exports;
const testLibrary = { ...library, saveStory(...args) { return library.saveStory(...args); }, appendRoomStory(...args) {
 if (failSave) throw new Error('save failed');
 const result = library.appendRoomStory(...args); savedStories.push([result.character, args[1], args[2]]); return result;
} };

for (const name of ['Button', 'FlatList', 'Image', 'Modal', 'Pressable', 'Text', 'TextInput', 'TouchableOpacity', 'View']) rn[name] = name;
const mocks = {
  react: React, 'react-native': rn, 'expo-router': { useRouter: () => ({ push() {} }), useFocusEffect: callback => React.useEffect(callback, [callback]) }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
  '@/services/geminiClient': { geminiClient: { chat: (...args) => { const result = pending(chatCalls); chatCalls.at(-1).args = args; return result; }, trigger: () => pending(triggerCalls), reset: () => pending(resetCalls), createEvent: (...args) => { const result = pending(eventCalls); eventCalls.at(-1).args = args; return result; } }, geminiFailureText: () => 'API error' },
  '@/services/geminiKey': { getGeminiKey: () => apiKey, subscribeGeminiKey: () => () => {} },
  '@/services/greetMode': { getGreetMode: () => greet },
  '@/store/eventStore': eventStore, '@/store/storyLibrary': testLibrary,
  '@/store/temporaryChats': temporaryChats,
  '@/services/chatSize': { useChatSize: () => 1 }, './chatSizeStyles': { makeChatSizeStyles: () => ({}) },
  '@/components/CharacterAvatar': 'CharacterAvatar',
  '@/i18n': { useI18n: () => ({ t: key => key }) },
  '@/utils/splitChatReply': { splitChatReply: text => text ? text.split('|') : [] },
  '@/hooks/useChatPop': () => {},
  '../../shared/conversation': require('../shared/conversation'),
};
const mod = { exports: {} };
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/chat/CharacterChat.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', source)(id => {
  assert.ok(Object.hasOwn(mocks, id), `Unexpected import ${id}`);
  return mocks[id];
}, mod, mod.exports, (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; }, id => timers.delete(id));
const Chat = mod.exports.default;
let tree;
const mount = async props => { await React.act(async () => { tree = Renderer.create(React.createElement(Chat, { characterName: '호시노', ...props })); }); };
const unmount = async () => { await React.act(async () => tree.unmount()); timers.clear(); };
const input = () => tree.root.findByType('TextInput');
const send = () => tree.root.findAllByType('Button').find(node => node.props.title === 'send');
const refresh = () => tree.root.findByProps({ accessibilityLabel: 'refreshChat' });
const confirmReset = () => tree.root.findAllByType('Button').find(node => node.props.title === 'refreshChat');
const locked = value => { assert.equal(input().props.editable, !value); assert.equal(send().props.disabled, value); };
const type = async text => { await React.act(async () => input().props.onChangeText(text)); };
const delay = async () => {
  const timer = [...timers].find(([, value]) => value.ms === 1500);
  assert.ok(timer, 'expected sentence typing delay');
  timers.delete(timer[0]);
  await React.act(async () => timer[1].fn());
};

let completed = false;
process.once('beforeExit', () => { if (!completed) { console.error('FAIL unfinished async chat test'); process.exitCode = 1; } });
(async () => {
  await mount(); locked(false);
  await type('Hello');
  let sending;
  await React.act(async () => {
    sending = send().props.onPress();
    send().props.onPress();
    input().props.onChangeText('must not enter');
  });
  locked(true);
  assert.equal(refresh().props.disabled, true);
  assert.equal(chatCalls.length, 1, 'rapid sends must not create duplicate requests');
  assert.equal(input().props.value, '', 'queued input is ignored while the reply is pending');
  await React.act(async () => input().props.onSubmitEditing());
  assert.equal(chatCalls.length, 1, 'Enter must also be blocked');
  await React.act(async () => chatCalls[0].resolve({ reply: 'First|Second', eventReady: false }));
  locked(true);
  await type('still blocked'); assert.equal(input().props.value, '');
  await delay(); await React.act(async () => sending);
  assert.equal(temporaryChats.getTemporaryChat('호시노', apiKey).getSnapshot().unreadCount, 0, 'visible replies are read immediately');
  locked(false);
  await type('Next'); assert.equal(input().props.value, 'Next');
  await React.act(async () => { sending = send().props.onPress(); }); locked(true);
  await React.act(async () => chatCalls[1].resolve({ reply: '', eventReady: false }));
  await React.act(async () => sending); locked(false);
  assert.equal(temporaryChats.getTemporaryChat('호시노', apiKey).getSnapshot().completedPairs, 1, 'an empty reply does not add a completed pair');

  await type('Retry');
  await React.act(async () => { sending = send().props.onPress(); }); locked(true);
  const originalError = console.error;
  try {
    console.error = () => {};
    await React.act(async () => chatCalls[2].reject(new Error('offline')));
    await React.act(async () => sending);
  } finally { console.error = originalError; }
  locked(false);
  assert.equal(temporaryChats.getTemporaryChat('호시노', apiKey).getSnapshot().completedPairs, 1, 'an error response does not add a completed pair');
  const messagesBeforeReset = tree.root.findByType('FlatList').props.data;
  await type('keep draft');
  await React.act(async () => refresh().props.onPress());
  await React.act(async () => tree.root.findAllByType('Button').find(node => node.props.title === 'cancel').props.onPress());
  assert.equal(resetCalls.length, 0, 'cancel does not reset the conversation');
  await React.act(async () => refresh().props.onPress());
  await React.act(async () => { confirmReset().props.onPress(); confirmReset().props.onPress(); });
  assert.equal(resetCalls.length, 1);
  locked(true);
  await React.act(async () => resetCalls[0].reject(new Error('offline')));
  locked(false);
  assert.equal(input().props.value, 'keep draft');
  assert.deepEqual(tree.root.findByType('FlatList').props.data, messagesBeforeReset, 'failed reset preserves chat');
  assert.ok(tree.root.findAllByType('Text').some(node => node.props.children === 'resetChatFailed'));
  await React.act(async () => confirmReset().props.onPress());
  await React.act(async () => resetCalls[1].resolve());
  locked(false);
  assert.equal(input().props.value, '');
  assert.deepEqual(tree.root.findByType('FlatList').props.data, []);
  assert.equal(tree.root.findAllByType('Modal').length, 0);
  await unmount();

  greet = true;
  await mount(); locked(true);
  await type('blocked greeting'); assert.equal(input().props.value, '');
  await React.act(async () => triggerCalls[0].resolve({ triggerLine: 'Welcome|Back' }));
  await delay(); locked(true);
  await delay(); locked(false);
  assert.equal(temporaryChats.getTemporaryChat('호시노', apiKey).getSnapshot().completedPairs, 0, 'the initial greeting alone is not a completed exchange');
  await React.act(async () => refresh().props.onPress());
  await React.act(async () => confirmReset().props.onPress());
  await React.act(async () => resetCalls[2].resolve());
  assert.equal(triggerCalls.length, 2, 'reset restarts the optional character greeting');
  locked(true);
  await React.act(async () => triggerCalls[1].resolve({ triggerLine: 'New greeting' }));
  await delay(); locked(false);
  await unmount();
  const greetingsBeforeReturn = triggerCalls.length;
  await mount();
  assert.equal(triggerCalls.length, greetingsBeforeReturn, 'returning to an existing chat does not send another greeting');
  assert.ok(tree.root.findByType('FlatList').props.data.some(message => message.text === 'New greeting'));
  await unmount();

  greet = false; apiKey = '';
  await mount(); locked(true); await unmount();
  apiKey = 'test-key';
  let headerAction;
  const onRefreshActionChange = action => { headerAction = action; };
  await mount({ onRefreshActionChange });
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'refreshChat' }).length, 0, 'mobile uses the header action without a second in-chat button');
  assert.equal(headerAction.disabled, false);
  await React.act(async () => headerAction.onPress());
  assert.equal(tree.root.findAllByType('Modal').length, 1, 'header icon opens the same reset confirmation');
  await React.act(async () => tree.root.findAllByType('Button').find(node => node.props.title === 'cancel').props.onPress());
  await type('mobile request');
  await React.act(async () => { sending = send().props.onPress(); });
  assert.equal(headerAction.disabled, true);
  await React.act(async () => headerAction.onPress());
  assert.equal(tree.root.findAllByType('Modal').length, 0, 'even a stale header callback cannot reset while typing');
  await React.act(async () => chatCalls.at(-1).resolve({ reply: 'done', eventReady: false }));
  await React.act(async () => sending);
  assert.equal(headerAction.disabled, false);
  await unmount();
  assert.equal(headerAction, null, 'leaving chat removes its header action');
  await mount({ savedStory: { id: 'saved', script: '', chatMessages: [] } });
  assert.equal(tree.root.findAllByType('TextInput').length, 0, 'saved chat remains read-only');
  await unmount();

  // Drafts and pending replies belong to the character, not the mounted screen.
  const hoshinoMessages = temporaryChats.getTemporaryChat('호시노', apiKey).getSnapshot().messages;
  await mount({ characterName: '히나' });
  assert.deepEqual(tree.root.findByType('FlatList').props.data, []);
  await type('Hina draft');
  await unmount();
  await mount({ characterName: '히나' });
  assert.equal(input().props.value, 'Hina draft');
  await React.act(async () => { sending = send().props.onPress(); });
  const hinaRequest = chatCalls.at(-1);
  await React.act(async () => tree.unmount());
  await mount({ characterName: '호시노' });
  assert.deepEqual(tree.root.findByType('FlatList').props.data, hoshinoMessages);
  await React.act(async () => hinaRequest.resolve({ reply: 'Hina one|Hina two', eventReady: true }));
  assert.deepEqual(tree.root.findByType('FlatList').props.data, hoshinoMessages, 'background replies never enter another character chat');
  await delay(); await React.act(async () => sending);
  assert.equal(temporaryChats.getTemporaryChat('히나', apiKey).getSnapshot().unreadCount, 2, 'offscreen character reply bubbles count as unread');
  await unmount();
  await mount({ characterName: '히나' });
  assert.equal(temporaryChats.getTemporaryChat('히나', apiKey).getSnapshot().unreadCount, 0, 'opening a chat marks its messages read');
  locked(false);
  for (let turn = 0; turn < 10; turn++) {
    await type('continued turn ' + turn);
    await React.act(async () => { sending = send().props.onPress(); });
    await React.act(async () => chatCalls.at(-1).resolve({ reply: 'continued reply ' + turn, eventReady: true }));
    await React.act(async () => sending); locked(false);
  }
  const storyButton = () => tree.root.findAllByType('TouchableOpacity').find(node => node.findAllByType('Text').some(text => text.props.children === 'generateStoryNow'));
  assert.ok(storyButton(), 'generation remains available after ten exchanges');
  const beforeStory = tree.root.findByType('FlatList').props.data;
  failSave = true;
  await React.act(async () => { void storyButton().props.onPress(); });
  const previousError = console.error;
  try {
    console.error = () => {};
    await React.act(async () => eventCalls.at(-1).resolve({ eventScript: 'title : Test\nendEvent' }));
  } finally { console.error = previousError; }
  assert.deepEqual(tree.root.findByType('FlatList').props.data.slice(0, beforeStory.length), beforeStory, 'failed story saving preserves temporary chat');
  locked(false);
  failSave = false;
  await React.act(async () => { void storyButton().props.onPress(); });
  await React.act(async () => eventCalls.at(-1).resolve({ eventScript: 'title : Test\nendEvent' }));
  assert.equal(savedStories.length, 1);
  assert.ok(savedStories[0][2].some(message => message.text === 'Hina one'));
  assert.deepEqual(tree.root.findByType('FlatList').props.data.slice(0, beforeStory.length), beforeStory, 'generating a story does not clear the chat before viewing');
  assert.ok(storyButton());
  locked(false);
  assert.equal(tree.root.findAllByType('Text').some(node => ['storyChatAwaitingEnd', 'storyChatLocked'].includes(node.props.children)), false);
  const unfinished = eventStore.consumePendingEvent();
  assert.equal(unfinished.onComplete, undefined);
  // Leaving the player early does not invoke its completion callback.
  await unmount();
  await mount({ characterName: '호시노' }); locked(false); await unmount();
  greet = true;
  const previousGreetings = triggerCalls.length;
  await mount({ characterName: '히나' }); locked(false);
  assert.equal(triggerCalls.length, previousGreetings);
  greet = false;
  const generatedCount = eventCalls.length;
  await React.act(async () => { void storyButton().props.onPress(); });
  assert.equal(eventCalls.length, generatedCount + 1, 'generate creates a new episode in the same room');
  await React.act(async () => eventCalls.at(-1).resolve({ eventScript: 'title : Next episode\nendEvent' }));
  const viewing = eventStore.consumePendingEvent();
  assert.equal(viewing.onComplete, undefined, 'playback does not reset the conversation');
  locked(false);
  const roomId = temporaryChats.getTemporaryChat('히나', apiKey).getSnapshot().roomId;
  assert.equal(library.episodesOf(library.listStories().find(item => item.id === roomId)).length, 2);
  assert.deepEqual(temporaryChats.getTemporaryChat('호시노', apiKey).getSnapshot().messages, hoshinoMessages);
  await type('Continue after viewing');
  const resetsBeforeContinuation = resetCalls.length;
  await React.act(async () => { sending = send().props.onPress(); });
  assert.equal(resetCalls.length, resetsBeforeContinuation, 'continuing never resets AI memory');
  await React.act(async () => chatCalls.at(-1).resolve({ reply: 'Continued reply', eventReady: true }));
  await React.act(async () => sending);
  await type('Background request');
  await React.act(async () => { sending = send().props.onPress(); });
  await React.act(async () => { rn.AppState.currentState = 'background'; for (const listener of appStateListeners) listener('background'); });
  await React.act(async () => chatCalls.at(-1).resolve({ reply: 'Background one|Background two', eventReady: false }));
  await delay(); await React.act(async () => sending);
  assert.equal(temporaryChats.getTemporaryChat('히나', apiKey).getSnapshot().unreadCount, 2, 'background app is not an active reader');
  await React.act(async () => { rn.AppState.currentState = 'active'; for (const listener of appStateListeners) listener('active'); });
  assert.equal(temporaryChats.getTemporaryChat('히나', apiKey).getSnapshot().unreadCount, 0);
  await unmount();
  assert.equal(appStateListeners.size, 0);

  // Refreshing one character must not touch another character's draft or badge.
  const untouched = temporaryChats.getTemporaryChat('호시노', apiKey);
  untouched.update(previous => ({ input: 'keep Hoshino draft', eventReady: true, messages: [...previous.messages, { sender: 'character', text: 'unread Hoshino reply' }] }));
  const untouchedSnapshot = untouched.getSnapshot();
  await mount({ characterName: '히나' });
  await React.act(async () => refresh().props.onPress());
  await React.act(async () => confirmReset().props.onPress());
  await React.act(async () => resetCalls.at(-1).resolve());
  assert.deepEqual(tree.root.findByType('FlatList').props.data, []);
  assert.deepEqual(untouched.getSnapshot(), untouchedSnapshot, 'reset preserves every other character field, including draft, readiness and unread count');
  await unmount();
  await mount({ characterName: '호시노' });
  assert.deepEqual(tree.root.findByType('FlatList').props.data, untouchedSnapshot.messages);
  assert.equal(input().props.value, 'keep Hoshino draft');
  await unmount();

  // Rooms keep separate drafts, replies and readiness; switching never resets either room.
  const otherKey = temporaryChats.getTemporaryChat('other-key-character', 'another-key');
  otherKey.update({ input: 'draft', messages: [{ sender: 'character', text: 'unread' }], storyScript: 'old story', eventReady: true });
  const otherSnapshot = otherKey.getSnapshot();
  await mount({ characterName: 'continuous-test', room: 'chat' });
  for (let turn = 0; turn < 5; turn++) {
    await type(`turn ${turn}`);
    await React.act(async () => { sending = send().props.onPress(); });
    await React.act(async () => chatCalls.at(-1).resolve({ reply: `reply ${turn}`, eventReady: true }));
    await React.act(async () => sending);
    locked(false);
    assert.equal(temporaryChats.getTemporaryChat('continuous-test', apiKey, 'chat').getSnapshot().eventReady, false);
  }
  assert.equal(tree.root.findByType('FlatList').props.data.length, 10);
  await type('pending reply before room change');
  await React.act(async () => { sending = send().props.onPress(); });
  const oldRequest = chatCalls.at(-1);
  await unmount();
  await mount({ characterName: 'continuous-test', room: 'bond' });
  await React.act(async () => oldRequest.resolve({ reply: 'chat room reply', eventReady: true }));
  await React.act(async () => sending);
  assert.deepEqual(tree.root.findByType('FlatList').props.data, [], 'background chat reply cannot enter the bond room');
  await type('fresh bond room');
  await React.act(async () => { sending = send().props.onPress(); });
  await React.act(async () => chatCalls.at(-1).resolve({ reply: 'bond reply', eventReady: true }));
  await React.act(async () => sending);
  locked(false);
  await unmount();
  await mount({ characterName: 'continuous-test', room: 'chat' });
  locked(false);
  assert.equal(tree.root.findByType('FlatList').props.data.length, 12, 'reopening chat restores the conversation including its background reply');
  assert.equal(tree.root.findByType('FlatList').props.data.at(-1).text, 'chat room reply');
  await type('keep chat draft');
  const chatSnapshot = temporaryChats.getTemporaryChat('continuous-test', apiKey, 'chat').getSnapshot();
  await unmount();
  await mount({ characterName: 'continuous-test', room: 'bond' });
  locked(false);
  await React.act(async () => refresh().props.onPress());
  await React.act(async () => confirmReset().props.onPress());
  await React.act(async () => resetCalls.at(-1).resolve());
  assert.deepEqual(temporaryChats.getTemporaryChat('continuous-test', apiKey, 'chat').getSnapshot(), chatSnapshot, 'resetting bond leaves chat untouched');
  assert.deepEqual(otherKey.getSnapshot(), otherSnapshot);
  await unmount();

  const entryModule = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/chat/ChatEntry.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText)(id => mocks[id], entryModule, entryModule.exports);
  const badgeChat = temporaryChats.getTemporaryChat('badge-test', apiKey);
  await React.act(async () => { tree = Renderer.create(React.createElement(entryModule.exports.default, { characterName: 'badge-test', name: 'Test', status: '', image: 1, onSelect() {} })); });
  const badges = () => tree.root.findAllByProps({ accessibilityLabel: 'unreadMessages' });
  assert.equal(badges().length, 0);
  await React.act(async () => badgeChat.update({ messages: [{ sender: 'user', text: 'hi' }, { sender: 'typing', text: '...' }] }));
  assert.equal(badges().length, 0, 'user messages and typing dots never count');
  await React.act(async () => badgeChat.update(previous => ({ messages: [...previous.messages, { sender: 'character', text: 'reply' }] })));
  assert.equal(badges()[0].props.children, 1);
  await React.act(async () => badgeChat.update({ messages: Array.from({ length: 105 }, () => ({ sender: 'character', text: 'reply' })) }));
  assert.equal(badges()[0].props.children, '99+');
  await React.act(async () => badgeChat.clear());
  assert.equal(badges().length, 0, 'reset clears unread badge');
  await unmount();
  await mount({ characterName: 'final-reply-button-test' });
  const finalStoryButton = () => tree.root.findAllByType('TouchableOpacity').find(node => node.findAllByType('Text').some(text => text.props.children === 'generateStoryNow'));
  await type('third pair');
  await React.act(async () => { sending = send().props.onPress(); });
  await React.act(async () => chatCalls.at(-1).resolve({ reply: 'first sentence|last sentence', eventReady: true }));
  locked(true);
  assert.equal(finalStoryButton().props.disabled, true, 'generation waits for the complete reply');
  assert.ok(tree.root.findByType('FlatList').props.data.some(message => message.sender === 'typing'));
  await delay(); await React.act(async () => sending);
  assert.ok(finalStoryButton(), 'story button appears after the last character sentence');
  assert.equal(tree.root.findByType('FlatList').props.data.at(-1).text, 'last sentence');
  assert.equal(tree.root.findAllByType('Text').some(node => ['storyChatAwaitingEnd', 'storyChatLocked'].includes(node.props.children)), false, 'no three-pair completion notice');
  locked(false);
  await unmount();
  const instantButton = () => tree.root.findAllByType('TouchableOpacity').find(node => node.findAllByType('Text').some(text => text.props.children === 'generateStoryNow'));
  await mount({ characterName: 'instant-story-test' });
  assert.equal(instantButton(), undefined, 'hide generation until a pair is complete');
  assert.equal(tree.root.findAllByType('Text').some(node => ['bondEvent', 'generateStoryNowHint'].includes(node.props.children)), false, 'hide the entire event notice before chatting');
  const callsBeforeInstant = eventCalls.length;
  await type('A story about this conversation');
  await React.act(async () => { sending = send().props.onPress(); });
  await React.act(async () => chatCalls.at(-1).resolve({ reply: 'reply one|reply two', eventReady: false }));
  assert.equal(instantButton().props.disabled, true, 'wait until all reply sentences finish');
  await delay(); await React.act(async () => sending);
  assert.equal(instantButton().props.disabled, false);
  assert.notEqual(instantButton().parent, refresh().parent, 'generation is above the input rather than beside the top refresh action');
  assert.equal(tree.root.findAllByType('Text').some(node => ['bondEvent', 'generateStoryNowHint'].includes(node.props.children)), false, 'instant generation has no footer title or explanation');
  locked(false);
  await unmount();
  await mount({ characterName: 'instant-story-test' });
  assert.equal(instantButton().props.disabled, false, 'eligibility survives leaving the room');
  await React.act(async () => { void instantButton().props.onPress(); void instantButton().props.onPress(); });
  assert.equal(eventCalls.length, callsBeforeInstant + 1, 'rapid generate clicks make one request');
  locked(true);
  const errorLog = console.error;
  console.error = () => {};
  try { await React.act(async () => eventCalls.at(-1).reject(new Error('offline'))); }
  finally { console.error = errorLog; }
  locked(false);
  assert.equal(instantButton().props.disabled, false, 'failed generation can be retried');
  await React.act(async () => { void instantButton().props.onPress(); });
  await React.act(async () => eventCalls.at(-1).resolve({ eventScript: 'title : Instant\nendEvent' }));
  locked(false);
  assert.equal(temporaryChats.getTemporaryChat('instant-story-test', apiKey).getSnapshot().eventReady, true, 'generation stays available without locking chat');
  assert.deepEqual(savedStories.at(-1)[2].slice(0, 3).map(message => message.text), ['A story about this conversation', 'reply one', 'reply two']);
  const earlyStory = eventStore.consumePendingEvent();
  assert.equal(earlyStory.onComplete, undefined);
  locked(false);
  assert.ok(instantButton(), 'generation remains available after playback');
  await unmount();
  await mount({ characterName: 'instant-story-test', room: 'chat' });
  assert.equal(instantButton(), undefined, 'general chat has no instant generation');
  await unmount();
  let quickHeader;
  const updateQuickHeader = action => { quickHeader = action; };
  const headerSession = temporaryChats.getTemporaryChat('instant-header-test', apiKey);
  const headerRoom = library.saveStory('instant-header-test', '', []);
  temporaryChats.linkTemporaryRoom('instant-header-test', apiKey, headerRoom.id);
  await mount({ characterName: 'instant-header-test', onRefreshActionChange: updateQuickHeader });
  assert.equal(quickHeader.generate, undefined, 'mobile header hides generation before the first pair');
  await React.act(async () => headerSession.update({ completedPairs: 1 }));
  assert.equal(quickHeader.generate.disabled, false);
  assert.equal(instantButton().props.disabled, false, 'mobile shows the generation action above the input');
  await React.act(async () => headerSession.update({ isWaiting: true }));
  assert.equal(quickHeader.generate.disabled, true, 'mobile header disables generation during requests');
  await React.act(async () => headerSession.update({ isWaiting: false }));
  const previousEvents = eventCalls.length;
  await React.act(async () => { quickHeader.generate.onPress(); });
  assert.equal(eventCalls.length, previousEvents + 1, 'mobile header invokes story generation');
  await React.act(async () => eventCalls.at(-1).resolve({ eventScript: 'title : Header\nendEvent' }));
  assert.equal(quickHeader.generate.disabled, false, 'mobile header keeps generation available');
  await unmount();
  assert.equal(quickHeader, null);
  // Restoring a persisted room under a fresh API-key session rehydrates the same card.
  const persistedRoom = library.listStories().find(item => library.episodesOf(item).length === 2);
  const previousKey = apiKey; apiKey = 'restored-key';
  await mount({ characterName: persistedRoom.character, conversation: persistedRoom });
  locked(false);
  assert.deepEqual(tree.root.findByType('FlatList').props.data, persistedRoom.chatMessages);
  assert.equal(temporaryChats.getTemporaryChat(persistedRoom.character, apiKey).getSnapshot().roomId, persistedRoom.id, 'the character bond room continues the room opened from the library');
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'refreshChat' }).length, 0, 'library room edits replace destructive refresh');
  await type('Continue this saved room');
  await React.act(async () => { sending = send().props.onPress(); });
  const context = chatCalls.at(-1).args[3];
  assert.equal(context.id, persistedRoom.id);
  assert.equal(context.scripts.length, 2, 'both previous stories are included in resumed chat');
  assert.deepEqual(context.messages, persistedRoom.chatMessages, 'pending new input is not duplicated in restored history');
  await React.act(async () => chatCalls.at(-1).resolve({ reply: 'Restored reply', eventReady: true }));
  await React.act(async () => sending); locked(false);
  const roomCount = library.listStories().length;
  await React.act(async () => { void instantButton().props.onPress(); });
  assert.equal(eventCalls.at(-1).args[1].scripts.length, 2);
  await React.act(async () => eventCalls.at(-1).resolve({ eventScript: 'title : Restored third episode\nendEvent' }));
  assert.equal(library.listStories().length, roomCount, 'new episodes never add library cards');
  const restored = library.listStories().find(item => item.id === persistedRoom.id);
  assert.equal(library.episodesOf(restored).length, 3);
  assert.equal(restored.chatMessages.at(-1).text, 'Restored reply');
  await unmount(); apiKey = previousKey;
  const timelineMessages = [
    { sender: 'user', text: 'before first story' }, { sender: 'character', text: 'first answer' },
    { sender: 'user', text: 'after first story' }, { sender: 'character', text: 'second answer' },
    { sender: 'user', text: 'after second story' }, { sender: 'character', text: 'third answer' },
  ];
  let timelineRoom = library.saveStory('inline-timeline', '', timelineMessages.slice(0, 2));
  timelineRoom = library.appendRoomStory(timelineRoom.id, 'title : Inline first\nendEvent', timelineMessages.slice(0, 2));
  timelineRoom = library.appendRoomStory(timelineRoom.id, 'title : Inline second\nendEvent', timelineMessages.slice(0, 4));
  timelineRoom = library.updateRoom(timelineRoom.id, { chatMessages: timelineMessages });
  const inlineElements = element => {
    if (!element || typeof element !== 'object') return [];
    if (Array.isArray(element)) return element.flatMap(inlineElements);
    return [element, ...inlineElements(element.props?.children)];
  };
  const inlineButtons = index => {
    const list = tree.root.findByType('FlatList').props;
    return inlineElements(list.renderItem({ item: list.data[index], index })).filter(element => element.type === 'TouchableOpacity' && element.props.accessibilityLabel === 'bondStory');
  };
  await mount({ characterName: timelineRoom.character, conversation: timelineRoom });
  assert.equal(inlineButtons(0).length, 0);
  assert.equal(inlineButtons(1).length, 1, 'first story button follows the first conversation');
  assert.equal(inlineButtons(3).length, 1, 'second story button follows the continued conversation');
  assert.equal(inlineButtons(5).length, 0, 'new chat remains below the last story button');
  const requestsBeforePlayback = eventCalls.length;
  await React.act(async () => inlineButtons(1)[0].props.onPress());
  assert.match(eventStore.consumePendingEvent().script, /Inline first/);
  await React.act(async () => inlineButtons(3)[0].props.onPress());
  assert.match(eventStore.consumePendingEvent().script, /Inline second/);
  assert.equal(eventCalls.length, requestsBeforePlayback, 'inline buttons replay saved scripts without generating');
  await unmount();
  await mount({ characterName: timelineRoom.character, conversation: timelineRoom });
  assert.equal(inlineButtons(1).length, 1, 'story locations survive reopening the room');
  await unmount();
  await mount({ characterName: timelineRoom.character });
  assert.equal(inlineButtons(1).length, 1, 'the character bond room uses the same inline story position');
  assert.equal(inlineButtons(3).length, 1);
  await unmount();
  const removedRoom = library.listStories().find(item => item.character === 'instant-story-test');
  const activeRemoved = temporaryChats.getTemporaryChat(removedRoom.character, apiKey, 'bond', removedRoom.id);
  temporaryChats.forgetTemporaryRoom(removedRoom.id);
  assert.equal(activeRemoved.getSnapshot().roomId, undefined, 'deleting a room detaches its active conversation');
  assert.equal(activeRemoved.getSnapshot().needsReset, true, 'the next new conversation resets old model memory');
  completed = true;
  console.log('PASS input/send/Enter lock during requests and multi-sentence replies, rapid duplicate prevention, greeting lock, empty/error recovery, missing key and saved chat');
})().catch(error => { console.error(error); process.exitCode = 1; });
