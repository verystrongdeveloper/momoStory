import { prepareVideo } from '@/services/videoExport/prepare';
import { videoFileName, type ExportProgress, type VideoPayload } from '@/services/videoExport/types';
import type { VideoQuality, VideoRatio } from '@/services/videoExport/timeline';
import type { AppLanguage } from '@/storage/types';
import type { SavedStory } from '@/store/storyLibrary';
import type { FileSaveTarget } from '@/platform/fileSave.types';
import { chooseVideoSaveTarget } from '@/platform/videoSave';

type Job = {
  id: number;
  title: string;
  status: 'picking' | 'queued' | 'working' | 'done' | 'error' | 'canceled';
  progress: ExportProgress;
  controller: AbortController;
  destination?: FileSaveTarget;
  payload: VideoPayload | null;
  error: string;
  prepare?: () => Promise<VideoPayload>;
};
let job: Job | null = null;
let queue: Job[] = [];
let lastFinishedId: number | undefined;
let sequence = 0;
const listeners = new Set<() => void>();
export const getVideoExportJob = () => job;
export const getVideoExportQueue = () => queue;
export const getVideoExportJobById = (id: number) => queue.find(item => item.id === id);
export const subscribeVideoExportJob = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const pending = (item: Job) => ['working', 'queued', 'picking'].includes(item.status);
export const videoExportBusy = () => queue.some(pending);
function emit() {
  job = queue.find(item => item.status === 'working') ?? queue.find(pending)
    ?? queue.find(item => item.id === lastFinishedId) ?? null;
  listeners.forEach(listener => listener());
}
function patch(id: number, change: Partial<Job>) {
  if (!queue.some(item => item.id === id)) return;
  queue = queue.map(item => item.id === id ? { ...item, ...change } : item);
  if (change.status && ['done', 'error', 'canceled'].includes(change.status)) lastFinishedId = id;
  emit();
}
function advance() {
  if (queue.some(item => item.status === 'working')) return;
  const next = queue.find(pending);
  // Preserve enqueue order even if a save picker is still open.
  if (!next || next.status !== 'queued' || !next.prepare) return;
  patch(next.id, { status: 'working', prepare: undefined });
  void next.prepare().then(payload => {
    const current = getVideoExportJobById(next.id);
    if (current?.status === 'working' && !current.controller.signal.aborted) {
      patch(next.id, { payload, progress: { phase: 'encoding', progress: current.progress.progress } });
    }
  }).catch(error => failVideoExport(next.id, error instanceof Error ? error : new Error(String(error))));
}
function cancelTarget(target?: FileSaveTarget) { void target?.cancel?.().catch(() => {}); }
export function reportVideoExport(id: number, progress: ExportProgress) {
  if (job?.id === id && job.status === 'working' && !job.controller.signal.aborted) patch(id, { progress });
}
export function failVideoExport(id: number, failure: Error) {
  const current = getVideoExportJobById(id);
  if (!current || !pending(current) || current.controller.signal.aborted) return;
  cancelTarget(current.destination);
  const phase = current.progress.phase;
  const error = failure.message === 'VIDEO_UNSUPPORTED' ? 'videoUnsupported'
    : failure.message === 'VIDEO_QUALITY_UNSUPPORTED' ? 'videoQualityUnsupported'
    : failure.message === 'VIDEO_NATIVE_REBUILD' ? 'videoNativeRebuild'
    : failure.message === 'VIDEO_TOO_LONG' ? 'videoTooLong'
    : failure.message === 'VIDEO_TOO_LARGE' ? 'videoTooLarge'
    : failure.message === 'SAVE_LOCATION_UNSUPPORTED' ? 'fileSaveUnsupported'
    : phase === 'preparing' ? 'videoPrepareFailed' : phase === 'encoding' ? 'videoEncodeFailed' : 'videoSaveFailed';
  patch(id, { status: failure.message.includes('EXPORT_CANCELED') ? 'canceled' : 'error', error, payload: null, prepare: undefined });
  advance();
}
export function completeVideoExport(id: number) {
  if (job?.id !== id || job.status !== 'working' || job.controller.signal.aborted) return;
  patch(id, { status: 'done', payload: null, progress: { phase: 'saving', progress: 1 } });
  advance();
}
export function cancelVideoExport(id: number) {
  const current = getVideoExportJobById(id);
  if (!current || !pending(current) || (current.status === 'working' && current.progress.phase === 'saving')) return false;
  current.controller.abort();
  cancelTarget(current.destination);
  patch(id, { status: 'canceled', payload: null, prepare: undefined });
  advance();
  return true;
}
export function dismissVideoExport() {
  if (videoExportBusy()) return;
  queue = [];
  lastFinishedId = undefined;
  job = null;
  emit();
}

export function beginVideoExport(story: SavedStory, ratio: VideoRatio, language: AppLanguage, labels: VideoPayload['labels'], includeChat: boolean, quality: VideoQuality = '720p') {
  // Only one OS save picker may be open; encoding does not block enqueueing.
  if (queue.some(item => item.status === 'picking')) return null;
  if (!videoExportBusy()) queue = [];
  const id = ++sequence;
  const controller = new AbortController();
  const snapshot = { ...story, ...(story.chatMessages ? { chatMessages: story.chatMessages.map(message => ({ ...message })) } : {}) };
  queue = [...queue, { id, title: story.title, status: 'picking', progress: { phase: 'preparing', progress: 0 }, controller, payload: null, error: '' }];
  emit();
  const ready = (async () => {
    try {
      // Keep the save picker directly in the button's user-activation chain.
      const target = await chooseVideoSaveTarget(videoFileName(story.title, ratio, quality), controller.signal);
      if (controller.signal.aborted || !getVideoExportJobById(id)) { cancelTarget(target ?? undefined); return false; }
      if (target === null) { cancelVideoExport(id); return false; }
      patch(id, { status: 'queued', destination: target, prepare: () => prepareVideo(snapshot, ratio, language, labels, {
        signal: controller.signal, includeChat, quality, onProgress: progress => reportVideoExport(id, progress),
      }) });
      advance();
      return true;
    } catch (error) {
      failVideoExport(id, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  })();
  return { id, ready };
}
