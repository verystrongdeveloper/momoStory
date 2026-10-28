import { getApiKey, getRememberApiKey as readRemember, saveApiKey, subscribeStorage } from '@/storage';
import { getGeminiModel } from './geminiModel';
import { parseSelection, readProviderKeys } from '../shared/aiProviders';

/** Active provider key. The legacy export name is kept for existing chat consumers. */
export function getGeminiKey(): string {
  return readProviderKeys(getApiKey())[parseSelection(getGeminiModel()).provider];
}

export function getRememberApiKey(): boolean {
  return readRemember();
}

export function setGeminiKey(key: string, remember = readRemember()) {
  const keys = readProviderKeys(getApiKey());
  keys[parseSelection(getGeminiModel()).provider] = key.trim();
  saveApiKey(Object.values(keys).some(Boolean) ? JSON.stringify({ format: 'momo-provider-keys-v1', ...keys }) : '', remember);
}

export function subscribeGeminiKey(listener: () => void) {
  return subscribeStorage(listener);
}
