import { prepareVideo } from '@/services/videoExport/prepare';
import { videoFileName, type ExportProgress, type VideoPayload } from '@/services/videoExport/types';
import type { VideoRatio } from '@/services/videoExport/timeline';
import type { AppLanguage } from '@/storage/types';
import type { SavedStory } from '@/store/storyLibrary';
import type { FileSaveTarget } from '@/platform/fileSave.types';
import { chooseVideoSaveTarget } from '@/platform/videoSave';

type Job = {
  id: number;
  title: string;
  status: 'picking' | 'working' | 'done' | 'error' | 'canceled';
  progress: ExportProgress;
  controller: AbortController;
  destination?: FileSaveTarget;
  payload: VideoPayload | null;
  error: string;
};
let job: Job | null = null;
let sequence = 0;
const listeners = new Set<() => void>();
export const getVideoExportJob = () => job;
export const subscribeVideoExportJob = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const videoExportBusy = () => job?.status === 'working' || job?.status === 'picking';
function patch(id: number, change: Partial<Job>) {
  if (job?.id !== id) return;
  job = { ...job, ...change };
  listeners.forEach(listener => listener());
}
function cancelTarget(target?: FileSaveTarget) { void target?.cancel?.().catch(() => {}); }
export function reportVideoExport(id: number, progress: ExportProgress) {
  if (job?.id === id && job.status === 'working' && !job.controller.signal.aborted) patch(id, { progress });
}
export function failVideoExport(id: number, failure: Error) {
  if (job?.id !== id || !videoExportBusy() || job.controller.signal.aborted) return;
  cancelTarget(job.destination);
  const phase = job.progress.phase;
  const error = failure.message === 'VIDEO_UNSUPPORTED' ? 'videoUnsupported'
    : failure.message === 'VIDEO_NATIVE_REBUILD' ? 'videoNativeRebuild'
    : failure.message === 'VIDEO_TOO_LONG' ? 'videoTooLong'
    : failure.message === 'VIDEO_TOO_LARGE' ? 'videoTooLarge'
    : failure.message === 'SAVE_LOCATION_UNSUPPORTED' ? 'fileSaveUnsupported'
    : phase === 'preparing' ? 'videoPrepareFailed' : phase === 'encoding' ? 'videoEncodeFailed' : 'videoSaveFailed';
  patch(id, { status: failure.message.includes('EXPORT_CANCELED') ? 'canceled' : 'error', error, payload: null });
}
export function completeVideoExport(id: number) {
  if (job?.id !== id || job.status !== 'working' || job.controller.signal.aborted) return;
  patch(id, { status: 'done', payload: null, progress: { phase: 'saving', progress: 1 } });
}
export function cancelVideoExport(id: number) {
  if (job?.id !== id || !videoExportBusy() || (job.status === 'working' && job.progress.phase === 'saving')) return false;
  job.controller.abort();
  cancelTarget(job.destination);
  patch(id, { status: 'canceled', payload: null });
  return true;
}
export function dismissVideoExport() {
  if (videoExportBusy()) return;
  job = null;
  listeners.forEach(listener => listener());
}

export function beginVideoExport(story: SavedStory, ratio: VideoRatio, language: AppLanguage, labels: VideoPayload['labels'], includeChat: boolean) {
  if (videoExportBusy()) return null;
  const id = ++sequence;
  const controller = new AbortController();
  job = { id, title: story.title, status: 'picking', progress: { phase: 'preparing', progress: 0 }, controller, payload: null, error: '' };
  listeners.forEach(listener => listener());
  const ready = (async () => {
    try {
      // Keep the save picker directly in the button's user-activation chain.
      const target = await chooseVideoSaveTarget(videoFileName(story.title, ratio), controller.signal);
      if (controller.signal.aborted || job?.id !== id) { cancelTarget(target ?? undefined); return false; }
      if (target === null) { patch(id, { status: 'canceled' }); return false; }
      patch(id, { status: 'working', destination: target });
      // Preparation and encoding belong to the root host, never to the options modal.
      void prepareVideo(story, ratio, language, labels, {
        signal: controller.signal, includeChat, onProgress: progress => reportVideoExport(id, progress),
      }).then(payload => {
        if (!controller.signal.aborted && job?.id === id && job.status === 'working') {
          patch(id, { payload, progress: { phase: 'encoding', progress: job.progress.progress } });
        }
      }).catch(error => failVideoExport(id, error instanceof Error ? error : new Error(String(error))));
      return true;
    } catch (error) {
      failVideoExport(id, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  })();
  return { id, ready };
}
