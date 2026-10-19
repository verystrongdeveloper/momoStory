const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

let apiKey = 'test-key', greet = false, chatCalls = [], triggerCalls = [];
const pending = queue => new Promise((resolve, reject) => queue.push({ resolve, reject }));
const timers = new Map();
let timerId = 0;
const rn = { StyleSheet: { create: value => value }, Keyboard: { addListener: () => ({ remove() {} }) } };
for (const name of ['Button', 'FlatList', 'Image', 'Pressable', 'Text', 'TextInput', 'TouchableOpacity', 'View']) rn[name] = name;
const mocks = {
  react: React, 'react-native': rn, 'expo-router': { useRouter: () => ({ push() {} }) },
  '@/services/geminiClient': { geminiClient: { chat: () => pending(chatCalls), trigger: () => pending(triggerCalls) }, geminiFailureText: () => 'API error' },
  '@/services/geminiKey': { getGeminiKey: () => apiKey, subscribeGeminiKey: () => () => {} },
  '@/services/greetMode': { getGreetMode: () => greet },
  '@/store/eventStore': { setPendingEvent() {} }, '@/store/storyLibrary': { saveStory() {} },
  '@/services/chatSize': { useChatSize: () => 1 }, './chatSizeStyles': { makeChatSizeStyles: () => ({}) },
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
const send = () => tree.root.findByType('Button');
const locked = value => { assert.equal(input().props.editable, !value); assert.equal(send().props.disabled, value); };
const type = async text => { await React.act(async () => input().props.onChangeText(text)); };
const delay = async () => {
  const timer = [...timers].find(([, value]) => value.ms === 1500);
  assert.ok(timer, 'expected sentence typing delay');
  timers.delete(timer[0]);
  await React.act(async () => timer[1].fn());
};

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
  assert.equal(chatCalls.length, 1, 'rapid sends must not create duplicate requests');
  assert.equal(input().props.value, '', 'queued input is ignored while the reply is pending');
  await React.act(async () => input().props.onSubmitEditing());
  assert.equal(chatCalls.length, 1, 'Enter must also be blocked');
  await React.act(async () => chatCalls[0].resolve({ reply: 'First|Second', eventReady: false }));
  locked(true);
  await type('still blocked'); assert.equal(input().props.value, '');
  await delay(); await React.act(async () => sending);
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
  await unmount();

  greet = true;
  await mount(); locked(true);
  await type('blocked greeting'); assert.equal(input().props.value, '');
  await React.act(async () => triggerCalls[0].resolve({ triggerLine: 'Welcome|Back' }));
  await delay(); locked(true);
  await delay(); locked(false);
  await unmount();

  greet = false; apiKey = '';
  await mount(); locked(true); await unmount();
  apiKey = 'test-key';
  await mount({ savedStory: { id: 'saved', script: '', chatMessages: [] } });
  assert.equal(tree.root.findAllByType('TextInput').length, 0, 'saved chat remains read-only');
  await unmount();
  console.log('PASS input/send/Enter lock during requests and multi-sentence replies, rapid duplicate prevention, greeting lock, empty/error recovery, missing key and saved chat');
})().catch(error => { console.error(error); process.exitCode = 1; });
