const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', ...Object.keys(globals), source)(id => mocks[id], mod, mod.exports, ...Object.values(globals));
  return mod.exports;
}
const limits = load('services/videoExport/limits.ts');
const timeline = load('services/videoExport/timeline.ts', { './limits': limits });
let outcomes, configs, canceled, created, finalized, fonts, frames, supported;
function reset(failures = []) { outcomes = failures; configs = []; canceled = 0; created = []; finalized = 0; fonts = new Set(); frames = []; supported = true; }
class Target { on(_event, listener) { this.write = listener; } }
class Output {
  constructor({ target }) { this.target = target; }
  addVideoTrack() {} addAudioTrack() {} async start() {}
  async finalize() {
    finalized++;
    const result = outcomes.shift();
    if (result === 'size') this.target.write({ end: limits.MAX_VIDEO_BYTES + 1 });
    if (result === 'other') throw Error('OTHER_ERROR');
    this.target.buffer = new ArrayBuffer(10);
  }
  async cancel() { canceled++; }
}
class CanvasSource {
  constructor(_canvas, config) { configs.push(config); this.frames = []; frames.push(this.frames); }
  async add(time) { this.frames.push(time); } close() {}
}
const context = { save() {}, scale() {}, restore() {} };
const encode = load('services/videoExport/encode.ts', {
  mediabunny: { BufferTarget: Target, Output, CanvasSource, Mp4OutputFormat: class {}, canEncodeVideo: async () => supported },
  '@mediabunny/aac-encoder': {}, './timeline': timeline, './limits': limits,
  './types': { checkAborted: signal => { if (signal.aborted) throw Error('EXPORT_CANCELED'); } }, './paint': { paintVideo() {} },
}, {
  document: { createElement: () => { const canvas = { width: 0, height: 0, getContext: () => context }; created.push(canvas); return canvas; }, fonts: { add: font => fonts.add(font), delete: font => fonts.delete(font) } },
  FontFace: class { async load() {} }, setTimeout: callback => callback(),
}).encodeVideo;
const payload = { ratio: '16:9', quality: '1080p', font: 'font', images: {}, sounds: {}, timeline: { duration: 1, audio: [], scenes: [{ start: 0 }] } };
const run = (options = {}) => encode(payload, { signal: new AbortController().signal, onProgress() {}, ...options });
(async () => {
  reset(['size']);
  assert.equal((await run()).byteLength, 10);
  assert.deepEqual(configs.map(c => c.bitrate), [5_000_000, 3_250_000]);
  assert.equal(canceled, 1);
  assert.ok(frames.every(list => list.length === 24 && list[0] === 0 && list.at(-1) === 23 / 24), 'each retry encodes the complete story');
  assert.ok(created.every(c => c.width === 0 && c.height === 0)); assert.equal(fonts.size, 0);
  reset(['size', 'size']); await run(); assert.deepEqual(configs.map(c => c.bitrate), [5_000_000, 3_250_000, 2_000_000]);
  reset(['size', 'size', 'size']); await assert.rejects(run(), /VIDEO_TOO_LARGE/); assert.equal(configs.length, 3); assert.equal(canceled, 3);
  reset(['other']); await assert.rejects(run(), /OTHER_ERROR/); assert.equal(configs.length, 1);
  reset(); supported = false; await assert.rejects(run(), /VIDEO_QUALITY_UNSUPPORTED/); assert.equal(configs.length, 0);
  reset(['size']); const abort = new AbortController();
  await assert.rejects(run({ signal: abort.signal, onProgress: () => { if (canceled) abort.abort(); } }), /EXPORT_CANCELED/);
  assert.equal(configs.length, 1, 'cancel between retries stops further encoding');
  reset(); await assert.rejects(encode({ ...payload, timeline: { ...payload.timeline, duration: 601 } }, { signal: new AbortController().signal }), /VIDEO_TOO_LONG/);
  assert.equal(created.length, 0, 'overlong videos fail before loading assets or encoding');
  console.log('PASS size-only bounded bitrate retries, full-story re-encoding, resource cleanup, cancellation, unsupported encoder and duration preflight (mocked codec)');
})().catch(error => { console.error(error); process.exitCode = 1; });
