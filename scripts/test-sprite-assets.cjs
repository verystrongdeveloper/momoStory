const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const manifest = require('./fixtures/sprite-webp.json');
function load(file) {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(id => id, mod, mod.exports);
  return mod.exports;
}
(async () => {
  const { emotionMap } = load('constants/eventAssets.ts');
  const characters = load('constants/characters.ts').CHARACTERS;
  assert.equal(manifest.length, Object.keys(emotionMap).length);
  const files = new Set(manifest.map(entry => entry.file));
  assert.deepEqual(new Set(Object.values(emotionMap).map(file => file.replace('../', ''))), files);
  assert.ok(Object.values(emotionMap).every(file => file.endsWith('.webp')), 'all bundled character sprites must be WebP');
  for (const [folder, count] of [['koyuki', 14], ['yuuka', 10], ['kikyou', 17]]) {
    const entries = manifest.filter(entry => entry.file.startsWith('assets/images/' + folder + '/'));
    assert.equal(entries.length, count);
  }
  for (const character of characters) {
    for (const source of [character.image, character.avatar?.image].filter(Boolean)) {
      assert.ok(fs.existsSync(path.resolve(root, 'constants', source)), `Broken profile image: ${source}`);
    }
  }
  for (const entry of manifest) {
    const file = path.join(root, entry.file);
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.subarray(12, 32).includes(Buffer.from('VP8L')), 'lossless VP8L bitstream required');
    assert.equal(bytes.length, entry.bytes);
    assert.ok(bytes.length < entry.originalBytes);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height, info.channels], [...entry.size, 4]);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), entry.rgbaSha256, `Pixel mismatch: ${entry.file}`);
    assert.equal(fs.existsSync(path.join(root, entry.original)), false, 'originals must not remain in the bundle');
  }
  // Existing saved/public scripts keep their canonical filenames and map to WebP.
  const { resources } = require('../shared/prompts/resources');
  const parse = load('utils/parseEventScript.ts').default;
  const validate = load('shared/community/validation.ts').validatePublicStory;
  const assets = require('../shared/community/assets.json');
  for (const character of characters) {
    for (const legacyName of [...resources[character.name].emotions, ...(resources[character.name].legacyEmotions || [])]) {
      assert.match(legacyName, /\.(png|jpg)$/);
      const script = `title : Legacy\n${character.name} : Hi [emotion : ${legacyName}]\nendEvent`;
      const key = parse(script).find(line => line.emotion).emotion;
      assert.ok(emotionMap[key] && fs.existsSync(path.resolve(root, 'constants', emotionMap[key])), `Sprite does not resolve: ${legacyName}`);
      validate({ title: 'Legacy', character: character.name, script, chatMessages: [], clientId: 'legacy' }, assets);
    }
  }
  // Renaming a sprite must preserve the exact image used by saved stories.
  const { keepAssetSpeakers } = require('../shared/prompts/characterList');
  const { buildEventPromptPro } = require('../shared/prompts/promptBuilderPro');
  for (const [name, folder] of [['히나', 'hina'], ['호시노', 'hoshino']]) {
    const resource = resources[name];
    const prompt = buildEventPromptPro(name, [], [{ name, emotions: resource.emotions }], '함께 쉰다.');
    for (const oldFile of resource.legacyEmotions) {
      const key = oldFile.replace(/\.(png|jpg)$/, '');
      // The historical feelGood script key used a lowercase feelgood physical file.
      const original = manifest.find(entry => entry.original.toLowerCase() === `assets/images/${folder}/${oldFile}`.toLowerCase());
      assert.ok(original, `Missing original sprite provenance: ${oldFile}`);
      assert.equal(emotionMap[key], `../${original.file}`, `Legacy name changed image: ${oldFile}`);
      assert.ok(!Object.keys(emotionMap).includes(key), 'Legacy aliases must not appear in editor/prompt lists');
      assert.ok(!prompt.includes(oldFile), 'New generation must use descriptive canonical names');
      const script = `title : Legacy\n${name} : 선생. [emotion : ${oldFile}]\nselection : (1)"응" [speaker : ${name}, dialogue : 쉬어., emotion : ${oldFile}]\nendEvent`;
      assert.equal(keepAssetSpeakers(script, [name]), script, 'Saved legacy emotions survive filtering');
    }
    for (const file of resource.emotions) {
      assert.ok(resource.emotionDescriptions[file], `Missing ${name} expression description: ${file}`);
      assert.ok(prompt.includes(resource.emotionDescriptions[file]));
    }
  }
  const original = manifest.reduce((sum, entry) => sum + entry.originalBytes, 0);
  const converted = manifest.reduce((sum, entry) => sum + entry.bytes, 0);
  console.log(`PASS ${manifest.length} lossless WebP sprites: exact RGBA hashes, dimensions, profile references and legacy script/public validation; ${original} -> ${converted} bytes (${((1 - converted / original) * 100).toFixed(1)}% saved)`);
})().catch(error => { console.error(error); process.exitCode = 1; });
