const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(require.resolve('../services/appUpdate.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(mod, mod.exports);
const { isNewerRelease, checkAppUpdate } = mod.exports;
(async () => {
  for (const [current, latest, expected] of [
    ['1.0.3', 'v1.0.3', false], ['1.0.3', 'v1.0.4', true],
    ['1.9.0', '1.10.0', true], ['2.0.0', '1.99.0', false],
    ['1.0.3-beta.1', 'v1.0.3', true], ['1.0.3+build4', '1.0.3', false],
  ]) assert.equal(isNewerRelease(current, latest), expected);
  assert.throws(() => isNewerRelease('oops', '1.0.3'));
  assert.throws(() => isNewerRelease('1.0.3', '1.0.4-beta'));
  const original = global.fetch;
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.github.com/repos/verystrongdeveloper/momoAI/releases/latest');
      assert.equal(options.cache, 'no-store');
      assert.ok(options.signal);
      return { ok: true, json: async () => ({ tag_name: 'v1.0.4', draft: false, prerelease: false, html_url: 'https://evil.test' }) };
    };
    assert.deepEqual(await checkAppUpdate('1.0.3'), { available: true, version: '1.0.4', url: 'https://github.com/verystrongdeveloper/momoAI/releases/tag/v1.0.4' });
    for (const response of [
      { ok: false, status: 403 }, { ok: false, status: 404 },
      { ok: true, json: async () => ({ tag_name: 'v2.0.0', draft: true, prerelease: false }) },
      { ok: true, json: async () => ({ tag_name: 'v2.0.0', draft: false, prerelease: true }) },
      { ok: true, json: async () => ({}) },
    ]) {
      global.fetch = async () => response;
      await assert.rejects(checkAppUpdate('1.0.3'));
    }
    global.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
      if (signal.aborted) reject(new Error('aborted'));
      else signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    const controller = new AbortController();
    const pending = checkAppUpdate('1.0.3', controller.signal);
    controller.abort();
    await assert.rejects(pending, /aborted/);
    const timeout = global.setTimeout;
    try {
      global.setTimeout = (fn) => timeout(fn, 1);
      await assert.rejects(checkAppUpdate('1.0.3'), /aborted/);
    } finally { global.setTimeout = timeout; }
  } finally { global.fetch = original; }
  console.log('PASS numeric versions, stable releases, trusted download URL, API errors, cancellation and timeout');
})().catch(error => { console.error(error); process.exitCode = 1; });
