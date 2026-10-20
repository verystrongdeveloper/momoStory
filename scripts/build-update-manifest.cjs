const fs = require('node:fs');
const path = require('node:path');

function buildManifest(directory, tag, notes = '') {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error('A stable vX.Y.Z tag is required');
  const version = tag.slice(1);
  const name = `MomoStory_${version}_x64-setup.exe`;
  if (!fs.statSync(path.join(directory, name)).isFile()) throw new Error('Installer missing');
  const signature = fs.readFileSync(path.join(directory, `${name}.sig`), 'utf8').trim();
  if (!signature || !/^[A-Za-z0-9+/=]+$/.test(signature)) throw new Error('Invalid update signature');
  return { version, notes, pub_date: new Date().toISOString(), platforms: { 'windows-x86_64': {
    signature, url: `https://github.com/verystrongdeveloper/momoStory/releases/download/${tag}/${name}`,
  } } };
}
if (require.main === module) {
  const [directory, tag, notesFile] = process.argv.slice(2);
  const manifest = buildManifest(directory, tag, notesFile ? fs.readFileSync(notesFile, 'utf8') : '');
  fs.writeFileSync(path.join(directory, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n');
}
module.exports = { buildManifest };
