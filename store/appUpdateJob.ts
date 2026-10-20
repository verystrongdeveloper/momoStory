import { downloadAppUpdate, type PreparedUpdate } from '@/platform/inAppUpdate';
import type { UpdateResult } from '@/services/appUpdate';

type State = { status: 'idle' | 'downloading' | 'ready' | 'installing' | 'permission' | 'opened' | 'error'; progress: number | null; version?: string };
let state: State = { status: 'idle', progress: null };
let prepared: PreparedUpdate | null = null;
const listeners = new Set<() => void>();
const set = (next: State) => { state = next; listeners.forEach(fn => fn()); };
export const getAppUpdateJob = () => state;
export const subscribeAppUpdateJob = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const appUpdateBusy = () => state.status === 'downloading' || state.status === 'installing';
export async function beginAppUpdate(release: UpdateResult) {
  if (appUpdateBusy() || !release.available) return;
  set({ status: 'downloading', progress: null, version: release.version });
  const old = prepared; prepared = null;
  try {
    await old?.close();
    prepared = await downloadAppUpdate(release, progress => set({ ...state, progress }));
    set({ ...state, status: 'ready', progress: 1 });
  } catch { set({ ...state, status: 'error' }); }
}
export async function installAppUpdate() {
  if (!prepared || !['ready', 'permission', 'opened', 'error'].includes(state.status)) return;
  set({ ...state, status: 'installing' });
  try { set({ ...state, status: await prepared.install() }); }
  catch { set({ ...state, status: 'error' }); }
}
