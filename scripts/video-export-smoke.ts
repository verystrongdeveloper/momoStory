// Browser integration fixture. It only renders synthetic stories and posts artifacts to localhost.
import { ALL_FORMATS, AudioBufferSink, BufferSource, Input } from 'mediabunny';
import { encodeVideo } from '../services/videoExport/encode';
import { buildVideoTimeline, videoDimensions, type VideoRatio } from '../services/videoExport/timeline';
import { paintVideo } from '../services/videoExport/paint';
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import type { VideoPayload } from '../services/videoExport/types';

const button = document.querySelector('button')!;
const status = document.querySelector('pre')!;
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    // Force the bundled fallback too, covering environments without native AAC encoding.
    registerAacEncoder();
    const story = {
      id: 'smoke', title: '영상 추출 테스트', character: '호시노', createdAt: 1,
      chatMessages: [
        { sender: 'character' as const, text: '선생, 오늘은 무슨 일이야?', showImage: true },
        { sender: 'user' as const, text: '영상으로 추억을 남기러 왔어!' },
      ],
      script: '타이틀 : 영상으로 남기는 하루\n호시노(아비도스) : 안녕, 선생! [emotion : hoshino_smallsmile.png, bg : BG_AbydosCouncilRoom.jpg, music : Aira.mp3, expression : sweat.png, animation : shakeX, sound : SE_Confirm_01.mp3]\nanimation : slideY\nsound : SE_Crow_04.wav\nselection : (1)"함께 산책하자" (2)"잠깐 쉬자"\ndeleteEmotion\n호시노 : 좋아, 함께 가자! [emotion : hoshino_smallsmile.png]\ndeleteAll\nnarration : 오늘의 추억을 간직했다.\nendEvent',
    };
    const results = [];
    for (const ratio of ['16:9', '9:16'] as const) {
      const payload: VideoPayload = {
        title: story.title, name: story.character, ratio, chatSize: 1,
        timeline: buildVideoTimeline(story, 0.3, 0.5),
        images: { 'bg:BG_AbydosCouncilRoom': '/bg.jpg', 'emotion:hoshino_smallsmile': '/sprite.png', 'expression:sweat.png': '/effect.png', avatar: '/avatar.jpg' },
        spriteAspects: { hoshino_smallsmile: 373 / 668 },
        sounds: { 'sfx:Chat_Pop.wav': '/chat-pop.wav', 'music:Aira.mp3': '/music.mp3', 'sfx:SE_Confirm_01.mp3': '/sfx.mp3', 'sfx:SE_Crow_04.wav': '/sfx.wav' }, font: '/font.ttf',
        labels: { bondEvent: '인연 이벤트', bondStory: '호시노의 인연 스토리로' },
      };
      status.textContent = `Encoding ${ratio}`;
      const output = await encodeVideo(payload, { signal: new AbortController().signal, onProgress: (p) => { status.textContent = `Encoding ${ratio}: ${Math.round(p.progress * 100)}%`; } });
      const input = new Input({ source: new BufferSource(output), formats: ALL_FORMATS });
      const video = await input.getPrimaryVideoTrack();
      const audio = await input.getPrimaryAudioTrack();
      const { width, height } = videoDimensions(ratio);
      if (!video || await video.getCodedWidth() !== width || await video.getCodedHeight() !== height || await video.getCodec() !== 'avc' || !audio || await audio.getCodec() !== 'aac') throw new Error('Invalid video/audio metadata');
      const sink = new AudioBufferSink(audio);
      const pop = await sink.getBuffer(0.07);
      const gap = await sink.getBuffer(0.5);
      const rms = (buffer: AudioBuffer) => {
        const data = buffer.getChannelData(0);
        return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
      };
      if (!pop || !gap || rms(pop.buffer) < 0.001 || rms(gap.buffer) > rms(pop.buffer) * 0.2) throw new Error('Chat pop missing or playing outside the bubble cue in MP4');
      const duration = await input.computeDuration();
      if (Math.abs(duration - payload.timeline.duration) > 0.1) throw new Error('Duration mismatch');
      await fetch(`/result/${ratio === '16:9' ? 'landscape' : 'portrait'}.mp4`, { method: 'POST', body: output });
      results.push({ ratio, width, height, duration, bytes: output.byteLength, video: 'avc', audio: 'aac' });
      const element = document.createElement('video'); element.controls = true; element.width = ratio === '16:9' ? 640 : 270;
      element.src = URL.createObjectURL(new Blob([output], { type: 'video/mp4' })); document.body.appendChild(element);
      // Still previews make layout QA independent of video playback controls.
      const images = new Map<string, HTMLImageElement>();
      for (const [key, url] of Object.entries(payload.images)) { const image = new Image(); image.src = url; await image.decode(); images.set(key, image); }
      const font = new FontFace('MomoExport', 'url(/font.ttf)'); await font.load(); document.fonts.add(font);
      for (const kind of ['chat', 'dialogue', 'selection', 'title', 'expression', 'motion']) {
        const scene = payload.timeline.scenes.find((s) => kind === 'chat' ? s.showStoryButton : s.line?.type === (kind === 'title' ? '타이틀' : kind === 'expression' ? 'dialogue' : kind === 'motion' ? 'animation' : kind))!;
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        paintVideo(canvas.getContext('2d')!, payload, scene, kind === 'title' ? 0.25 : kind === 'expression' ? 0.15 : kind === 'motion' ? 0.08 : scene.duration - 0.2, images, width, height);
        const png = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/png'));
        await fetch(`/result/${ratio.replace(':', 'x')}-${kind}.png`, { method: 'POST', body: png });
      }
      input.dispose();
    }
    // An already canceled job must not create a partial downloadable file.
    const abort = new AbortController(); abort.abort();
    let canceled = false;
    try { await encodeVideo({} as VideoPayload, { signal: abort.signal, onProgress() {} }); } catch (error) { canceled = (error as Error).message === 'EXPORT_CANCELED'; }
    if (!canceled) throw new Error('Cancellation failed');
    status.textContent = `PASS\n${JSON.stringify(results, null, 2)}\nCancellation PASS`;
  } catch (error) { status.textContent = `FAIL ${error instanceof Error ? error.stack : String(error)}`; button.disabled = false; }
});
