const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Model Expo's release APK drawable behavior: fromModule returns a bare
// resource name already marked downloaded, so downloading it is a no-op.
const resources = new Map();
const copied = [];
class Asset {
  constructor({ name = '', type, uri }) {
    Object.assign(this, { name, type, uri, localUri: null, downloaded: false });
  }
  static fromModule(source) { return resources.get(source); }
  async downloadAsync() {
    if (this.downloaded) return this;
    copied.push(this.uri);
    if (this.uri === 'broken_resource') throw new Error('resource unavailable');
    this.localUri = this.uri.startsWith('file:') ? this.uri : `file:///cache/${this.name}.${this.type}`;
    this.downloaded = true;
    return this;
  }
}
class File {
  constructor(uri) { assert.ok(uri.startsWith('file:'), `Not a readable file: ${uri}`); this.uri = uri; }
  async base64() { return 'YXNzZXQ='; }
  async text() { return 'renderer script'; }
}
const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../platform/videoAsset.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('require', 'module', 'exports', code)((id) => {
  if (id === 'expo-asset') return { Asset };
  if (id === 'expo-file-system') return { File };
  throw new Error(`Unexpected import ${id}`);
}, mod, mod.exports);

(async () => {
  const { videoAssetUrl, readableVideoAsset } = mod.exports;
  const image = new Asset({ name: 'sprite', type: 'webp', uri: 'assets_sprite' });
  image.localUri = image.uri; image.downloaded = true;
  resources.set(1, image);
  assert.equal(await videoAssetUrl(1, 'image/png'), 'data:image/webp;base64,YXNzZXQ=');
  assert.deepEqual(copied, ['assets_sprite']);
  assert.equal(image.localUri, 'assets_sprite', 'must not mutate the shared Image asset');
  assert.equal(image.downloaded, true);

  // Normal cached files, development server assets, and non-image renderer assets.
  const cached = new Asset({ name: 'sound', type: 'mp3', uri: 'https://example.test/sound.mp3' });
  cached.localUri = 'file:///cache/sound.mp3'; cached.downloaded = true;
  resources.set(2, cached);
  assert.equal(await videoAssetUrl(2, 'audio/mpeg'), 'data:audio/mpeg;base64,YXNzZXQ=');
  assert.equal(copied.length, 1);
  const dev = new Asset({ name: 'bg', type: 'jpg', uri: 'http://localhost:8081/bg.jpg' });
  resources.set(3, dev);
  assert.equal(await videoAssetUrl(3, 'image/png'), 'data:image/jpeg;base64,YXNzZXQ=');
  const renderer = new Asset({ name: 'renderer', type: 'txt', uri: 'file:///cache/renderer.txt' });
  assert.equal(await (await readableVideoAsset(renderer)).text(), 'renderer script');
  await assert.rejects(readableVideoAsset(new Asset({ type: 'png', uri: 'broken_resource' })), /resource unavailable/);
  console.log('PASS APK drawable-to-cache copy, shared asset preservation, MIME, cached/dev assets, renderer and read failures');
})().catch(error => { console.error(error); process.exitCode = 1; });
