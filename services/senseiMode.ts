import { getSetting, saveSetting, subscribeStorage } from '@/storage';
import type { SenseiMode } from '@/shared/senseiMode';

export const getSenseiMode = () => getSetting('senseiMode');
export const setSenseiMode = (mode: SenseiMode) => saveSetting('senseiMode', mode);
export const subscribeSenseiMode = subscribeStorage;
