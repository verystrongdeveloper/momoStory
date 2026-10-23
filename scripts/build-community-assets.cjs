const fs = require('node:fs');
const path = require('node:path');
const { resources } = require('../shared/prompts/resources');
const manifest = { ...resources.공통, emotions: Object.fromEntries(Object.entries(resources).filter(([, value]) => value.emotions).map(([name, value]) => [name, [...value.emotions, ...(value.legacyEmotions || [])]])) };
const target = path.join(__dirname, '../shared/community/assets.json');
const output = JSON.stringify(manifest, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error('Run node scripts/build-community-assets.cjs');
} else fs.writeFileSync(target, output);
