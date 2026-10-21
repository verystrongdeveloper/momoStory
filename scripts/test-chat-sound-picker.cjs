const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
require('./build-chat-pop');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id === '../shared/geminiModels') return require('../shared/geminiModels');
    if (id === '../shared/senseiMode') return require('../shared/senseiMode');
    if (id.includes('/assets/')) return id;
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? id.slice(2) : path.relative(root, path.resolve(root, path.dirname(file), id));
      return load(fs.existsSync(path.join(root, base + '.ts')) ? base + '.ts' : base + '.tsx', mocks);
    }
    return require(id);
  }, mod, mod.exports);
  return mod.exports;
}
const catalog = load('utils/chatPresentation.ts');
const types = load('storage/types.ts');
assert.equal(types.parsePreferences('{}').chatSound, 'pop');
assert.equal(types.parsePreferences('{"chatSound":"invalid"}').chatSound, 'pop');
for (const id of catalog.CHAT_SOUND_IDS) assert.equal(types.parsePreferences(JSON.stringify({ chatSound: id })).chatSound, id);
const hashes = new Set();
for (const id of catalog.CHAT_SOUND_IDS.filter(id => id !== 'none')) {
  const bytes = fs.readFileSync(path.join(root, `assets/audio/chat-${id}.wav`));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal((bytes.length - 44) / 96000, catalog.CHAT_POP_DURATION);
  hashes.add(require('node:crypto').createHash('sha256').update(bytes).digest('hex'));
}
assert.equal(hashes.size, 5, 'all five sounds must actually differ');
(async () => {
  let saved = { ...types.DEFAULT_PREFERENCES };
  const storageMocks = {
    './preferencesStorage': { loadPreferences: async () => saved, savePreferences: async value => { saved = value; } },
    './secureStorage': { loadApiKey: async () => '', clearApiKey: async () => {}, saveApiKey: async () => {} },
    './storyStorage': { readStoryRecords: async () => [], writeStoryRecords: async () => {} },
    './migrate': { migrateLegacyStorage: async () => true }, './prime': { readInitialSync: () => null },
  };
  const storage = load('storage/index.ts', storageMocks);
  await storage.hydrateStorage();
  storage.saveSetting('chatSound', 'bell'); assert.equal(saved.chatSound, 'bell');
  const reloaded = load('storage/index.ts', storageMocks); await reloaded.hydrateStorage();
  assert.equal(reloaded.getSetting('chatSound'), 'bell', 'selection survives restart');
  for (const id of catalog.CHAT_SOUND_IDS) {
    const { prepareVideo } = load('services/videoExport/prepare.ts', {
      '@/storage': { getSetting: key => key === 'chatSound' ? id : 0.5 },
      '@/platform/videoAsset': { videoAssetUrl: async source => String(source) },
      '@/constants/characters': { avatarOf: () => undefined, displayCharacterName: value => value },
      '@/constants/spriteLayout': { getSpriteAspectRatio: () => 1 },
    });
    const payload = await prepareVideo({ title: 'test', character: '호시노', script: '', chatMessages: [{ sender: 'character', text: 'hello' }] }, '9:16', 'ko', {}, { signal: new AbortController().signal, onProgress() {} });
    assert.equal(payload.timeline.audio.length, id === 'none' ? 0 : 1);
    if (id !== 'none') assert.ok(payload.sounds[`sfx:${catalog.chatSoundKey(id)}`].endsWith(`chat-${id}.wav`));
    const selectionPayload = await prepareVideo({ title: 'test', character: '호시노', script: 'selection : (1)"One" (2)"Two"\nendEvent', chatMessages: [{ sender: 'user', text: 'excluded' }] }, '16:9', 'ko', {}, { signal: new AbortController().signal, onProgress() {}, includeChat: false });
    assert.equal(selectionPayload.timeline.audio.length, id === 'none' ? 0 : 1);
    if (id !== 'none') assert.ok(selectionPayload.sounds[`sfx:${catalog.chatSoundKey(id)}`].endsWith(`chat-${id}.wav`), 'selection audio asset loads even without chat');
  }
  const { prepareVideo: prepareWithoutChat } = load('services/videoExport/prepare.ts', {
    '@/storage': { getSetting: key => key === 'chatSound' ? 'bell' : 0.5 },
    '@/platform/videoAsset': { videoAssetUrl: async source => String(source) },
    '@/constants/characters': { avatarOf: () => { throw new Error('Unused chat avatar must not be loaded'); }, displayCharacterName: value => value },
    '@/constants/spriteLayout': { getSpriteAspectRatio: () => 1 },
  });
  const longChat = { title: 'test', character: '호시노', script: '타이틀 : 이야기', chatMessages: Array.from({ length: 20 }, () => ({ sender: 'character', text: 'x'.repeat(1000) })) };
  const exportOptions = { signal: new AbortController().signal, onProgress() {} };
  await assert.rejects(prepareWithoutChat(longChat, '9:16', 'ko', {}, exportOptions), /VIDEO_TOO_LONG/);
  const onlyStory = await prepareWithoutChat(longChat, '9:16', 'ko', {}, { ...exportOptions, includeChat: false });
  assert.equal(onlyStory.timeline.duration, 4, 'duration limit only counts included content');
  assert.deepEqual(onlyStory.timeline.messages, []);
  assert.deepEqual(onlyStory.sounds, {});
  assert.equal(onlyStory.images.avatar, undefined);
  assert.equal(longChat.chatMessages.length, 20);
  let selected = 'pop'; const players = new Map();
  let failSeek = false, deferSeek = false, resolveSeek, loaded = true;
  const audio = { useAudioPlayer(source) {
    const player = React.useMemo(() => {
      const value = { source, volume: 1, paused: 0, played: 0, released: false,
        pause() { this.paused++; if (this.released) throw new Error('native player released'); },
        seekTo() { if (this.released || failSeek) return Promise.reject(new Error('seek failed')); return deferSeek ? new Promise(resolve => { resolveSeek = resolve; }) : Promise.resolve(); },
        play() { if (this.released) throw new Error('native player released'); this.played++; },
      };
      players.set(source, value); return value;
    }, [source]);
    React.useEffect(() => () => { player.released = true; }, [player]);
    return player;
  }, useAudioPlayerStatus: () => ({ isLoaded: loaded }) };
  const Picker = load('components/layout/ChatSoundPicker.tsx', {
    'react': React, 'react-native': { Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', TouchableOpacity: 'TouchableOpacity', StyleSheet: { absoluteFill: {}, create: value => value } },
    'expo-audio': audio, '@/i18n': { useI18n: () => ({ t: (key, values) => values?.name ? `${key}:${values.name}` : key }) },
    '@/services/chatSound': { useChatSound: () => selected, setChatSound: id => { selected = id; } },
    '@/services/sfxVolume': { getSfxVolume: () => 0 },
  }).default;
  let tree;
  await React.act(async () => { tree = Renderer.create(React.createElement(Picker)); });
  assert.equal(tree.root.findAllByProps({ accessibilityRole: 'radio' }).length, 0, 'options stay hidden until opened');
  assert.equal(players.size, 1, 'load only the selected sound, not all five players');
  const choose = async id => {
    await React.act(async () => tree.root.findByProps({ accessibilityLabel: 'chatSound' }).props.onPress());
    assert.equal(tree.root.findAllByProps({ accessibilityRole: 'radio' }).length, 6);
    await React.act(async () => tree.root.findByProps({ accessibilityLabel: `chatSound_${id}` }).props.onPress());
    assert.equal(tree.root.findAllByType('Modal').length, 0, 'selection closes the popup');
  };
  await choose('bell');
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: 'previewChatSound:chatSound_bell' }).props.onPress());
  assert.equal(selected, 'bell', 'preview must not change selection');
  const bell = [...players.values()].find(player => String(player.source).endsWith('chat-bell.wav'));
  assert.equal(bell.played, 1); assert.equal(bell.volume, 0.5, 'muted preview is audible');
  await choose('click');
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: 'previewChatSound:chatSound_click' }).props.onPress());
  assert.ok(bell.paused > 0, 'preview must stop the previous sound');
  const click = [...players.values()].find(player => String(player.source).endsWith('chat-click.wav'));
  assert.equal(bell.released, true, 'changing sound releases the previous native player');
  assert.equal(click.played, 1, 'a released previous player must not prevent the next preview');
  assert.ok(!tree.root.findAllByType('Text').some(text => text.props.children === 'soundPreviewFailed'));
  await choose('soft');
  assert.equal(selected, 'soft');
  await React.act(async () => tree.update(React.createElement(Picker)));
  assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === 'chatSound_soft'));
  const preview = () => tree.root.findByProps({ accessibilityLabel: `previewChatSound:chatSound_${selected}` });
  const hasPreviewError = () => tree.root.findAllByType('Text').some(text => text.props.children === 'soundPreviewFailed');
  const soft = [...players.values()].find(player => String(player.source).endsWith('chat-soft.wav'));
  failSeek = true;
  await React.act(async () => preview().props.onPress());
  assert.ok(hasPreviewError(), 'real seek failures still show feedback');
  failSeek = false;
  await React.act(async () => preview().props.onPress());
  await React.act(async () => preview().props.onPress());
  assert.equal(soft.played, 2, 'retry and repeated playback work');
  assert.equal(hasPreviewError(), false);
  loaded = false;
  await React.act(async () => tree.update(React.createElement(Picker)));
  assert.equal(preview().props.disabled, true);
  await React.act(async () => preview().props.onPress());
  assert.equal(soft.played, 2, 'unloaded sound never seeks or plays');
  loaded = true;
  await React.act(async () => tree.update(React.createElement(Picker)));
  failSeek = true;
  await React.act(async () => preview().props.onPress());
  assert.ok(hasPreviewError());
  await choose('bell');
  assert.equal(hasPreviewError(), false, 'selecting another sound clears the previous error');
  failSeek = false; deferSeek = true;
  const nextBell = [...players.values()].find(player => String(player.source).endsWith('chat-bell.wav') && !player.released);
  await React.act(async () => preview().props.onPress());
  const oldSeek = resolveSeek;
  await choose('click');
  await React.act(async () => oldSeek());
  assert.equal(nextBell.played, 0, 'switching sounds cancels an unfinished native seek');
  assert.equal(hasPreviewError(), false);
  deferSeek = false;
  await choose('none');
  assert.equal(tree.root.findByProps({ accessibilityLabel: 'previewChatSound:chatSound_none' }).props.disabled, true);
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: 'chatSound' }).props.onPress());
  await React.act(async () => tree.root.findByType('Modal').props.onRequestClose());
  assert.equal(selected, 'none', 'closing the list must not change the selection');
  await choose('soft');
  deferSeek = true;
  const lastSoft = [...players.values()].find(player => String(player.source).endsWith('chat-soft.wav') && !player.released);
  await React.act(async () => preview().props.onPress());
  await React.act(async () => tree.unmount());
  await React.act(async () => resolveSeek());
  assert.equal(lastSoft.played, 0, 'leaving settings cancels pending preview playback');
  console.log('PASS five distinct sounds, persistence/export, native player release, repeated preview/retry, loading guard, error clearing, source switch/unmount cancellation and mute fallback');
})().catch(error => { console.error(error); process.exitCode = 1; });
