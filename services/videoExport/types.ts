import type { VideoRatio, VideoTimeline } from './timeline';

export type VideoPayload = {
  title: string;
  name: string;
  ratio: VideoRatio;
  chatSize: number;
  timeline: VideoTimeline;
  images: Record<string, string>;
  spriteAspects?: Record<string, number>;
  sounds: Record<string, string>;
  font: string;
  labels: { bondEvent: string; bondStory: string };
};
export type ExportProgress = { progress: number; phase: 'preparing' | 'encoding' | 'saving' };
export type ExportOptions = { signal: AbortSignal; onProgress: (value: ExportProgress) => void; includeChat?: boolean };

export function checkAborted(signal: AbortSignal) {
  if (signal.aborted) throw new Error('EXPORT_CANCELED');
}

export function videoFileName(title: string, ratio: VideoRatio) {
  const name = title.replace(/[\\/:*?"<>|\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'MomoStory';
  return `${name}_${ratio.replace(':', 'x')}.mp4`;
}
