import { useSyncExternalStore } from 'react';
import { getSetting, saveSetting, subscribeStorage } from '@/storage';
import { DEFAULT_PREFERENCES, type ScreenOrientationMode } from '@/storage/types';

export function getScreenOrientation() {
  return getSetting('screenOrientation');
}

export function setScreenOrientation(mode: ScreenOrientationMode) {
  saveSetting('screenOrientation', mode);
}

export function useScreenOrientation() {
  return useSyncExternalStore(subscribeStorage, getScreenOrientation, () => DEFAULT_PREFERENCES.screenOrientation);
}
