import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import { videoBitrate, videoDimensions } from './timeline';
import { checkAborted, type ExportOptions, type VideoPayload } from './types';
import { paintVideo, type VideoImages } from './paint';

const FPS = 24;
const SAMPLE_RATE = 48000;
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

export async function encodeVideo(payload: VideoPayload, options: ExportOptions): Promise<ArrayBuffer> {
  checkAborted(options.signal);
  const { width, height } = videoDimensions(payload.ratio, payload.quality);
  const bitrate = videoBitrate(payload.quality);
  if (!(await canEncodeVideo('avc', { width, height, bitrate, frameRate: FPS }))) throw new Error(payload.quality === '1080p' ? 'VIDEO_QUALITY_UNSUPPORTED' : 'VIDEO_UNSUPPORTED');
  // Keep layout breakpoints and composition identical at both output resolutions.
  // Draw directly into the full-resolution canvas, including text and original assets.
  const layout = videoDimensions(payload.ratio);
  if (payload.timeline.duration > 600) throw new Error('VIDEO_TOO_LONG');
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('VIDEO_UNSUPPORTED');
  const font = new FontFace('MomoExport', `url(${JSON.stringify(payload.font)})`);
  await font.load(); document.fonts.add(font);
  const images: VideoImages = new Map();
  const buffers = new Map<string, AudioBuffer>();
  let audioContext: AudioContext | undefined;
  let output: Output | undefined;
  const abort = () => { void output?.cancel().catch(() => undefined); };
  options.signal.addEventListener('abort', abort, { once: true });
  try {
    for (const [key, url] of Object.entries(payload.images)) {
      checkAborted(options.signal);
      const image = new Image();
      image.crossOrigin = 'anonymous'; image.src = url;
      await image.decode(); images.set(key, image);
    }
    const hasAudio = payload.timeline.audio.some((cue) => cue.volume > 0 && payload.sounds[`${cue.loop ? 'music' : 'sfx'}:${cue.key}`]);
    if (hasAudio) {
      if (!(await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: SAMPLE_RATE }))) registerAacEncoder();
      audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      for (const [key, url] of Object.entries(payload.sounds)) {
        checkAborted(options.signal);
        const response = await fetch(url, { signal: options.signal });
        if (!response.ok) throw new Error('VIDEO_ASSET_FAILED');
        buffers.set(key, await audioContext.decodeAudioData(await response.arrayBuffer()));
      }
    }
    const target = new BufferTarget();
    target.on('write', ({ end }) => { if (end > MAX_VIDEO_BYTES) throw new Error('VIDEO_TOO_LARGE'); });
    output = new Output({ target, format: new Mp4OutputFormat({ fastStart: 'in-memory' }) });
    const video = new CanvasSource(canvas, { codec: 'avc', bitrate, keyFrameInterval: 2 });
    output.addVideoTrack(video, { frameRate: FPS });
    const audio = hasAudio ? new AudioBufferSource({ codec: 'aac', bitrate: 128_000 }) : null;
    if (audio) output.addAudioTrack(audio);
    await output.start();
    const totalFrames = Math.ceil(payload.timeline.duration * FPS);
    let sceneIndex = 0;
    let audioTime = 0;
    for (let frame = 0; frame < totalFrames; frame++) {
      checkAborted(options.signal);
      const time = frame / FPS;
      while (sceneIndex + 1 < payload.timeline.scenes.length && time >= payload.timeline.scenes[sceneIndex + 1].start) sceneIndex++;
      const scene = payload.timeline.scenes[sceneIndex];
      context.save();
      context.scale(width / layout.width, height / layout.height);
      paintVideo(context, payload, scene, time - scene.start, images, layout.width, layout.height);
      context.restore();
      await video.add(time, Math.min(1 / FPS, payload.timeline.duration - time));
      if (audio && frame % FPS === 0) {
        const length = Math.min(SAMPLE_RATE, Math.round((payload.timeline.duration - audioTime) * SAMPLE_RATE));
        if (length > 0) {
          const chunk = new AudioBuffer({ numberOfChannels: 2, length, sampleRate: SAMPLE_RATE });
          for (const cue of payload.timeline.audio) {
            if (cue.start >= audioTime + length / SAMPLE_RATE || cue.end <= audioTime || cue.volume <= 0) continue;
            const sound = buffers.get(`${cue.loop ? 'music' : 'sfx'}:${cue.key}`);
            if (!sound) continue;
            for (let channel = 0; channel < 2; channel++) {
              const source = sound.getChannelData(Math.min(channel, sound.numberOfChannels - 1));
              const destination = chunk.getChannelData(channel);
              for (let sample = 0; sample < length; sample++) {
                const absolute = audioTime + sample / SAMPLE_RATE;
                if (absolute < cue.start || absolute >= cue.end) continue;
                let offset = Math.floor((absolute - cue.start) * sound.sampleRate);
                if (cue.loop) offset %= source.length;
                if (offset < source.length) destination[sample] += source[offset] * cue.volume;
              }
            }
          }
          for (let channel = 0; channel < 2; channel++) {
            const data = chunk.getChannelData(channel);
            for (let sample = 0; sample < length; sample++) data[sample] = Math.max(-1, Math.min(1, data[sample]));
          }
          await audio.add(chunk);
          audioTime += length / SAMPLE_RATE;
        }
      }
      if (frame % 6 === 0) {
        options.onProgress({ phase: 'encoding', progress: 0.1 + (frame / totalFrames) * 0.85 });
        // Yield even when hardware encoding is fast, so cancellation and progress can render.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    checkAborted(options.signal);
    video.close(); audio?.close();
    await output.finalize();
    checkAborted(options.signal);
    if (!target.buffer) throw new Error('VIDEO_ENCODE_FAILED');
    return target.buffer;
  } catch (error) {
    await output?.cancel().catch(() => undefined);
    throw error;
  } finally {
    options.signal.removeEventListener('abort', abort);
    document.fonts.delete(font);
    await audioContext?.close().catch(() => undefined);
    canvas.width = 0; canvas.height = 0;
  }
}
