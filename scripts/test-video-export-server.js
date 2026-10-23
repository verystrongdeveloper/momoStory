const fs = require('fs');
const http = require('http');
const path = require('path');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'tmp', 'video-export-tests');
fs.mkdirSync(outputDir, { recursive: true });
const code = buildSync({ entryPoints: [path.join(__dirname, 'video-export-smoke.ts')], bundle: true, platform: 'browser', format: 'iife', write: false }).outputFiles[0].contents;
const assets = {
  '/font.ttf': ['assets/fonts/Pretendard-SemiBold.ttf', 'font/ttf'],
  '/chat-pop.wav': ['assets/audio/chat-pop.wav', 'audio/wav'],
  '/bg.jpg': ['assets/images/background/BG_AbydosCouncilRoom.jpg', 'image/jpeg'],
  '/sprite.webp': ['assets/images/hoshino/hoshino_relaxed_smile.webp', 'image/webp'],
  '/avatar.jpg': ['assets/images/hoshino.jpg', 'image/jpeg'],
  '/music.mp3': ['assets/music/Aira.mp3', 'audio/mpeg'],
  '/effect.png': ['assets/images/expression/sweat.png', 'image/png'],
  '/sfx.mp3': ['assets/sound/SE_Confirm_01.mp3', 'audio/mpeg'],
  '/sfx.wav': ['assets/sound/SE_Crow_04.wav', 'audio/wav'],
};
function nativeFixture() {
  const data = (key) => `data:${assets[key][1]};base64,${fs.readFileSync(path.join(root, assets[key][0])).toString('base64')}`;
  const payload = {
    title: 'native bridge', name: '호시노', ratio: '9:16', quality: '1080p', chatSize: 1,
    font: data('/font.ttf'),
    images: { avatar: data('/avatar.jpg'), 'bg:BG_AbydosCouncilRoom': data('/bg.jpg'), 'emotion:hoshino_smallsmile': data('/sprite.webp') },
    sounds: { 'music:Aira.mp3': data('/music.mp3') }, labels: { bondEvent: '인연 이벤트', bondStory: '호시노의 인연 스토리로' },
    timeline: {
      duration: 5, messages: [{ sender: 'character', text: '모바일 전송 테스트', showImage: true }],
      scenes: [{ kind: 'chat', start: 0, duration: 1.5, chatCount: 1 }, { kind: 'story', start: 1.5, duration: 3.5, background: 'BG_AbydosCouncilRoom', emotion: 'hoshino_smallsmile', line: { type: 'dialogue', text: 'MP4 다운로드를 시작합니다.', character: '호시노' } }],
      audio: [{ key: 'Aira.mp3', start: 1.5, end: 5, loop: true, volume: 0.3 }],
    },
  };
  const script = fs.readFileSync(path.join(root, 'assets/video-renderer.js.txt'), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src blob:; connect-src 'self' data: blob:; img-src data:; font-src data:; style-src 'unsafe-inline'"></head><body><h1>Native bridge fixture</h1><pre id="status">Starting</pre><script>
let parts=[], size=0;const status=document.getElementById('status');
window.ReactNativeWebView={postMessage:async(raw)=>{const m=JSON.parse(raw);try{
if(m.type==='ready')setTimeout(()=>window.startVideoExport(${JSON.stringify(payload)}),0);
if(m.type==='progress')status.textContent='Encoding '+Math.floor(m.progress*100)+'%';
if(m.type==='begin')size=m.size;
if(m.type==='chunk'){parts.push(Uint8Array.from(atob(m.data),c=>c.charCodeAt(0)));setTimeout(()=>window.acknowledgeVideoChunk(),0);}
if(m.type==='error')status.textContent='FAIL '+m.message;
if(m.type==='complete'){const file=new Blob(parts,{type:'video/mp4'});if(file.size!==size)throw Error('Chunk mismatch');await fetch('/result/native-bridge.mp4',{method:'POST',body:file});status.textContent='PASS native bundle, data assets, secure context, CSP, chunk acknowledgements: '+size+' bytes';}
}catch(e){status.textContent='FAIL '+e.message;}}};</script><script>${script}</script></body></html>`;
}
http.createServer((request, response) => {
  if (request.url === '/native') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); return response.end(nativeFixture()); }
  if (request.url === '/' && request.method === 'GET') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    return response.end('<!doctype html><html><head><meta charset="utf-8"><title>Video export smoke test</title></head><body><h1>Video export smoke test</h1><button>Run video tests</button><pre>Ready</pre><script src="/test.js"></script></body></html>');
  }
  if (request.url === '/test.js') { response.setHeader('Content-Type', 'text/javascript'); return response.end(code); }
  if (request.method === 'POST' && /^\/result\/(?:(?:landscape|portrait)-(?:720p|1080p)\.mp4|native-bridge\.mp4|(?:16x9|9x16)-(?:720p|1080p)-(?:chat|dialogue|selection|title|expression|motion)\.png)$/.test(request.url)) {
    const chunks = []; let length = 0;
    request.on('data', (chunk) => { length += chunk.length; if (length > 512 * 1024 * 1024) { request.destroy(); return; } chunks.push(chunk); });
    request.on('end', () => { fs.writeFileSync(path.join(outputDir, path.basename(request.url)), Buffer.concat(chunks)); response.end('OK'); });
    return;
  }
  const asset = assets[request.url];
  if (asset) { response.setHeader('Content-Type', asset[1]); return fs.createReadStream(path.join(root, asset[0])).pipe(response); }
  response.statusCode = 404; response.end();
}).listen(Number(process.env.VIDEO_TEST_PORT || 9917), '127.0.0.1', () => console.log(`Video export test server: http://127.0.0.1:${process.env.VIDEO_TEST_PORT || 9917}`));
