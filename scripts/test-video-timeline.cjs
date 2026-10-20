const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)((id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('.')) return load(path.relative(path.join(__dirname, '..'), path.resolve(__dirname, '..', path.dirname(file), `${id}.ts`)), mocks);
    return require(id);
  }, mod, mod.exports);
  return mod.exports;
}

const parser = load('utils/parseEventScript.ts');
const { buildVideoTimeline, videoDimensions } = load('services/videoExport/timeline.ts', { '@/utils/parseEventScript': parser });
const { videoFileName } = load('services/videoExport/types.ts');
const { decodeBase64 } = load('services/videoExport/base64.ts');
const { paintVideo, titleAnimationAt } = load('services/videoExport/paint.ts');
assert.deepEqual(titleAnimationAt(0), { expansion: 0, opacity: 0 });
assert.deepEqual(titleAnimationAt(0.25), { expansion: 0.5, opacity: 0.5 });
assert.deepEqual(titleAnimationAt(0.5), { expansion: 1, opacity: 1 });
assert.deepEqual(titleAnimationAt(2.9), { expansion: 1, opacity: 1 });
assert.ok(Math.abs(titleAnimationAt(3.15).opacity - 0.5) < 1e-10);
assert.deepEqual(titleAnimationAt(3.4), { expansion: 1, opacity: 0 });
for (const length of [0, 1, 2, 3, 8193, 196608]) {
  const bytes = Buffer.alloc(length);
  for (let index = 0; index < bytes.length; index++) bytes[index] = index % 256;
  assert.deepEqual(Buffer.from(decodeBase64(bytes.toString('base64'))), bytes);
}
assert.throws(() => decodeBase64('????'), /VIDEO_ENCODE_FAILED/);
const story = {
  id: 'test', title: '테스트', character: '호시노', createdAt: 0,
  chatMessages: [{ sender: 'character', text: '첫 대화', showImage: true }, { sender: 'user', text: '답장' }],
  script: '타이틀 : 테스트\n호시노 : 안녕! [bg : BG_AbydosCouncilRoom.jpg, emotion : hoshino_smallsmile.png, music : Aira.mp3]\nselection : (1)"첫 번째" (2)(두 번째)\nwaitSecond : 2\n호시노 : 계속해! [music : Aira.mp3]\n호시노 : 다른 음악! [music : Aoharu.mp3]\ndeleteEmotion\n호시노 : 다시 나타나! [emotion : hoshino_smile.png]\ndeleteAll\nnarration : 마지막 문장\nendEvent\n호시노 : 이 대사는 나오면 안 된다.',
};
const timeline = buildVideoTimeline(story, 0.4, 0.5);
for (const prefix of ['타이틀 :', 'title :', 'TITLE：']) {
  const localized = buildVideoTimeline({ ...story, script: `${prefix} A new day\nホシノ(対策委員会) : Hello [emotion : hoshino_smile.png]\nendEvent` }, 0.4, 0.5);
  const title = localized.scenes.find(scene => scene.line?.type === '타이틀');
  assert.equal(title.line.text, 'A new day');
  assert.equal(title.duration, timeline.scenes.find(scene => scene.line?.type === '타이틀').duration);
  assert.ok(localized.scenes.some(scene => scene.line?.character === 'ホシノ(対策委員会)'));
}
assert.deepEqual(timeline.scenes.slice(0, 4).map((scene) => [scene.kind, scene.chatCount, !!scene.typing]), [['chat', 0, true], ['chat', 1, false], ['chat', 2, false], ['chat', 2, false]]);
assert.deepEqual(timeline.scenes.slice(0, 4).map((scene) => !!scene.showStoryButton), [false, false, false, true]);
assert.equal(timeline.scenes[0].duration, 1.5);
const multiReply = buildVideoTimeline({ ...story, chatMessages: [story.chatMessages[1], story.chatMessages[0], { sender: 'character', text: '다음 문장' }] }, 0, 0);
assert.deepEqual(multiReply.scenes.filter(scene => scene.typing).map(scene => scene.chatCount), [1, 2], 'typing precedes both initial replies and subsequent character sentences, never user messages');
// Verify rendered text, not just timeline flags, in both export aspect ratios.
for (const ratio of ['16:9', '9:16']) {
  const { width, height } = videoDimensions(ratio);
  const text = [];
  const rectangles = [];
  const context = {
    globalAlpha: 1,
    save() {}, restore() {}, strokeRect() {}, fillRect(...args) { rectangles.push({ color: this.fillStyle, bounds: args }); }, beginPath() {}, roundRect() {}, fill() {}, rect() {}, clip() {}, drawImage() {},
    measureText: value => ({ width: value.length * 10 }),
    fillText: value => text.push(value),
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  const payload = { name: '호시노', chatSize: 1, timeline, labels: { bondEvent: '인연 이벤트', bondStory: '호시노의 인연 스토리로' } };
  for (const scene of timeline.scenes) {
    text.length = 0;
    paintVideo(context, payload, scene, 0, new Map(), width, height);
    assert.equal(text.includes('AUTO'), false);
    assert.equal(text.includes(payload.labels.bondStory), !!scene.showStoryButton);
    assert.equal(text.includes('| 인연 이벤트 |'), !!scene.showStoryButton);
    assert.equal(text.includes('···'), !!scene.typing, 'typing bubble appears only during typing scenes');
    if (scene.typing) assert.equal(text.includes(timeline.messages[scene.chatCount].text), false, 'pending reply stays hidden');
  }
  const titleScene = timeline.scenes.find(scene => scene.line?.type === '타이틀');
  const bannerHeights = [];
  for (const time of [0, 0.25, 0.5, 3.15, 3.4]) {
    text.length = 0; rectangles.length = 0; context.globalAlpha = 1;
    paintVideo(context, payload, titleScene, time, new Map(), width, height);
    const banner = rectangles.find(rectangle => rectangle.color === '#fff');
    bannerHeights.push(banner?.bounds[3] ?? 0);
    assert.equal(text.includes(titleScene.line.text), time > 0 && time < 3.3);
  }
  assert.equal(bannerHeights[0], 0);
  assert.equal(bannerHeights[1], bannerHeights[2] / 2);
  assert.equal(bannerHeights[3], bannerHeights[2]);
  assert.equal(bannerHeights[4], 0);
  const single = buildVideoTimeline({ ...story, chatMessages: [story.chatMessages[0]] }, 0, 0);
  assert.equal(!!single.scenes[0].showStoryButton, false);
  assert.equal(!!single.scenes[1].showStoryButton, false);
  assert.equal(single.scenes[2].showStoryButton, true);
}
assert.equal(timeline.scenes.find((scene) => scene.line?.commandType === 'waitSecond').duration, 2);
const selection = timeline.scenes.find((scene) => scene.line?.type === 'selection');
assert.deepEqual(selection.line.options, ['첫 번째', '두 번째']);
assert.ok(selection.duration >= 3.6);
const afterSelection = timeline.scenes[timeline.scenes.indexOf(selection) + 1];
assert.equal(afterSelection.start, selection.start + selection.duration);
assert.equal(timeline.scenes.at(-1).line.type, 'narration');
assert.equal(timeline.scenes.at(-1).emotion, undefined);
assert.equal(timeline.scenes.at(-1).background, undefined);
const pops = timeline.audio.filter(cue => cue.key === 'Chat_Pop.wav');
assert.equal(pops.length, story.chatMessages.length + 1);
assert.deepEqual(pops.slice(0, 2).map(cue => cue.start), timeline.scenes.filter(scene => scene.kind === 'chat' && !scene.typing && !scene.showStoryButton).map(scene => scene.start));
assert.equal(timeline.audio.some(cue => cue.start === timeline.scenes[0].start), false, 'typing is silent');
assert.equal(pops[2].start, selection.start + selection.duration - 0.6, 'selection sound matches automatic highlight');
assert.ok(pops.every(cue => cue.volume === 0.5 && Math.abs(cue.end - cue.start - 0.18) < 1e-9));
const music = timeline.audio.filter(cue => cue.loop);
assert.equal(music.length, 2);
assert.equal(music[0].key, 'Aira.mp3');
assert.equal(music[0].end, music[1].start);
assert.equal(music[1].end, timeline.scenes.at(-1).start);
for (let index = 0; index < timeline.scenes.length; index++) {
  const scene = timeline.scenes[index];
  assert.ok(Number.isFinite(scene.duration) && scene.duration > 0);
  if (index > 0) assert.equal(scene.start, timeline.scenes[index - 1].start + timeline.scenes[index - 1].duration);
}
assert.equal(timeline.duration, timeline.scenes.at(-1).start + timeline.scenes.at(-1).duration);
assert.equal(buildVideoTimeline({ ...story, chatMessages: undefined }, 0, 0).scenes[0].kind, 'story');
assert.throws(() => buildVideoTimeline({ ...story, script: '', chatMessages: [] }, 1, 1), /EMPTY_VIDEO/);
assert.deepEqual(videoDimensions('16:9'), { width: 1280, height: 720 });
assert.deepEqual(videoDimensions('9:16'), { width: 720, height: 1280 });
assert.deepEqual(videoDimensions('16:9', '1080p'), { width: 1920, height: 1080 });
assert.deepEqual(videoDimensions('9:16', '1080p'), { width: 1080, height: 1920 });
const storyOnly = buildVideoTimeline(story, 0.4, 0.5, 'bell', false);
assert.deepEqual(storyOnly.messages, []);
assert.ok(storyOnly.scenes.every(scene => scene.kind === 'story' && !scene.showStoryButton));
assert.equal(storyOnly.scenes[0].start, 0);
assert.equal(storyOnly.scenes[0].line.type, '타이틀');
const storyOnlyChoice = storyOnly.scenes.find(scene => scene.line?.type === 'selection');
const storyOnlyPops = storyOnly.audio.filter(cue => cue.key.startsWith('Chat_'));
assert.equal(storyOnlyPops.length, 1, 'story-only export still includes the choice confirmation sound');
assert.equal(storyOnlyPops[0].key, 'Chat_bell.wav');
assert.equal(storyOnlyPops[0].start, storyOnlyChoice.start + storyOnlyChoice.duration - 0.6);
assert.equal(buildVideoTimeline(story, 0.4, 0.5, 'none').audio.some(cue => cue.key.startsWith('Chat_')), false);
assert.ok(buildVideoTimeline(story, 0.4, 0, 'bell', false).audio.every(cue => cue.volume === 0 || cue.loop), 'SFX mute applies to exported choices');
assert.ok(storyOnly.audio.some(cue => cue.key === 'Aira.mp3'));
assert.ok(storyOnly.duration < timeline.duration);
assert.equal(story.chatMessages.length, 2, 'export preference must not modify saved chat');
assert.equal(videoFileName('가/나:다?', '9:16'), '가 나 다_9x16.mp4');
assert.equal(videoFileName('가/나:다?', '9:16', '1080p'), '가 나 다_9x16_1080p.mp4');
console.log('PASS timeline: chat-to-story continuity, automatic choices, command timing, music transitions, ending, missing history, dimensions, filenames');
