import { getSetting, saveSetting, subscribeStorage } from '@/storage';
export const getGeminiModel = () => getSetting('geminiModel');
export const setGeminiModel = (value: string) => saveSetting('geminiModel', value);
export const subscribeGeminiModel = subscribeStorage;
