const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
require('./build-chat-pop');
const wav = fs.readFileSync(path.join(__dirname, '../assets/audio/chat-pop.wav'));
assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
assert.equal(wav.readUInt32LE(24), 48000);
assert.equal(wav.readUInt16LE(22), 1);
assert.equal((wav.length - 44) / 2 / 48000, 0.18);
assert.equal(wav.readInt16LE(44), 0);
assert.equal(wav.readInt16LE(wav.length - 2), 0);
let energy = 0;
for (let i = 44; i < wav.length; i += 2) energy += wav.readInt16LE(i) ** 2;
assert.ok(Math.sqrt(energy / ((wav.length - 44) / 2)) > 1000);
let plays = 0, volume = 0.5, loaded = true, deferSeek = false, resolveSeek, selected = 'pop', lastSource;
const player = { volume: 1, seekTo: () => deferSeek ? new Promise(resolve => { resolveSeek = resolve; }) : Promise.resolve(), play() { plays++; } };
const mocks = {
  react: React,
  'expo-audio': { useAudioPlayer: source => { lastSource = source; return player; }, useAudioPlayerStatus: () => ({ isLoaded: loaded }) },
  '@/services/sfxVolume': { getSfxVolume: () => volume },
  '../assets/audio/chat-pop.wav': 1,
  '@/services/chatSound': { useChatSound: () => selected },
  '@/constants/chatSounds': { chatSoundSources: { 'Chat_Pop.wav': 1, 'Chat_bell.wav': 2 } },
  '@/utils/chatPresentation': { chatSoundKey: id => id === 'pop' ? 'Chat_Pop.wav' : `Chat_${id}.wav` },
};
const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../hooks/useChatPop.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('require', 'module', 'exports', code)(id => mocks[id], mod, mod.exports);
function Harness({ messages }) { mod.exports.default(messages); return null; }
(async () => {
  let tree;
  const update = async messages => React.act(async () => tree.update(React.createElement(Harness, { messages })));
  await React.act(async () => { tree = Renderer.create(React.createElement(Harness, { messages: [] })); });
  await update([{ sender: 'typing' }]); assert.equal(plays, 0);
  await update([{ sender: 'user' }, { sender: 'typing' }]); assert.equal(plays, 1); assert.equal(player.volume, 0.5);
  await update([{ sender: 'user' }, { sender: 'character' }]); assert.equal(plays, 2);
  await update([{ sender: 'user' }, { sender: 'character' }]); assert.equal(plays, 2);
  volume = 0;
  await update([{ sender: 'user' }, { sender: 'character' }, { sender: 'character' }]); assert.equal(plays, 2);
  volume = 0.8;
  await update(Array.from({ length: 10 }, () => ({ sender: 'character' }))); assert.equal(plays, 3, 'skip replay plays only once');
  assert.equal(player.volume, 0.8);
  deferSeek = true;
  await update(Array.from({ length: 11 }, () => ({ sender: 'character' })));
  await React.act(async () => tree.unmount());
  await React.act(async () => resolveSeek()); assert.equal(plays, 3, 'no delayed audio after leaving');
  deferSeek = false; loaded = false;
  await React.act(async () => { tree = Renderer.create(React.createElement(Harness, { messages: [{ sender: 'character' }] })); });
  assert.equal(plays, 3);
  loaded = true; await update([{ sender: 'character' }]); assert.equal(plays, 4, 'initial replay bubble plays after audio is loaded');
  await React.act(async () => tree.unmount());
  await React.act(async () => { tree = Renderer.create(React.createElement(React.StrictMode, null, React.createElement(Harness, { messages: [{ sender: 'character' }] }))); });
  assert.equal(plays, 5, 'Strict Mode must play the initial bubble once');
  await React.act(async () => tree.unmount());
  selected = 'none';
  await React.act(async () => { tree = Renderer.create(React.createElement(Harness, { messages: [{ sender: 'character' }] })); });
  assert.equal(lastSource, null); assert.equal(plays, 5);
  selected = 'bell'; await update([{ sender: 'character' }]);
  assert.equal(lastSource, 2); assert.equal(plays, 5, 'changing the sound must not replay old bubbles');
  await update([{ sender: 'character' }, { sender: 'user' }]); assert.equal(plays, 6);
  await React.act(async () => tree.unmount());
  console.log('PASS original WAV, bubble sounds, typing/rerender suppression, mute/volume, replay skip and unmount safety');
})().catch(error => { console.error(error); process.exitCode = 1; });
