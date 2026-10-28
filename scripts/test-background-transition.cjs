const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, globals = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(id => {
    if (id === '../shared/prompts/speakerNames') return require('../shared/prompts/speakerNames');
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts', mocks);
    if (id.startsWith('.')) return load(path.relative(root, path.resolve(root, path.dirname(file), id + '.ts')), mocks);
    return require(id);
  }, mod, mod.exports, ...Object.values(globals));
  return mod.exports;
}
const { EVENT_TIMING } = load('utils/eventPresentation.ts');
const { buildVideoTimeline, videoDimensions } = load('services/videoExport/timeline.ts');
const { paintVideo } = load('services/videoExport/paint.ts');
const story = { script: '호시노 : 하나 [bg : BG_A.jpg]\n호시노 : 둘 [bg : BG_A.jpg]\n호시노 : 셋 [bg : BG_B.jpg, sound : bell.wav]', chatMessages: [] };
const timeline = buildVideoTimeline(story, 1, 1);
const transitions = timeline.scenes.filter(scene => scene.backgroundTransition);
assert.deepEqual(transitions.map(s => [s.backgroundTransition, s.background]), [['out', 'BG_A'], ['in', 'BG_B']]);
assert.ok(transitions.every(scene => scene.duration === EVENT_TIMING.backgroundFade));
const last = timeline.scenes.at(-1);
assert.equal(last.start, transitions[1].start + transitions[1].duration);
assert.equal(timeline.audio[0].start, last.start, 'new line sound starts after transition');
for (const ratio of ['16:9', '9:16']) {
  const { width, height } = videoDimensions(ratio);
  let stack = [], draws = [], texts = [];
  const ctx = { globalAlpha: 1, save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); },
    fillRect() {}, beginPath() {}, rect() {}, clip() {}, drawImage(image) { draws.push([image.id, this.globalAlpha]); },
    fillText(value) { texts.push(value); }, measureText() { return { width: 1 }; },
  };
  const images = new Map(['BG_A', 'BG_B'].map(id => [`bg:${id}`, { id, naturalWidth: width, naturalHeight: height }]));
  for (const scene of transitions) {
    for (const [fraction, opacity] of [[0, scene.backgroundTransition === 'out' ? 1 : 0], [0.5, 0.5], [1, scene.backgroundTransition === 'out' ? 0 : 1]]) {
      draws = []; texts = [];
      paintVideo(ctx, { timeline }, scene, fraction * EVENT_TIMING.backgroundFade, images, width, height);
      assert.equal(draws[0][0], scene.background);
      assert.ok(Math.abs(draws[0][1] - opacity) < 1e-6);
      assert.deepEqual(texts, [], 'no dialogue, caret, choice or HUD during transition');
    }
  }
}

(async () => {
  const originalDocument = global.document;
  const keys = new Set();
  global.document = {
    addEventListener(type, handler) { if (type === 'keydown') keys.add(handler); },
    removeEventListener(type, handler) { if (type === 'keydown') keys.delete(handler); },
  };
  const space = (overrides = {}) => {
    const event = { code: 'Space', key: ' ', preventDefault() { this.defaultPrevented = true; }, ...overrides };
    for (const handler of [...keys]) handler(event);
    return event;
  };
  const animations = [];
  class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } }
  const Animated = { Value, View: 'AnimatedView', timing(value, config) {
    return { start(callback) { animations.push({ value, config, finish() { value.setValue(config.toValue); callback?.({ finished: true }); } }); }, stop() {} };
  }, parallel(items) {
    return { start(callback) {
      let remaining = items.length;
      for (const item of items) item.start(result => { if (--remaining === 0) callback?.(result); });
    }, stop() { for (const item of items) item.stop(); } };
  } };
  const lines = [
    { type: 'dialogue', text: 'one', bg: 'A.jpg' },
    { type: 'dialogue', text: 'two', bg: 'B.jpg' },
    { type: 'dialogue', text: 'three', bg: 'B.jpg' },
    { type: 'dialogue', text: 'four' },
    { type: 'selection', options: ['one', 'two'] },
    ...Array.from({ length: 6 }, () => ({ type: 'selection', options: ['one', 'two'] })),
    { type: 'dialogue', text: 'done' },
  ];
  const sounds = [];
  let selectedSound = 'bell', sfxVolume = 0.35, storyMuted = false, failSound = false;
  const stop = () => {};
  const mocks = { 'react': React,
    'react-native': { Platform: { OS: 'web' }, Animated, View: 'View', Pressable: 'Pressable', TouchableOpacity: 'TouchableOpacity', StyleSheet: { absoluteFill: {}, create: s => s } },
    'expo-asset': { Asset: { loadAsync() {} } }, 'expo-audio': { createAudioPlayer(source) {
      const record = { source, plays: 0, removed: 0, unsubscribed: 0, status: null };
      const player = { volume: 1, play() { if (failSound) throw new Error('audio unavailable'); record.plays++; }, remove() { record.removed++; }, addListener(_type, callback) { record.status = callback; return { remove() { record.unsubscribed++; } }; } };
      record.player = player; sounds.push(record); return player;
    } }, 'expo-router': { useRouter: () => ({ replace() {} }) },
    '@/constants/eventAssets': { bgMap: {}, emotionMap: {}, expressionMap: {}, sfxMap: {} },
    '@/services/sfxVolume': { getSfxVolume: () => sfxVolume }, '@/hooks/useBGM': () => ({ stop, setMusic() {}, muted: storyMuted }),
    '@/services/chatSound': { getChatSound: () => selectedSound },
    '@/constants/chatSounds': { chatSoundSources: { 'Chat_bell.wav': 21, 'Chat_Pop.wav': 22, 'Chat_soft.wav': 23 } },
    '@/hooks/useEventParser': () => lines, '@/hooks/useLayout': { EventFrame: 'EventFrame' }, '@/i18n': { useI18n: () => ({ t: key => key }) },
  };
  for (const name of ['CharacterSprite', 'EventBackground', 'EventHud', 'EventSelection', 'EventVolumeModal', 'TextBox', 'TitleBanner']) mocks['./' + name] = name;
  let dialogueMounts = 0, dialogueUnmounts = 0;
  let typing = false;
  mocks['./TextBox'] = React.forwardRef(function Dialogue(props, ref) {
    React.useImperativeHandle(ref, () => ({ finish() { const wasTyping = typing; typing = false; return wasTyping; } }));
    React.useEffect(() => { dialogueMounts++; return () => { dialogueUnmounts++; }; }, []);
    return React.createElement('TextBox', props);
  });
  const Player = load('components/event/EventPlayer.tsx', mocks).default;
  let tree;
  await React.act(async () => { tree = Renderer.create(React.createElement(Player, { script: '' })); });
  const advance = () => tree.root.findByType('Pressable').props.onPress();
  assert.equal(tree.root.findByType('Pressable').props.style.outlineWidth, 0, 'advance surface must not flash a focus outline');
  assert.equal(tree.root.findByType('Pressable').props.style.outlineStyle, 'none', 'zero width alone does not disable Chromium auto outlines');
  await React.act(async () => space());
  assert.equal(tree.root.findAllByType('TextBox').length, 0);
  assert.equal(animations.length, 1);
  await React.act(async () => advance());
  assert.equal(animations.length, 1, 'taps during transition must not skip lines');
  await React.act(async () => space());
  assert.equal(animations.length, 1, 'space during transition must not skip lines');
  await React.act(async () => animations[0].finish());
  assert.equal(tree.root.findByType('EventBackground').props.bgKey, 'B.jpg');
  assert.equal(animations.length, 1, 'wait for image load before revealing');
  await React.act(async () => tree.root.findByType('EventBackground').props.onReady('B.jpg'));
  assert.equal(animations.length, 2);
  await React.act(async () => animations[1].finish());
  assert.equal(tree.root.findByType('TextBox').props.currentLine.text, 'two');
  const mountsBeforeNext = dialogueMounts;
  const unmountsBeforeNext = dialogueUnmounts;
  for (const ignored of [{ repeat: true }, { isComposing: true }, { ctrlKey: true }, { target: { closest: () => ({}) } }, { target: { isContentEditable: true } }]) {
    await React.act(async () => space(ignored));
    assert.equal(tree.root.findByType('TextBox').props.currentLine.text, 'two');
  }
  await React.act(async () => tree.root.findByType('EventHud').props.onMenu());
  await React.act(async () => space());
  assert.equal(tree.root.findByType('TextBox').props.currentLine.text, 'two', 'space does not advance behind menus');
  await React.act(async () => tree.root.findByType('EventVolumeModal').props.onClose());
  typing = true;
  await React.act(async () => assert.equal(space().defaultPrevented, true));
  assert.equal(typing, false);
  assert.equal(tree.root.findByType('TextBox').props.currentLine.text, 'two', 'first space finishes typing');
  await React.act(async () => space());
  assert.equal(tree.root.findByType('TextBox').props.currentLine.text, 'three');
  assert.equal(dialogueMounts, mountsBeforeNext, 'same-background dialogue must stay mounted');
  assert.equal(dialogueUnmounts, unmountsBeforeNext, 'same-background dialogue must never disappear between frames');
  await React.act(async () => advance());
  assert.equal(tree.root.findByType('TextBox').props.currentLine.text, 'four');
  assert.equal(dialogueMounts, mountsBeforeNext, 'lines without a background directive must stay mounted');
  assert.equal(dialogueUnmounts, unmountsBeforeNext);
  assert.equal(animations.length, 2, 'unchanged background must not transition');
  await React.act(async () => space());
  assert.equal(tree.root.findAllByType('EventSelection').length, 1);
  await React.act(async () => space());
  assert.equal(tree.root.findAllByType('EventSelection').length, 1, 'space must not auto-select a choice');
  assert.equal(sounds.length, 0, 'showing choices does not play the selection sound');
  const choose = () => tree.root.findByType('EventSelection').props.onSelect;
  const firstChoice = choose();
  await React.act(async () => { firstChoice('one'); firstChoice('two'); });
  assert.equal(sounds.length, 1, 'one sound and one advance for a double press');
  assert.equal(sounds[0].source, 21); assert.equal(sounds[0].player.volume, 0.35); assert.equal(sounds[0].plays, 1);
  selectedSound = 'none'; await React.act(async () => choose()('one'));
  assert.equal(sounds.length, 1, 'disabled chat sound also disables choice sounds');
  selectedSound = 'pop'; sfxVolume = 0; await React.act(async () => choose()('one'));
  assert.equal(sounds.length, 1, 'zero SFX volume is silent');
  sfxVolume = 0.8; storyMuted = true;
  await React.act(async () => tree.update(React.createElement(Player, { script: '' })));
  await React.act(async () => choose()('one')); assert.equal(sounds.length, 1, 'story mute is respected');
  storyMuted = false;
  await React.act(async () => tree.update(React.createElement(Player, { script: '' })));
  await React.act(async () => choose()('not-a-choice')); assert.equal(sounds.length, 1);
  await React.act(async () => tree.root.findByType('EventHud').props.onMenu());
  await React.act(async () => choose()('one')); assert.equal(sounds.length, 1, 'no choosing behind a menu');
  await React.act(async () => tree.root.findByType('EventVolumeModal').props.onClose());
  failSound = true;
  await React.act(async () => choose()('one'));
  assert.equal(sounds[1].removed, 1, 'failed audio is released without blocking the next choice');
  failSound = false;
  await React.act(async () => choose()('one'));
  assert.equal(sounds[2].source, 22); assert.equal(sounds[2].player.volume, 0.8);
  selectedSound = 'soft'; await React.act(async () => choose()('one'));
  assert.equal(sounds[3].source, 23, 'changing the setting applies to the next selection');
  assert.equal(tree.root.findByType('TextBox').props.currentLine.text, 'done');
  sounds[0].status({ didJustFinish: true });
  assert.equal(sounds[0].removed, 1, 'finished audio is released');
  await React.act(async () => tree.unmount());
  assert.ok(sounds.every(sound => sound.removed === 1 && sound.unsubscribed === 1), 'no leaked players/listeners or double release on exit');
  assert.equal(keys.size, 0, 'keyboard listener removed when leaving story');
  lines.splice(0, lines.length,
    { type: 'dialogue', text: 'before choices' },
    { type: 'selection', options: ['first', 'second'] },
    { type: 'selection', options: ['first'] },
    { type: 'selection', options: Array.from({ length: 9 }, (_, i) => `choice ${i + 1}`) },
    { type: 'dialogue', text: 'after choices' },
  );
  await React.act(async () => { tree = Renderer.create(React.createElement(Player, { script: '' })); });
  const numberKey = (key, overrides = {}) => space({ key, code: `Digit${key}`, ...overrides });
  await React.act(async () => numberKey('1'));
  assert.equal(tree.root.findByType('TextBox').props.currentLine.text, 'before choices', 'numbers do not advance dialogue');
  await React.act(async () => advance());
  const currentChoice = tree.root.findByType('TextBox').props.currentLine;
  for (const ignored of [
    { repeat: true }, { isComposing: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true },
    { defaultPrevented: true }, { target: { isContentEditable: true } },
    { target: { closest: selector => selector.includes('input') ? {} : null } },
  ]) {
    await React.act(async () => numberKey('1', ignored));
    assert.equal(tree.root.findByType('TextBox').props.currentLine, currentChoice);
  }
  for (const key of ['0', '3', '9']) {
    await React.act(async () => numberKey(key));
    assert.equal(tree.root.findByType('TextBox').props.currentLine, currentChoice, 'unavailable numbers do not select');
  }
  await React.act(async () => tree.root.findByType('EventHud').props.onMenu());
  await React.act(async () => numberKey('1'));
  assert.equal(tree.root.findByType('TextBox').props.currentLine, currentChoice, 'numbers do not select behind a menu');
  await React.act(async () => tree.root.findByType('EventVolumeModal').props.onClose());
  await React.act(async () => {
    assert.equal(numberKey('2', { target: { closest: selector => selector.includes('button') ? {} : null } }).defaultPrevented, true);
    numberKey('1');
  });
  assert.deepEqual(tree.root.findByType('EventSelection').props.options, ['first'], 'a number selects once even with a button focused');
  await React.act(async () => numberKey('2'));
  assert.deepEqual(tree.root.findByType('EventSelection').props.options, ['first'], '2 cannot select the first option');
  await React.act(async () => numberKey('1', { repeat: true }));
  assert.deepEqual(tree.root.findByType('EventSelection').props.options, ['first'], 'holding a key cannot choose again');
  await React.act(async () => numberKey('1'));
  assert.equal(tree.root.findByType('EventSelection').props.options.length, 9, '1 selects the top option');
  await React.act(async () => numberKey('9', { code: 'Numpad9' }));
  assert.equal(tree.root.findByType('TextBox').props.currentLine.text, 'after choices', 'numpad digits also select');
  await React.act(async () => tree.unmount());
  assert.equal(keys.size, 0, 'number key listener removed on exit');
  let completions = 0;
  lines.splice(0, lines.length, { type: 'dialogue', text: 'not finished' }, { type: 'narration', text: 'ending' }, { type: 'command', commandType: 'endEvent' });
  await React.act(async () => { tree = Renderer.create(React.createElement(Player, { script: '', onComplete: () => completions++ })); });
  await React.act(async () => tree.root.findByType('EventHud').props.onMenu());
  await React.act(async () => tree.root.findByType('EventVolumeModal').props.onExit());
  assert.equal(completions, 0, 'leaving a story early must not reset the chat');
  await React.act(async () => tree.unmount());
  lines.splice(0, lines.length, { type: 'narration', text: 'ending' }, { type: 'command', commandType: 'endEvent' });
  await React.act(async () => { tree = Renderer.create(React.createElement(Player, { script: '', onComplete: () => completions++ })); });
  typing = true;
  await React.act(async () => advance());
  assert.equal(completions, 0, 'revealing the last sentence is not completion');
  await React.act(async () => advance());
  await React.act(async () => advance());
  assert.equal(completions, 1, 'finishing the ending resets the chat exactly once');
  await React.act(async () => tree.unmount());
  lines.splice(0, lines.length, { type: 'command', commandType: 'endEvent' });
  await React.act(async () => { tree = Renderer.create(React.createElement(Player, { script: '', onComplete: () => completions++ })); });
  assert.equal(completions, 2, 'explicit endEvent completes and returns home');
  await React.act(async () => tree.unmount());
  for (const resumeScene of [false, true]) {
    lines.splice(0, lines.length,
      { type: 'dialogue', text: 'before', bg: 'A.jpg', emotion: 'first' },
      { type: 'command', commandType: 'deleteAll' },
      { type: 'narration', text: 'black screen' },
      ...(resumeScene ? [{ type: 'dialogue', text: 'after', bg: 'B.jpg', emotion: 'second' }] : []),
      { type: 'command', commandType: 'endEvent' },
    );
    await React.act(async () => { tree = Renderer.create(React.createElement(Player, { script: '' })); });
    const backgroundOpacity = tree.root.findByType('EventBackground').props.fadeAnim;
    const spriteOpacity = tree.root.findByType('CharacterSprite').props.fadeAnim;
    const fadeStart = animations.length;
    await React.act(async () => advance());
    const fades = animations.slice(fadeStart);
    assert.equal(fades.length, 2);
    await React.act(async () => { for (const fade of fades) fade.finish(); });
    assert.equal(tree.root.findByType('TextBox').props.currentLine.text, 'black screen');
    assert.equal(tree.root.findByType('EventBackground').props.bgKey, null);
    assert.equal(tree.root.findByType('CharacterSprite').props.current, null);
    assert.equal(backgroundOpacity.value, 0, 'deleteAll must not reveal the old background before its image is removed');
    assert.equal(spriteOpacity.value, 0, 'deleteAll must keep cached sprite images hidden on the black screen');
    if (resumeScene) {
      await React.act(async () => advance());
      assert.equal(tree.root.findByType('EventBackground').props.bgKey, 'B.jpg');
      assert.equal(tree.root.findByType('CharacterSprite').props.current, 'second');
      assert.equal(backgroundOpacity.value, 1, 'a later background must become visible again');
      assert.equal(spriteOpacity.value, 1, 'a later sprite must become visible again');
    }
    await React.act(async () => tree.unmount());
  }
  global.document = originalDocument;
  // Real dialogue components opt out of native selection and web user-select,
  // while retaining the press handler and typewriter completion API.
  const dialogueMocks = {
    react: React,
    'react-native': { Platform: { OS: 'web' }, View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { absoluteFill: {}, create: s => s } },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    '@/hooks/useLayout': { useLayout: () => ({ eventWidth: 1280, eventHeight: 720 }), storyFont: (_w, h, fraction) => h * fraction },
  };
  const RealDialogue = load('components/event/EventDialogue.tsx', dialogueMocks).default;
  const RealTextBox = load('components/event/TextBox.tsx', { ...dialogueMocks, './EventDialogue': RealDialogue }).default;
  const dialogueRef = React.createRef();
  let presses = 0;
  const spoken = { type: 'dialogue', character: '호시노(아비도스)', text: '안녕하세요' };
  await React.act(async () => { tree = Renderer.create(React.createElement(RealTextBox, { ref: dialogueRef, currentLine: spoken, lastSpoken: spoken, onPress: () => presses++ })); });
  assert.ok(tree.root.findAllByType('Text').length >= 4);
  assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === 'SPACE'), 'web dialogue shows SPACE above the caret');
  assert.equal(tree.root.findByType('Pressable').props.style.outlineWidth, 0, 'dialogue surface must not flash a focus outline');
  assert.equal(tree.root.findByType('Pressable').props.style.outlineStyle, 'none');
  for (const text of tree.root.findAllByType('Text')) assert.equal(text.props.selectable, false);
  await React.act(async () => assert.equal(dialogueRef.current.finish(), true));
  assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === spoken.text));
  await React.act(async () => tree.root.findByType('Pressable').props.onPress());
  assert.equal(presses, 1);
  await React.act(async () => tree.unmount());
  for (const platform of ['android', 'ios']) {
    dialogueMocks['react-native'].Platform.OS = platform;
    await React.act(async () => { tree = Renderer.create(React.createElement(RealTextBox, { currentLine: spoken, lastSpoken: spoken })); });
    assert.equal(tree.root.findAllByType('Text').some(text => text.props.children === 'SPACE'), false, 'native app has no keyboard hint');
    await React.act(async () => tree.unmount());
  }
  dialogueMocks['react-native'].Platform.OS = 'web';
  let fontLoaded = false, fontError = null;
  const selectionPlatform = { OS: 'web' };
  let resolveFont, fontRequests = 0;
  global.document = { fonts: { load: async (font, text) => {
    fontRequests++;
    assert.equal(font, '400 16px "PretendardSemiBold"');
    assert.ok(text.includes('선택지'));
    return new Promise(resolve => { resolveFont = resolve; });
  } } };
  const fontMocks = {
    react: React, 'react-native': { Platform: selectionPlatform },
    'expo-font': { useFonts: () => [fontLoaded, fontError] },
    '../assets/fonts/Pretendard-SemiBold.ttf': 1,
  };
  const selectionFont = load('hooks/useSelectionFont.ts', fontMocks);
  const RealSelection = load('components/event/EventSelection.tsx', {
    ...dialogueMocks,
    'react-native': { Platform: selectionPlatform, View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', StyleSheet: { create: s => s } },
    '@/hooks/useSelectionFont': selectionFont,
  }).default;
  const selection = React.createElement(RealSelection, { options: ['first', 'second'], onSelect() {} });
  await React.act(async () => { tree = Renderer.create(selection); });
  assert.equal(tree.root.findAllByType('Text').length, 0, 'first choices never flash the fallback font while loading');
  fontLoaded = true;
  await React.act(async () => tree.update(React.cloneElement(selection)));
  assert.equal(tree.root.findAllByType('Text').length, 0, 'a registered CSS font is not ready until browser font data loads');
  await React.act(async () => resolveFont([{ status: 'loaded' }]));
  assert.deepEqual(tree.root.findAllByType('Text').map(text => text.props.children), [1, 'first', 2, 'second'], 'web choices have numbers in display order');
  for (const text of tree.root.findAllByType('Text').filter(text => typeof text.props.children === 'string')) assert.ok(text.props.style.fontFamily.startsWith('PretendardSemiBold'));
  await React.act(async () => tree.unmount());
  await React.act(async () => { tree = Renderer.create(selection); });
  assert.equal(tree.root.findAllByType('Text').length, 4, 'later choices use the cached font immediately');
  assert.equal(fontRequests, 1, 'startup and later selections share browser font readiness');
  await React.act(async () => tree.unmount());
  for (const platform of ['android', 'ios']) {
    selectionPlatform.OS = platform;
    await React.act(async () => { tree = Renderer.create(selection); });
    assert.deepEqual(tree.root.findAllByType('Text').map(text => text.props.children), ['first', 'second'], 'native choices have no number badges');
    assert.equal(tree.root.findAllByType('Text')[0].props.style.fontFamily, 'PretendardSemiBold', 'native uses one registered font family');
    await React.act(async () => tree.unmount());
  }
  selectionPlatform.OS = 'web';
  fontLoaded = false; fontError = new Error('font unavailable');
  await React.act(async () => { tree = Renderer.create(selection); });
  assert.equal(tree.root.findAllByType('TouchableOpacity').length, 2, 'a font load failure must not block story choices');
  await React.act(async () => tree.unmount());
  fontLoaded = true; fontError = null;
  let timeout, resolveLateFont;
  global.document = { fonts: { load: () => new Promise(resolve => { resolveLateFont = resolve; }) } };
  const slowFont = load('hooks/useSelectionFont.ts', fontMocks, {
    setTimeout: (callback, delay) => { assert.equal(delay, 12000); timeout = callback; return 1; }, clearTimeout() {},
  });
  const SlowSelection = load('components/event/EventSelection.tsx', {
    ...dialogueMocks,
    'react-native': { Platform: selectionPlatform, View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', StyleSheet: { create: s => s } },
    '@/hooks/useSelectionFont': slowFont,
  }).default;
  await React.act(async () => { tree = Renderer.create(React.createElement(SlowSelection, { options: ['slow choice'], onSelect() {} })); });
  assert.equal(tree.root.findAllByType('Text').length, 0);
  await React.act(async () => timeout());
  const choiceFont = () => tree.root.findAllByType('Text').find(node => node.props.children === 'slow choice').props.style.fontFamily;
  assert.ok(!choiceFont().includes('PretendardSemiBold'), 'timeout shows stable fallback choices');
  await React.act(async () => resolveLateFont([{ status: 'loaded' }]));
  assert.ok(!choiceFont().includes('PretendardSemiBold'), 'late downloads cannot swap an already visible fallback font');
  await React.act(async () => tree.unmount());
  global.document = originalDocument;
  console.log('PASS live background fade/load gating, hidden dialogue, tap guard, unchanged background, MP4 timing and opacity in both ratios');
})().catch(error => { console.error(error); process.exitCode = 1; });
