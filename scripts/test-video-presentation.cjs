const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    if (id.includes('/assets/')) return id;
    if (id.startsWith('@/')) return load(`${id.slice(2)}.ts`);
    if (id.startsWith('.')) return load(path.relative(root, path.resolve(root, path.dirname(file), `${id}.ts`)));
    return require(id);
  }, module, module.exports);
  return module.exports;
}
const { eventEase, spriteMotionAt, expressionLayoutAt, expressionOpacityAt, shownEventDialogue, parseEventSpeaker } = load('utils/eventPresentation.ts');
const { buildVideoTimeline, videoDimensions } = load('services/videoExport/timeline.ts');
const { paintVideo } = load('services/videoExport/paint.ts');
const { sfxMap, expressionMap } = load('constants/eventAssets.ts');
for (const [folder, map] of [['assets/sound', sfxMap], ['assets/images/expression', expressionMap]]) {
  assert.deepEqual(Object.values(map).map(source => path.basename(source)).sort(), fs.readdirSync(path.join(root, folder)).sort());
  for (const source of Object.values(map)) {
    if (!source.endsWith('.png') && !source.endsWith('.webp')) continue;
    const bytes = fs.readFileSync(path.resolve(root, 'constants', source));
    if (source.endsWith('.png')) assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    else { assert.equal(bytes.subarray(0, 4).toString(), 'RIFF'); assert.equal(bytes.subarray(8, 12).toString(), 'WEBP'); }
  }
}
assert.ok(expressionMap['Headpat.png'].endsWith('Headpat.webp'));
assert.ok(expressionMap['Question2.png'].endsWith('Question2.webp'));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
for (let i = 0; i <= 100; i++) { const t = i / 100; near(eventEase(t), 1 - eventEase(1 - t)); }
for (const [time, offset] of [[0, 0], [0.04, 7.5], [0.08, 15], [0.12, 0], [0.16, -15], [0.24, 15], [0.48, -15], [0.52, -7.5], [0.56, 0], [1, 0]]) {
  near(spriteMotionAt('shakeX', time).x, offset);
  near(spriteMotionAt('shakeY', time).y, offset);
  near(spriteMotionAt('shakeX', time).y, 0);
}
for (const [time, offset] of [[0, 0], [0.04, 7.5], [0.08, 15], [0.12, 7.5], [0.16, 0], [1, 0]]) near(spriteMotionAt('slideX', time).x, offset);
for (const [time, opacity] of [[0, 0], [0.15, 0.5], [0.3, 1], [1.9, 1], [2, 1], [2.25, 0.5], [2.5, 0], [3, 0]]) near(expressionOpacityAt(time), opacity);
assert.deepEqual(parseEventSpeaker('호시노(아비도스)'), { name: '호시노', affiliation: '아비도스' });
assert.deepEqual(parseEventSpeaker('선생'), { name: '선생', affiliation: '' });
for (const [W, H] of [[360, 640], [390, 844], [320, 1000], [720, 1280], [1080, 1920]]) {
  for (const aspect of [373 / 668, 572 / 1024]) {
    const height = H * 0.98, width = height * aspect;
    const layout = expressionLayoutAt(W, H, width, height);
    const left = (W - width) / 2 + layout.left;
    assert.ok(left - 15 >= 0, 'portrait icon stays visible while shaking left');
    assert.ok(left + layout.size + 15 <= W, 'portrait icon stays visible while shaking right');
    near((layout.top + layout.size / 2) / height, 0.13);
    assert.ok(layout.size > 80 * W / 1280, 'portrait icon must remain legible beside the head');
  }
}
const landscapeLayout = expressionLayoutAt(1280, 720, 400, 705.6);
assert.deepEqual(landscapeLayout, { left: 294.4, top: 28.8, size: 80 });

const story = { id: 'effects', title: 'effects', character: '호시노', createdAt: 0, script:
  '호시노(아비도스) : 안녕 [emotion : hoshino_smallsmile.png, bg : BG_AbydosCouncilRoom.jpg, expression : sweat.png, animation : shakeX, sound : SE_Confirm_01.mp3]\n'
  + 'sound : SE_Crow_04.wav\nanimation : slideY\nselection : (1)"가자" (2)"쉬자"\ndeleteEmotion\n'
  + '호시노 : 돌아왔어 [emotion : hoshino_smallsmile.png]\ndeleteAll\nnarration : 마지막\nendEvent' };
const timeline = buildVideoTimeline(story, 0.3, 0.4);
const initial = timeline.scenes[0];
const command = timeline.scenes[1];
assert.equal(command.line.soundFile, 'SE_Crow_04.wav');
assert.equal(command.expression.key, 'sweat.png');
assert.equal(command.expression.start, 0);
assert.deepEqual(timeline.audio.map(cue => cue.key), ['SE_Confirm_01.mp3', 'SE_Crow_04.wav', 'Chat_Pop.wav']);
assert.ok(timeline.audio.every(cue => cue.volume === 0.4));
assert.ok(timeline.audio.slice(0, 2).every(cue => cue.end === timeline.duration));
assert.ok(Math.abs(timeline.audio[2].end - timeline.audio[2].start - 0.18) < 1e-9);
for (const scene of timeline.scenes) {
  if (scene.line.type === 'command' || scene.line.type === 'animation') assert.equal(shownEventDialogue(scene.line, initial.line), null);
}
function canvas() {
  const stack = [], draws = [], texts = [];
  return {
    globalAlpha: 1, draws, texts,
    save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, font: this.font, textAlign: this.textAlign }); },
    restore() { Object.assign(this, stack.pop()); },
    beginPath() {}, roundRect() {}, fill() {}, fillRect() {}, strokeRect() {}, rect() {}, clip() {},
    measureText: text => ({ width: text.length * 12 }),
    drawImage(image, x, y, width, height) { draws.push({ image, x, y, width, height, alpha: this.globalAlpha }); },
    fillText(text, x, y) { texts.push({ text, x, y, color: this.fillStyle }); },
    createLinearGradient: () => ({ addColorStop() {} }),
  };
}
const sprite = { naturalWidth: 100, naturalHeight: 100 };
const effect = { naturalWidth: 100, naturalHeight: 50 };
const background = { naturalWidth: 1280, naturalHeight: 720 };
const images = new Map([['emotion:hoshino_smallsmile', sprite], ['expression:sweat.png', effect], ['bg:BG_AbydosCouncilRoom', background]]);
for (const ratio of ['16:9', '9:16']) {
  const { width: W, height: H } = videoDimensions(ratio);
  const payload = { name: '호시노', chatSize: 1, timeline, spriteAspects: { hoshino_smallsmile: 373 / 668 }, labels: {} };
  const render = (scene, time) => { const ctx = canvas(); paintVideo(ctx, payload, scene, time, images, W, H); assert.equal(ctx.globalAlpha, 1); return ctx; };
  const base = render(initial, 0);
  assert.equal(base.draws.some(draw => draw.image === effect), false);
  const frame = render(initial, 0.15);
  near(frame.draws.find(draw => draw.image === effect).alpha, 0.5);
  near(frame.draws.find(draw => draw.image === sprite).width, H * 0.98 * (373 / 668));
  const spriteDraw = frame.draws.find(draw => draw.image === sprite);
  const effectDraw = frame.draws.find(draw => draw.image === effect);
  const layout = expressionLayoutAt(W, H, spriteDraw.width, spriteDraw.height);
  near(effectDraw.x, spriteDraw.x + layout.left);
  near(effectDraw.y, spriteDraw.y + layout.top + layout.size / 4);
  near(effectDraw.width, layout.size);
  assert.ok(frame.texts.some(item => item.text === '아비도스' && item.color === '#6fc5ee'));
  assert.ok(frame.texts.some(item => item.text === '▾'));
  assert.ok(!frame.texts.some(item => item.text === 'AUTO'));
  const moved = render(initial, 0.08);
  near(moved.draws.find(draw => draw.image === sprite).x - base.draws.find(draw => draw.image === sprite).x, 15);
  const carried = render(command, 2.25 - command.start);
  near(carried.draws.find(draw => draw.image === effect).alpha, 0.5);
  assert.equal(carried.texts.some(item => ['안녕', '▾'].includes(item.text)), false);
  const motionScene = timeline.scenes.find(scene => scene.line.type === 'animation');
  assert.equal(render(motionScene, 0.08).texts.some(item => item.text === '안녕'), false);
  const selection = timeline.scenes.find(scene => scene.line.type === 'selection');
  assert.ok(render(selection, 0).texts.some(item => item.text === '안녕'));
  const removeSprite = timeline.scenes.find(scene => scene.line.commandType === 'deleteEmotion');
  near(render(removeSprite, 0.15).draws.find(draw => draw.image === sprite).alpha, 0.5);
  near(render(removeSprite, 0.15).draws.find(draw => draw.image === background).alpha, 1);
  const removeAll = timeline.scenes.find(scene => scene.line.commandType === 'deleteAll');
  for (const draw of render(removeAll, 0.15).draws) near(draw.alpha, 0.5);
  const ending = timeline.scenes.at(-1);
  assert.equal(render(ending, 1).draws.length, 0);
}
console.log('PASS both ratios: all registered effects, WAV cues, shared easing, 3-cycle shake, slide/reset, expression fade across scenes, sprite aspect/anchor, affiliation, caret, command visibility, selection dialogue, delete fades, ending');
