import { useSyncExternalStore } from 'react';
import { getSetting, saveSetting, subscribeStorage } from '@/storage';
import { clearAllTemporaryChats } from '@/store/temporaryChats';

export const getIncludeBondStory = () => getSetting('includeBondStory');
export function setIncludeBondStory(value: boolean) {
  if (value === getIncludeBondStory()) return;
  clearAllTemporaryChats();
  saveSetting('includeBondStory', value);
}
export function useIncludeBondStory() {
  return useSyncExternalStore(subscribeStorage, getIncludeBondStory, () => true);
}
