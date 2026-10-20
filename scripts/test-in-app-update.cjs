const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.join(__dirname, '..');
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    assert.ok(Object.hasOwn(mocks, id), `Unexpected import ${id}`); return mocks[id];
  }, mod, mod.exports);
  return mod.exports;
}
const release = { available: true, version: '2.0.0', url: 'https://github.com/verystrongdeveloper/momoStory/releases/tag/v2.0.0',
  android: { url: 'https://github.com/verystrongdeveloper/momoStory/releases/download/v2.0.0/MomoStory.apk', sha256: 'a'.repeat(64), size: 123 } };
(async () => {
  // Only validated official release metadata can supply a native download.
  const updateApi = load('services/appUpdate.ts');
  const oldFetch = global.fetch;
  const apk = { name: 'MomoStory.apk', browser_download_url: release.android.url, digest: 'sha256:' + 'a'.repeat(64), size: 123 };
  try {
    for (const [asset, accepted] of [[apk, true], [{ ...apk, browser_download_url: 'https://evil.test/app.apk' }, false],
      [{ ...apk, digest: null }, false], [{ ...apk, digest: 'sha256:nope' }, false], [{ ...apk, size: 0 }, false],
      [{ ...apk, size: 600 * 1024 * 1024 }, false], [{ ...apk, name: 'Other.apk' }, false]]) {
      global.fetch = async () => ({ ok: true, json: async () => ({ tag_name: 'v2.0.0', draft: false, prerelease: false, assets: [asset] }) });
      const result = await updateApi.checkAppUpdate('1.0.0');
      assert.equal(!!result.android, accepted);
      if (accepted) assert.deepEqual(result.android, release.android);
    }
  } finally { global.fetch = oldFetch; }

  const progress = []; let closed = 0, installs = 0;
  const candidate = { version: '2.0.0', download: async fn => {
    fn({ event: 'Started', data: { contentLength: 100 } }); fn({ event: 'Progress', data: { chunkLength: 40 } }); fn({ event: 'Finished' });
  }, install: async options => { assert.equal(options.restartAfterInstall, true); installs++; }, close: async () => { closed++; } };
  const web = load('platform/inAppUpdate.web.ts', { '@tauri-apps/plugin-updater': { check: async () => candidate } });
  global.window = {};
  assert.equal(web.supportsInAppUpdate(), false);
  await assert.rejects(web.downloadAppUpdate(release, () => {}));
  global.window = { __TAURI_INTERNALS__: {} };
  const prepared = await web.downloadAppUpdate(release, value => progress.push(value));
  assert.deepEqual(progress, [0, .4, 1]); assert.equal(installs, 0, 'download never installs automatically');
  await prepared.install(); assert.equal(installs, 1); await prepared.close();
  candidate.version = '2.1.0';
  await assert.rejects(web.downloadAppUpdate(release, () => {}), /RELEASE_CHANGED/);
  assert.equal(closed, 2, 'resources close on version races');
  delete global.window;

  let removed = 0, callback, nativeInstall = 'permission';
  const nativeModule = { download: async (...args) => {
    assert.deepEqual(args, [release.android.url, release.android.sha256, 123, '2.0.0']); callback({ received: 61.5, total: 123 });
  }, install: async () => nativeInstall };
  const native = load('platform/inAppUpdate.ts', { 'react-native': {
    Platform: { OS: 'android' }, NativeModules: { MomoAppUpdate: nativeModule },
    NativeEventEmitter: class { addListener(name, cb) { assert.equal(name, 'MomoUpdateProgress'); callback = cb; return { remove() { removed++; } }; } },
  } });
  const nativePrepared = await native.downloadAppUpdate(release, value => assert.equal(value, .5));
  assert.equal(removed, 1); assert.equal(await nativePrepared.install(), 'permission');
  nativeInstall = 'opened'; assert.equal(await nativePrepared.install(), 'opened');
  await assert.rejects(native.downloadAppUpdate({ ...release, android: undefined }, () => {}), /UNAVAILABLE/);

  // Job persists without components, rejects duplicate clicks, allows permission/installer retries.
  let resolveDownload, downloads = 0, closeJob = 0;
  const job = load('store/appUpdateJob.ts', { '@/platform/inAppUpdate': { downloadAppUpdate: () => {
    downloads++; return new Promise(resolve => { resolveDownload = resolve; });
  } } });
  const first = job.beginAppUpdate(release); await Promise.resolve();
  await job.beginAppUpdate(release); assert.equal(downloads, 1);
  await job.installAppUpdate(); assert.equal(job.getAppUpdateJob().status, 'downloading');
  resolveDownload({ install: async () => nativeInstall, close: async () => { closeJob++; } }); await first;
  nativeInstall = 'permission'; await job.installAppUpdate(); assert.equal(job.getAppUpdateJob().status, 'permission');
  nativeInstall = 'opened'; await job.installAppUpdate(); assert.equal(job.getAppUpdateJob().status, 'opened');
  await job.installAppUpdate(); assert.equal(job.getAppUpdateJob().status, 'opened');
  const retry = job.beginAppUpdate(release); await Promise.resolve();
  resolveDownload({ install: async () => { throw Error('failed'); }, close: async () => {} }); await retry;
  assert.equal(closeJob, 1); await job.installAppUpdate(); assert.equal(job.getAppUpdateJob().status, 'error');

  // Shared UI has an explicit notice + download confirmation, and a separate install step.
  let uiState = { status: 'idle', progress: null }, begins = 0, uiInstalls = 0, listener;
  const UI = load('components/layout/InAppUpdate.tsx', {
    react: React, 'react-native': { StyleSheet: { create: v => v }, View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity' },
    '@/i18n': { useI18n: () => ({ t: key => key }) }, '@/platform/inAppUpdate': { supportsInAppUpdate: () => true },
    '@/store/appUpdateJob': { getAppUpdateJob: () => uiState, subscribeAppUpdateJob: fn => { listener = fn; return () => {}; },
      appUpdateBusy: () => uiState.status === 'downloading', beginAppUpdate: () => { begins++; }, installAppUpdate: () => { uiInstalls++; } },
  }).default;
  let tree; await React.act(async () => { tree = Renderer.create(React.createElement(UI, { release })); });
  const button = () => tree.root.findByType('TouchableOpacity');
  await React.act(async () => button().props.onPress()); assert.equal(begins, 0);
  assert.ok(tree.root.findAllByType('Text').some(node => node.props.children === 'inAppUpdateConfirm'));
  await React.act(async () => button().props.onPress()); assert.equal(begins, 1);
  await React.act(async () => { uiState = { status: 'downloading', version: '2.0.0', progress: .5 }; listener(); });
  assert.equal(button().props.disabled, true);
  await React.act(async () => { uiState = { status: 'ready', version: '2.0.0', progress: 1 }; listener(); });
  await React.act(async () => button().props.onPress()); assert.equal(uiInstalls, 1);
  await React.act(async () => tree.unmount());

  const { buildManifest } = require('./build-update-manifest.cjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'momo-update-test-'));
  try {
    fs.writeFileSync(path.join(directory, 'MomoStory_2.0.0_x64-setup.exe'), 'fixture');
    fs.writeFileSync(path.join(directory, 'MomoStory_2.0.0_x64-setup.exe.sig'), 'c2lnbmF0dXJl');
    const manifest = buildManifest(directory, 'v2.0.0');
    assert.equal(manifest.platforms['windows-x86_64'].signature, 'c2lnbmF0dXJl');
    assert.match(manifest.platforms['windows-x86_64'].url, /v2\.0\.0\/MomoStory_2\.0\.0_x64-setup\.exe$/);
    assert.throws(() => buildManifest(directory, 'v2.0.0-beta')); assert.throws(() => buildManifest(directory, 'v9.0.0'));
  } finally {
    for (const name of ['MomoStory_2.0.0_x64-setup.exe', 'MomoStory_2.0.0_x64-setup.exe.sig']) fs.unlinkSync(path.join(directory, name));
    fs.rmdirSync(directory);
  }
  console.log('PASS in-app updates: trusted APK metadata, native progress/permissions, signed desktop download, separate installation, job deduplication/retries, confirmation UI and release manifest');
})().catch(error => { console.error(error); process.exitCode = 1; });
