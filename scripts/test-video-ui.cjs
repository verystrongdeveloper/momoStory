const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(file, mocks) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), mod, mod.exports);
  return mod.exports;
}
(async () => {
  const rn = { ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', Platform: { OS: 'android' }, ScrollView: 'ScrollView', Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View', TextInput: 'TextInput', Image: 'Image', StyleSheet: { create: (s) => s } };
  const i18n = { useI18n: () => ({ language: 'ko', t: (key) => key }) };
  const pickerMocks = {
    '@/services/videoExport/types': { videoFileName: (title, ratio) => `${title}_${ratio.replace(':', 'x')}.mp4` },
    '@/platform/videoSave': { chooseVideoSaveTarget: async () => undefined },
  };
  const story = { id: 'id', title: 'test', character: '호시노', script: '호시노 : 안녕', createdAt: 1 };
  let prepared, closed = 0, prepareCount = 0;
  const Modal = load('components/chat/VideoExportModal.tsx', {
    ...pickerMocks,
    'react-native': rn, '@/i18n': i18n,
    '@/services/videoExport/prepare': { prepareVideo: async (...args) => { prepareCount++; prepared = args; return { title: 'test', ratio: args[1] }; } },
    '@/platform/VideoExportWorker': 'VideoExportWorker',
  }).default;
  let tree;
  await React.act(async () => { tree = Renderer.create(React.createElement(Modal, { story, onClose: () => closed++ })); });
  const button = (label) => tree.root.findAllByType('TouchableOpacity').find((node) => node.findAllByType('Text').some((text) => text.props.children === label));
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: '9:16' }).props.onPress());
  await React.act(async () => { button('videoDownload').props.onPress(); button('videoDownload').props.onPress(); });
  assert.equal(prepared[1], '9:16');
  assert.equal(prepared[4].includeChat, true, 'default keeps chat included');
  assert.equal(prepareCount, 1);
  assert.equal(tree.root.findByType('VideoExportWorker').props.payload.ratio, '9:16');
  await React.act(async () => tree.root.findByType('VideoExportWorker').props.options.onProgress({ phase: 'saving', progress: 0.97 }));
  assert.equal(button('cancel').props.disabled, true);
  await React.act(async () => tree.root.findByType('VideoExportWorker').props.onComplete());
  assert.ok(tree.root.findAllByType('Text').some((text) => text.props.children === 'videoSavedDownloads'));
  assert.equal(tree.root.findAllByType('VideoExportWorker').length, 0);
  await React.act(async () => button('close').props.onPress());
  assert.equal(closed, 1);
  await React.act(async () => tree.unmount());
  assert.equal(prepared[4].signal.aborted, true);
  await React.act(async () => { tree = Renderer.create(React.createElement(Modal, { story, onClose() {} })); });
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: 'videoExcludeChat' }).props.onPress());
  assert.equal(tree.root.findByProps({ accessibilityLabel: 'videoExcludeChat' }).props.accessibilityState.checked, true);
  await React.act(async () => button('videoDownload').props.onPress());
  assert.equal(prepared[4].includeChat, false, 'story-only selection reaches export preparation');
  await React.act(async () => tree.unmount());

  let canceledSignal;
  const Pending = load('components/chat/VideoExportModal.tsx', {
    ...pickerMocks,
    'react-native': rn, '@/i18n': i18n,
    '@/services/videoExport/prepare': { prepareVideo: (...args) => { canceledSignal = args[4].signal; return new Promise(() => {}); } },
    '@/platform/VideoExportWorker': 'VideoExportWorker',
  }).default;
  await React.act(async () => { tree = Renderer.create(React.createElement(Pending, { story, onClose: () => closed++ })); });
  await React.act(async () => button('videoDownload').props.onPress());
  await React.act(async () => button('cancel').props.onPress());
  assert.equal(canceledSignal.aborted, true);
  await React.act(async () => tree.unmount());

  // Desktop asks for a destination before preparing or encoding anything.
  rn.Platform.OS = 'web';
  const order = [];
  const target = { kind: 'save-as', save: async () => {} };
  let pickerCanceled = false;
  const Desktop = load('components/chat/VideoExportModal.tsx', {
    ...pickerMocks, 'react-native': rn, '@/i18n': i18n,
    '@/platform/videoSave': { chooseVideoSaveTarget: async (filename) => { order.push('picker'); assert.equal(filename, 'test_16x9.mp4'); return pickerCanceled ? null : target; } },
    '@/services/videoExport/prepare': { prepareVideo: async () => { order.push('prepare'); return { title: 'test' }; } },
    '@/platform/VideoExportWorker': 'VideoExportWorker',
  }).default;
  await React.act(async () => { tree = Renderer.create(React.createElement(Desktop, { story, onClose() {} })); });
  await React.act(async () => button('videoDownload').props.onPress());
  assert.deepEqual(order, ['picker', 'prepare']);
  assert.equal(tree.root.findByType('VideoExportWorker').props.destination, target);
  await React.act(async () => tree.root.findByType('VideoExportWorker').props.onComplete());
  assert.ok(tree.root.findAllByType('Text').some((text) => text.props.children === 'videoSavedFile'));
  await React.act(async () => tree.unmount());
  pickerCanceled = true; order.length = 0;
  await React.act(async () => { tree = Renderer.create(React.createElement(Desktop, { story, onClose() {} })); });
  await React.act(async () => button('videoDownload').props.onPress());
  assert.deepEqual(order, ['picker']);
  assert.equal(tree.root.findAllByType('VideoExportWorker').length, 0);
  assert.ok(button('videoDownload'));
  await React.act(async () => tree.unmount());

  // A slow/native save dialog must show no preparation progress or encoder.
  let resolvePicker;
  let selectionSignal;
  let delayedPrepareCount = 0;
  const WaitingForPath = load('components/chat/VideoExportModal.tsx', {
    ...pickerMocks, 'react-native': rn, '@/i18n': i18n,
    '@/platform/videoSave': { chooseVideoSaveTarget: (_filename, signal) => { selectionSignal = signal; return new Promise(resolve => { resolvePicker = resolve; }); } },
    '@/services/videoExport/prepare': { prepareVideo: async () => { delayedPrepareCount++; return { title: 'test' }; } },
    '@/platform/VideoExportWorker': 'VideoExportWorker',
  }).default;
  await React.act(async () => { tree = Renderer.create(React.createElement(WaitingForPath, { story, onClose() {} })); });
  await React.act(async () => button('videoDownload').props.onPress());
  assert.equal(delayedPrepareCount, 0);
  assert.equal(tree.root.findAllByType('ActivityIndicator').length, 0);
  assert.equal(tree.root.findAllByType('VideoExportWorker').length, 0);
  assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === 'videoChooseLocation'));
  await React.act(async () => resolvePicker(target));
  assert.equal(delayedPrepareCount, 1);
  await React.act(async () => tree.unmount());
  await React.act(async () => { tree = Renderer.create(React.createElement(WaitingForPath, { story, onClose() {} })); });
  await React.act(async () => button('videoDownload').props.onPress());
  await React.act(async () => button('cancel').props.onPress());
  assert.equal(selectionSignal.aborted, true);
  await React.act(async () => resolvePicker(null));
  assert.equal(delayedPrepareCount, 1);
  await React.act(async () => tree.unmount());

  // Failure messages must identify the phase, not assume storage is full.
  for (const failurePhase of ['preparing', 'encoding', 'saving']) {
    const Broken = load('components/chat/VideoExportModal.tsx', {
      ...pickerMocks, 'react-native': rn, '@/i18n': i18n,
      '@/services/videoExport/prepare': { prepareVideo: async () => {
        if (failurePhase === 'preparing') throw new Error('resource unavailable');
        return { title: 'test' };
      } },
      '@/platform/VideoExportWorker': 'VideoExportWorker',
    }).default;
    const originalError = console.error;
    try {
      console.error = () => {};
      await React.act(async () => { tree = Renderer.create(React.createElement(Broken, { story, onClose() {} })); });
      await React.act(async () => button('videoDownload').props.onPress());
      if (failurePhase !== 'preparing') {
        await React.act(async () => {
          const worker = tree.root.findByType('VideoExportWorker');
          // Progress and failure can arrive in the same tick, before re-render.
          worker.props.options.onProgress({ phase: failurePhase, progress: 0.5 });
          worker.props.onError(new Error('failure'));
        });
      }
      const key = { preparing: 'videoPrepareFailed', encoding: 'videoEncodeFailed', saving: 'videoSaveFailed' }[failurePhase];
      assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === key));
      assert.ok(button('videoDownload'), 'failure must allow retry');
      await React.act(async () => tree.unmount());
    } finally { console.error = originalError; }
  }

  const List = load('components/chat/StoryLibraryList.tsx', {
    './StoryScriptEditor': 'StoryScriptEditor',
    '@/components/community/PublishStoryModal': 'PublishStoryModal',
    'react-native': rn, '@expo/vector-icons': { Ionicons: 'Ionicons' }, '@/constants/characters': { avatarOf: () => undefined, displayCharacterName: (name) => name },
    '@/hooks/useLayout': { useLayout: () => ({ isCompact: true }) }, '@/components/chat/StoryAssetPanel': 'StoryAssetPanel', './VideoExportModal': 'VideoExportModal',
    '@/store/storyLibrary': { listStories: () => [story], subscribeStories: () => () => {} }, '@/utils/insertStoryAsset': {}, '@/platform/clipboard': {}, '@/utils/storyFile': {}, '@/utils/storyPrompt': {}, '@/i18n': i18n,
  }).default;
  await React.act(async () => { tree = Renderer.create(React.createElement(List, { onOpenStory() {} })); });
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: 'storyMenu' }).props.onPress());
  assert.ok(button('export'));
  await React.act(async () => button('exportVideo').props.onPress());
  assert.equal(tree.root.findByType('VideoExportModal').props.story.id, story.id);
  await React.act(async () => tree.root.findByType('VideoExportModal').props.onClose());
  assert.equal(tree.root.findAllByType('VideoExportModal').length, 0);
  await React.act(async () => tree.unmount());
  console.log('PASS library video menu, ratio selection, progress, save completion, duplicate start guard, cancellation, desktop save picker ordering and picker cancellation');
})().catch((error) => { console.error(error); process.exitCode = 1; });
