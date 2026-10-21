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
  const rn = { Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View', TextInput: 'TextInput', Image: 'Image', ActivityIndicator: 'ActivityIndicator', Platform: { OS: 'android' }, StyleSheet: { absoluteFillObject: {}, create: s => s } };
  const i18n = { useI18n: () => ({ language: 'ko', t: key => key }) };
  const story = { id: 'id', title: 'test', character: '호시노', script: '호시노 : 안녕', createdAt: 1 };
  let pickerCalls = 0, prepareCalls = [], closed = 0, target, pickerOverride, resolvePrepare;
  const dependencies = {
    '@/services/videoExport/prepare': { prepareVideo: (...args) => { prepareCalls.push(args); return new Promise(resolve => { resolvePrepare = resolve; }); } },
    '@/services/videoExport/types': { videoFileName: (title, ratio) => title + '_' + ratio.replace(':', 'x') + '.mp4' },
    '@/platform/videoSave': { chooseVideoSaveTarget: (...args) => { pickerCalls++; return pickerOverride ? pickerOverride(...args) : Promise.resolve(target); } },
  };
  const jobs = load('store/videoExportJob.ts', dependencies);
  const dimensions = load('services/videoExport/timeline.ts', { '@/utils/parseEventScript': {}, '../../utils/eventPresentation': {}, '../../utils/chatPresentation': {} });
  const uiMocks = { react: React, 'react-native': rn, '@/i18n': i18n, '@/store/videoExportJob': jobs, '@/services/videoExport/timeline': dimensions };
  const Options = load('components/chat/VideoExportModal.tsx', uiMocks).default;
  const Host = load('components/layout/VideoExportHost.tsx', { ...uiMocks, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) }, '@/platform/VideoExportWorker': 'VideoExportWorker' }).default;
  function Harness({ screen = 'library' }) {
    const [show, setShow] = React.useState(true);
    return React.createElement(React.Fragment, null,
      React.createElement('Screen', { screen }),
      show && React.createElement(Options, { story, onClose() { closed++; setShow(false); } }),
      React.createElement(Host));
  }
  let tree;
  const mount = async () => React.act(async () => { tree = Renderer.create(React.createElement(Harness)); });
  const button = key => tree.root.findAllByType('TouchableOpacity').find(node => node.findAllByType('Text').some(text => text.props.children === key));
  const has = key => tree.root.findAllByType('Text').some(text => text.props.children === key);
  await mount();
  assert.equal(tree.root.findByProps({ accessibilityLabel: '720p' }).props.accessibilityState.checked, true);
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: '1080p' }).props.onPress());
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: '9:16' }).props.onPress());
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: 'videoExcludeChat' }).props.onPress());
  await React.act(async () => { button('videoDownload').props.onPress(); button('videoDownload').props.onPress(); });
  assert.equal(pickerCalls, 1); assert.equal(prepareCalls.length, 1);
  assert.equal(prepareCalls[0][1], '9:16'); assert.equal(prepareCalls[0][4].includeChat, false);
  assert.equal(prepareCalls[0][4].quality, '1080p', 'selected quality survives closing the export options');
  assert.equal(closed, 1); assert.equal(tree.root.findAllByType('Modal').length, 0, 'options close before preparation finishes');
  const running = jobs.getVideoExportJob();
  await React.act(async () => tree.update(React.createElement(Harness, { screen: 'chat' })));
  assert.equal(running.controller.signal.aborted, false, 'screen navigation does not cancel export');
  assert.equal(jobs.beginVideoExport(story, '16:9', 'ko', {}, true), null, 'only one export may run');
  await React.act(async () => resolvePrepare({ title: story.title, ratio: '9:16', quality: prepareCalls[0][4].quality }));
  const worker = () => tree.root.findByType('VideoExportWorker');
  assert.equal(worker().props.payload.ratio, '9:16');
  assert.equal(worker().props.payload.quality, '1080p');
  await React.act(async () => worker().props.options.onProgress({ phase: 'saving', progress: 0.97 }));
  assert.equal(button('cancel').props.disabled, true, 'final save cannot be interrupted');
  assert.equal(jobs.cancelVideoExport(running.id), false);
  await React.act(async () => worker().props.onComplete());
  assert.ok(has('videoSavedDownloads')); assert.equal(tree.root.findAllByType('VideoExportWorker').length, 0);
  await React.act(async () => button('close').props.onPress());
  assert.equal(jobs.getVideoExportJob(), null);
  await React.act(async () => tree.unmount());

  await mount();
  await React.act(async () => button('videoDownload').props.onPress());
  assert.equal(prepareCalls.at(-1)[4].quality, '720p', 'default quality retains the existing export size');
  const canceled = jobs.getVideoExportJob();
  await React.act(async () => button('cancel').props.onPress());
  assert.equal(canceled.controller.signal.aborted, true);
  await React.act(async () => resolvePrepare({ title: 'late result' }));
  assert.equal(tree.root.findAllByType('VideoExportWorker').length, 0);
  assert.ok(has('videoExportCanceled'));
  await React.act(async () => button('close').props.onPress());
  await React.act(async () => tree.unmount());

  // A pending desktop save picker owns no encoder and is canceled with its modal.
  rn.Platform.OS = 'web';
  let resolvePicker, selectionSignal, targetCancels = 0;
  target = { kind: 'save-as', save: async () => {}, cancel: async () => { targetCancels++; } };
  pickerOverride = (_name, signal) => { selectionSignal = signal; return new Promise(resolve => { resolvePicker = resolve; }); };
  const previousPrepares = prepareCalls.length;
  await mount();
  await React.act(async () => button('videoDownload').props.onPress());
  assert.ok(has('videoChooseLocation'));
  assert.equal(prepareCalls.length, previousPrepares);
  assert.equal(tree.root.findAllByType('VideoExportWorker').length, 0);
  await React.act(async () => button('cancel').props.onPress());
  assert.equal(selectionSignal.aborted, true);
  await React.act(async () => resolvePicker(target));
  assert.equal(targetCancels, 1, 'late save target is released');
  assert.equal(prepareCalls.length, previousPrepares);
  await React.act(async () => jobs.dismissVideoExport());
  await React.act(async () => tree.unmount());

  pickerOverride = undefined;
  await mount();
  await React.act(async () => button('videoDownload').props.onPress());
  const desktopId = jobs.getVideoExportJob().id;
  await React.act(async () => resolvePrepare({ title: 'test', ratio: '16:9' }));
  assert.equal(worker().props.destination, target);
  await React.act(async () => worker().props.onComplete());
  assert.ok(has('videoSavedFile'));
  await React.act(async () => jobs.dismissVideoExport());
  await React.act(async () => tree.unmount());

  for (const phase of ['preparing', 'encoding', 'saving']) {
    await mount();
    await React.act(async () => button('videoDownload').props.onPress());
    const id = jobs.getVideoExportJob().id;
    await React.act(async () => {
      jobs.reportVideoExport(id, { phase, progress: 0.5 });
      jobs.failVideoExport(id, new Error('failure'));
    });
    assert.ok(has({ preparing: 'videoPrepareFailed', encoding: 'videoEncodeFailed', saving: 'videoSaveFailed' }[phase]));
    await React.act(async () => resolvePrepare({ title: 'late result' }));
    assert.equal(tree.root.findAllByType('VideoExportWorker').length, 0);
    await React.act(async () => jobs.dismissVideoExport());
    await React.act(async () => tree.unmount());
  }
  target = null;
  await mount();
  await React.act(async () => button('videoDownload').props.onPress());
  assert.ok(button('videoDownload'), 'canceling the picker leaves options available');
  const id = jobs.getVideoExportJob().id;
  await React.act(async () => jobs.completeVideoExport(desktopId));
  assert.equal(jobs.getVideoExportJob().id, id, 'old worker callbacks cannot change another job');
  await React.act(async () => jobs.dismissVideoExport());
  await React.act(async () => tree.unmount());

  story.script = 'title : Thumbnail\n호시노 : first [bg : BG_AbydosCouncilRoom.jpg]\n호시노 : next [bg : BG_Second.jpg]\nendEvent';
  const List = load('components/chat/StoryLibraryList.tsx', {
    '@/constants/eventAssets': { bgMap: { BG_AbydosCouncilRoom: 'first-background', BG_Second: 'second-background' } },
    '@/utils/parseEventScript': load('utils/parseEventScript.ts', {}),
    './StoryScriptEditor': 'StoryScriptEditor',
    '@/components/community/PublishStoryModal': 'PublishStoryModal',
    'react-native': rn, '@expo/vector-icons': { Ionicons: 'Ionicons' }, '@/constants/characters': { avatarOf: () => 'avatar', displayCharacterName: (name) => name },
    '@/hooks/useLayout': { useLayout: () => ({ isCompact: true }) }, '@/components/CharacterAvatar': 'CharacterAvatar', '@/components/chat/StoryAssetPanel': 'StoryAssetPanel', './VideoExportModal': 'VideoExportModal',
    '@/store/storyLibrary': { listStories: () => [story], subscribeStories: () => () => {} }, '@/utils/insertStoryAsset': {}, '@/platform/clipboard': {}, '@/utils/storyFile': {}, '@/utils/storyPrompt': {}, '@/i18n': i18n,
  }).default;
  await React.act(async () => { tree = Renderer.create(React.createElement(List, { onOpenStory() {} })); });
  assert.equal(tree.root.findByType('Image').props.source, 'first-background', 'library thumbnail uses the first rendered BG, not later backgrounds');
  assert.equal(tree.root.findByType('Image').props.style.position, 'absolute');
  assert.equal(tree.root.findByType('CharacterAvatar').props.style.at(-1).backgroundColor, 'transparent', 'portrait does not hide the story background');
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: 'storyMenu' }).props.onPress());
  assert.ok(button('export'));
  await React.act(async () => button('exportVideo').props.onPress());
  assert.equal(tree.root.findByType('VideoExportModal').props.story.id, story.id);
  await React.act(async () => tree.root.findByType('VideoExportModal').props.onClose());
  assert.equal(tree.root.findAllByType('VideoExportModal').length, 0);
  await React.act(async () => tree.unmount());
  console.log('PASS global export survives closed options/navigation, ratios/chat modes, duplicate guard, cancellation, picker ordering, save protection, phase errors, completion notices and library entry');
})().catch(error => { console.error(error); process.exitCode = 1; });
