import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { UpdateResult } from '@/services/appUpdate';

export type PreparedUpdate = { install: () => Promise<'permission' | 'opened'>; close: () => Promise<void> };
export function supportsInAppUpdate() {
  return Platform.OS === 'android' && !!NativeModules.MomoAppUpdate;
}
export async function downloadAppUpdate(release: UpdateResult, progress: (value: number | null) => void): Promise<PreparedUpdate> {
  const native = NativeModules.MomoAppUpdate;
  if (!supportsInAppUpdate() || !release.android) throw new Error('UPDATE_UNAVAILABLE');
  const events = new NativeEventEmitter(native);
  const listener = events.addListener('MomoUpdateProgress', (event: { received: number; total: number }) => {
    progress(event.total > 0 ? Math.min(1, event.received / event.total) : null);
  });
  try {
    await native.download(release.android.url, release.android.sha256, release.android.size, release.version);
  } finally { listener.remove(); }
  return { install: () => native.install(), close: async () => {} };
}
