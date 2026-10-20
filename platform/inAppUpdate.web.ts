import type { UpdateResult } from '@/services/appUpdate';
import type { PreparedUpdate } from './inAppUpdate';

export function supportsInAppUpdate() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
export async function downloadAppUpdate(release: UpdateResult, progress: (value: number | null) => void): Promise<PreparedUpdate> {
  if (!supportsInAppUpdate()) throw new Error('UPDATE_UNAVAILABLE');
  const { check } = await import('@tauri-apps/plugin-updater');
  const update = await check({ timeout: 30_000 });
  if (!update) throw new Error('UPDATE_UNAVAILABLE');
  try {
    if (update.version.replace(/^v/, '') !== release.version) throw new Error('UPDATE_RELEASE_CHANGED');
    let received = 0, total = 0;
    await update.download(event => {
      if (event.event === 'Started') { total = event.data.contentLength ?? 0; received = 0; }
      if (event.event === 'Progress') received += event.data.chunkLength;
      progress(event.event === 'Finished' ? 1 : total > 0 ? Math.min(1, received / total) : null);
    }, { timeout: 600_000 });
    return { install: async () => { await update.install({ restartAfterInstall: true }); return 'opened'; }, close: () => update.close() };
  } catch (error) { await update.close(); throw error; }
}
