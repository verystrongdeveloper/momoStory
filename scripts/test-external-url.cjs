const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    assert.ok(Object.hasOwn(mocks, id), `Unexpected import ${id}`);
    return mocks[id];
  }, mod, mod.exports);
  return mod.exports;
}

(async () => {
  const url = 'https://github.com/verystrongdeveloper/momoStory/releases/tag/v2.0.0';
  const opened = [];
  const mocks = {
    'react-native': { Linking: { openURL: async value => { opened.push(['linking', value]); } } },
    '@tauri-apps/plugin-opener': { openUrl: async value => { opened.push(['desktop', value]); } },
  };
  const native = load('platform/openExternalUrl.ts', mocks);
  const web = load('platform/openExternalUrl.web.ts', mocks);
  await native.openExternalUrl(url);
  global.window = {};
  await web.openExternalUrl(url);
  global.window = { __TAURI_INTERNALS__: {} };
  await web.openExternalUrl(url);
  assert.deepEqual(opened, [['linking', url], ['linking', url], ['desktop', url]],
    'desktop uses the OS opener; browser and native retain their existing URL handling');
  mocks['@tauri-apps/plugin-opener'].openUrl = async () => { throw new Error('open failed'); };
  await assert.rejects(() => web.openExternalUrl(url), /open failed/);
  assert.equal(opened.length, 3, 'desktop errors reach the update UI without falling back into the WebView');
  delete global.window;
  console.log('PASS external links: desktop OS opener, browser/native routing and error propagation');
})().catch(error => { console.error(error); process.exitCode = 1; });
