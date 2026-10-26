const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'constants/characters.ts');
const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('require', 'module', 'exports', code)(id => {
  if (!id.startsWith('../assets/')) throw new Error(`Unexpected import: ${id}`);
  return path.resolve(path.dirname(source), id);
}, mod, mod.exports);

// Reproduce CharacterAvatar's square frame, image fit, scale and translation.
async function render(character) {
  const crop = character.avatar ?? {};
  const image = crop.image ?? character.image;
  const size = 192;
  const { width, height } = await sharp(image).metadata();
  const fit = crop.fit === 'contain' ? Math.min(size / width, size / height) : Math.max(size / width, size / height);
  const factor = fit * (crop.scale ?? 1);
  const scaledWidth = Math.max(1, Math.round(width * factor));
  const scaledHeight = Math.max(1, Math.round(height * factor));
  const left = Math.round((size - scaledWidth) / 2 + (crop.offsetX ?? 0) * size);
  const top = Math.round((size - scaledHeight) / 2 + (crop.offsetY ?? 0) * size);
  const x = Math.max(0, left), y = Math.max(0, top);
  const visibleWidth = Math.min(size, left + scaledWidth) - x;
  const visibleHeight = Math.min(size, top + scaledHeight) - y;
  const face = await sharp(image).resize(scaledWidth, scaledHeight).extract({
    left: Math.max(0, -left), top: Math.max(0, -top), width: visibleWidth, height: visibleHeight,
  }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: crop.backgroundColor ?? '#ffffff' } })
    .composite([{ input: face, left: x, top: y }]).png().toBuffer();
}

(async () => {
  const directory = path.join(root, 'android/app/src/main/res/drawable-nodpi');
  const check = process.argv.includes('--check');
  if (!check) fs.mkdirSync(directory, { recursive: true });
  for (const character of mod.exports.CHARACTERS) {
    const key = character.name.split('').map(letter => letter.charCodeAt(0).toString(16)).join('_');
    const target = path.join(directory, `notification_avatar_${key}.png`);
    const output = await render(character);
    if (check) {
      if (!fs.existsSync(target) || !fs.readFileSync(target).equals(output)) {
        throw new Error(`Outdated notification avatar: ${character.name}. Run npm run notification:avatars`);
      }
    } else fs.writeFileSync(target, output);
  }
  console.log(`${check ? 'PASS' : 'Generated'} ${mod.exports.CHARACTERS.length} bundled notification profile photos`);
})().catch(error => { console.error(error); process.exitCode = 1; });
