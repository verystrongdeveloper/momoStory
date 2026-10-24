// Direct generation and Express need the same validator as the app/Edge Function.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = path.join(__dirname, '../shared/community/validation.ts');
const target = path.join(__dirname, '../shared/community/generatedValidation.js');
const output = '// Generated from validation.ts by scripts/build-community-validation.cjs. Do not edit.\n'
  + ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error('Run node scripts/build-community-validation.cjs');
} else fs.writeFileSync(target, output);
