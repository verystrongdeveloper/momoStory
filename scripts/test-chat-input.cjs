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
let includeBondStory = true;
const modeListeners = new Set();
const modeModule = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/chatMode.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(id => ({ react: React, '@/store/temporaryChats': temporaryChats, '@/storage': {
  getSetting: () => includeBondStory,
  saveSetting: (_key, value) => { includeBondStory = value; modeListeners.forEach(listener => listener()); },
  subscribeStorage: listener => { modeListeners.add(listener); return () => modeListeners.delete(listener); },
} })[id], modeModule, modeModule.exports);
const chatMode = modeModule.exports;
const eventModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../store/eventStore.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(eventModule, eventModule.exports);
const eventStore = eventModule.exports;
for (const name of ['Button', 'FlatList', 'Image', 'Modal', 'Pressable', 'Text', 'TextInput', 'TouchableOpacity', 'View']) rn[name] = name;
const mocks = {
  react: React, 'react-native': rn, 'expo-router': { useRouter: () => ({ push() {} }), useFocusEffect: callback => React.useEffect(callback, [callback]) }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
  '@/services/geminiClient': { geminiClient: { chat: () => pending(chatCalls), trigger: () => pending(triggerCalls), reset: () => pending(resetCalls), createEvent: () => pending(eventCalls) }, geminiFailureText: () => 'API error' },
  '@/services/geminiKey': { getGeminiKey: () => apiKey, subscribeGeminiKey: () => () => {} },
  '@/services/greetMode': { getGreetMode: () => greet },
  '@/store/eventStore': eventStore, '@/store/storyLibrary': { saveStory(...args) { if (failSave) throw new Error('save failed'); savedStories.push(args); } },
  '@/store/temporaryChats': temporaryChats,
  '@/services/chatSize': { useChatSize: () => 1 }, './chatSizeStyles': { makeChatSizeStyles: () => ({}) },
  '@/services/chatMode': chatMode,
  '@/components/CharacterAvatar': 'CharacterAvatar',
  '@/i18n': { useI18n: () => ({ t: key => key }) },
  '@/utils/splitChatReply': { splitChatReply: text => text ? text.split('|') : [] },
  '@/hooks/useChatPop': () => {},
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

  await type('Retry');
  await React.act(async () => { sending = send().props.onPress(); }); locked(true);
  const originalError = console.error;
  try {
    console.error = () => {};
    await React.act(async () => chatCalls[2].reject(new Error('offline')));
    await React.act(async () => sending);
  } finally { console.error = originalError; }
  locked(false);
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
  locked(true);
  const callsAtThirdPair = chatCalls.length;
  await type('fourth pair blocked');
  await React.act(async () => { void send().props.onPress(); void input().props.onSubmitEditing(); });
  assert.equal(input().props.value, '');
  assert.equal(chatCalls.length, callsAtThirdPair);
  assert.deepEqual(tree.root.findByType('FlatList').props.data.map(message => message.text), ['Hina draft', 'Hina one', 'Hina two']);
  const storyButton = () => tree.root.findAllByType('TouchableOpacity').find(node => node.findAllByType('Text').some(text => text.props.children === 'bondStory'));
  assert.ok(storyButton(), 'story readiness survives leaving the chat');
  const beforeStory = tree.root.findByType('FlatList').props.data;
  failSave = true;
  await React.act(async () => { void storyButton().props.onPress(); });
  const previousError = console.error;
  try {
    console.error = () => {};
    await React.act(async () => eventCalls.at(-1).resolve({ eventScript: 'title : Test\nendEvent' }));
  } finally { console.error = previousError; }
  assert.deepEqual(tree.root.findByType('FlatList').props.data.slice(0, beforeStory.length), beforeStory, 'failed story saving preserves temporary chat');
  locked(true);
  failSave = false;
  await React.act(async () => { void storyButton().props.onPress(); });
  await React.act(async () => eventCalls.at(-1).resolve({ eventScript: 'title : Test\nendEvent' }));
  assert.equal(savedStories.length, 1);
  assert.ok(savedStories[0][2].some(message => message.text === 'Hina one'));
  assert.deepEqual(tree.root.findByType('FlatList').props.data.slice(0, beforeStory.length), beforeStory, 'generating a story does not clear the chat before viewing');
  assert.ok(storyButton());
  locked(true);
  assert.ok(tree.root.findAllByType('Text').some(node => node.props.children === 'storyChatAwaitingEnd'));
  const unfinished = eventStore.consumePendingEvent();
  assert.ok(unfinished.onComplete);
  // Leaving the player early does not invoke its completion callback.
  await unmount();
  await mount({ characterName: '호시노' }); locked(false); await unmount();
  greet = true;
  const previousGreetings = triggerCalls.length;
  await mount({ characterName: '히나' }); locked(true);
  assert.equal(triggerCalls.length, previousGreetings);
  greet = false;
  const generatedCount = eventCalls.length;
  await React.act(async () => { void storyButton().props.onPress(); });
  assert.equal(eventCalls.length, generatedCount, 'an unfinished story reopens without another generation');
  const viewing = eventStore.consumePendingEvent();
  assert.equal(viewing.script, unfinished.script);
  await React.act(async () => { viewing.onComplete(); viewing.onComplete(); });
  locked(false);
  assert.deepEqual(tree.root.findByType('FlatList').props.data, []);
  assert.equal(storyButton(), undefined);
  assert.deepEqual(temporaryChats.getTemporaryChat('호시노', apiKey).getSnapshot().messages, hoshinoMessages);
  await type('Fresh after completed viewing');
  const callsBeforeFreshChat = chatCalls.length;
  await React.act(async () => { sending = send().props.onPress(); });
  assert.equal(chatCalls.length, callsBeforeFreshChat, 'automatic refresh resets old AI memory before the next chat');
  await React.act(async () => resetCalls.at(-1).resolve());
  await React.act(async () => chatCalls.at(-1).resolve({ reply: 'Fresh reply', eventReady: false }));
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

  // Chat-only mode stays writable after three pairs, and switching resets every character/key.
  const otherKey = temporaryChats.getTemporaryChat('other-key-character', 'another-key');
  otherKey.update({ input: 'draft', messages: [{ sender: 'character', text: 'unread' }], storyScript: 'old story', eventReady: true });
  await React.act(async () => chatMode.setIncludeBondStory(false));
  for (const session of [untouched, otherKey, temporaryChats.getTemporaryChat('히나', apiKey)]) {
    assert.deepEqual(session.getSnapshot().messages, []);
    assert.equal(session.getSnapshot().input, '');
    assert.equal(session.getSnapshot().eventReady, false);
    assert.equal(session.getSnapshot().unreadCount, 0);
    assert.equal(session.getSnapshot().storyScript, null);
    assert.equal(session.getSnapshot().needsReset, true);
  }
  await mount({ characterName: 'continuous-test' });
  for (let turn = 0; turn < 5; turn++) {
    await type(`turn ${turn}`);
    await React.act(async () => { sending = send().props.onPress(); });
    await React.act(async () => chatCalls.at(-1).resolve({ reply: `reply ${turn}`, eventReady: true }));
    await React.act(async () => sending);
    locked(false);
    assert.equal(temporaryChats.getTemporaryChat('continuous-test', apiKey).getSnapshot().eventReady, false);
  }
  assert.equal(tree.root.findByType('FlatList').props.data.length, 10);
  await type('pending reply before mode change');
  await React.act(async () => { sending = send().props.onPress(); });
  const oldRequest = chatCalls.at(-1);
  await React.act(async () => chatMode.setIncludeBondStory(true));
  await React.act(async () => oldRequest.resolve({ reply: 'stale reply', eventReady: true }));
  await React.act(async () => sending);
  assert.deepEqual(tree.root.findByType('FlatList').props.data, [], 'late replies cannot restore reset chats');
  await type('fresh story mode');
  const previousCalls = chatCalls.length;
  await React.act(async () => { sending = send().props.onPress(); });
  assert.equal(chatCalls.length, previousCalls, 'new mode resets AI memory before chatting');
  await React.act(async () => resetCalls.at(-1).resolve());
  await React.act(async () => chatCalls.at(-1).resolve({ reply: 'one|two', eventReady: true }));
  locked(true);
  await React.act(async () => chatMode.setIncludeBondStory(false));
  await delay(); await React.act(async () => sending);
  assert.deepEqual(tree.root.findByType('FlatList').props.data, [], 'sentence playback cannot append after mode reset');
  const generationBeforeNoChange = temporaryChats.getTemporaryChat('continuous-test', apiKey).getSnapshot().generation;
  chatMode.setIncludeBondStory(false);
  assert.equal(temporaryChats.getTemporaryChat('continuous-test', apiKey).getSnapshot().generation, generationBeforeNoChange, 'selecting current mode does not reset');
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
  completed = true;
  console.log('PASS input/send/Enter lock during requests and multi-sentence replies, rapid duplicate prevention, greeting lock, empty/error recovery, missing key and saved chat');
})().catch(error => { console.error(error); process.exitCode = 1; });
