const path = require('path');
const { buildSync } = require('esbuild');
require('./build-chat-pop');

// Mechanical build output, consumed as an Expo asset by the native WebView.
buildSync({
  entryPoints: [path.join(__dirname, '../services/videoExport/webViewEntry.ts')],
  outfile: path.join(__dirname, '../assets/video-renderer.js.txt'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
});
