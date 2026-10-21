import { clearApiKey, loadApiKey, saveApiKey as writeApiKey } from './secureStorage';
import { loadPreferences, savePreferences } from './preferencesStorage';
import { readStoryRecords, writeStoryRecords } from './storyStorage';
import { migrateLegacyStorage } from './migrate';
import { readInitialSync } from './prime';
import { AppLanguage, DEFAULT_PREFERENCES, Preferences, StoryRecord, clampChatSize, clampVolume } from './types';
import { normalizeModel } from '../shared/geminiModels';
import { normalizeChatSound, type ChatSoundId } from '../utils/chatPresentation';

type SettingKey = 'geminiModel' | 'language' | 'chatSound' | 'chatSize' | 'bgmVolume' | 'sfxVolume' | 'greetMode' | 'rememberApiKey' | 'termsAccepted' | 'tutorialSeen';

let synced = readInitialSync() != null;

export function isStorageSynced() {
  return synced;
}

let memory: Preferences & { apiKey: string; stories: StoryRecord[] } = {
  apiKey: '',
  ...DEFAULT_PREFERENCES,
  stories: [],
};

const initial = readInitialSync();
if (initial) memory = initial;

const listeners = new Set<() => void>();
let hydrated = false;
let dirty = false;
let hydratePromise: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeStorage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getApiKey() {
  return memory.apiKey.trim();
}

export function getRememberApiKey() {
  return memory.rememberApiKey;
}

export function getSetting(key: 'chatSize' | 'bgmVolume' | 'sfxVolume'): number;
export function getSetting(key: 'geminiModel'): string;
export function getSetting(key: 'language'): AppLanguage;
export function getSetting(key: 'chatSound'): ChatSoundId;
export function getSetting(key: 'greetMode' | 'rememberApiKey' | 'termsAccepted' | 'tutorialSeen'): boolean;
export function getSetting(key: SettingKey): number | boolean | string {
  return memory[key];
}

export function loadStories(): StoryRecord[] {
  return memory.stories;
}

async function persistAll() {
  const prefs: Preferences = {
    language: memory.language,
    geminiModel: memory.geminiModel,
    chatSize: memory.chatSize,
    bgmVolume: memory.bgmVolume,
    sfxVolume: memory.sfxVolume,
    chatSound: memory.chatSound,
    greetMode: memory.greetMode,
    rememberApiKey: memory.rememberApiKey,
    termsAccepted: memory.termsAccepted,
    tutorialSeen: memory.tutorialSeen,
  };
  const keyTask = memory.rememberApiKey && memory.apiKey ? writeApiKey(memory.apiKey) : clearApiKey();
  await Promise.all([keyTask, savePreferences(prefs), writeStoryRecords(memory.stories)]);
}

/** remember가 켜져 있을 때만 키를 기기에 남긴다. 꺼져 있으면 이번 실행 메모리만 유지한다. */
export function saveApiKey(key: string, remember = memory.rememberApiKey) {
  memory.apiKey = key.trim();
  memory.rememberApiKey = remember;
  dirty = true;
  emit();
  if (hydrated) void persistAll().catch(() => undefined);
}

export function saveSetting(key: SettingKey, value: number | boolean | string) {
  if (key === 'geminiModel') {
    const next = normalizeModel(value);
    if (next === memory.geminiModel) return;
    memory.geminiModel = next;
  } else if (key === 'language') {
    if (value !== 'ko' && value !== 'en' && value !== 'ja' && value !== 'zh') return;
    if (value === memory.language) return;
    memory.language = value;
  } else if (key === 'chatSound') {
    const next = normalizeChatSound(value);
    if (next === memory.chatSound) return;
    memory.chatSound = next;
  } else if (key === 'chatSize') {
    if (typeof value !== 'number') return;
    const next = clampChatSize(value);
    if (next == null || next === memory.chatSize) return;
    memory.chatSize = next;
  } else if (key === 'bgmVolume' || key === 'sfxVolume') {
    if (typeof value !== 'number') return;
    const next = clampVolume(value);
    if (next == null || next === memory[key]) return;
    memory[key] = next;
  } else if (
    key === 'greetMode' ||
    key === 'rememberApiKey' ||
    key === 'termsAccepted' ||
    key === 'tutorialSeen'
  ) {
    const next = value === true;
    if (next === memory[key]) return;
    memory[key] = next;
  } else {
    return;
  }
  dirty = true;
  emit();
  if (hydrated) void persistAll().catch(() => undefined);
}

export function saveStories(stories: StoryRecord[]) {
  memory.stories = stories;
  dirty = true;
  emit();
  if (hydrated) void writeStoryRecords(stories).catch(() => undefined);
}

async function pullAll() {
  const prefs = await loadPreferences();
  const apiKey = prefs.rememberApiKey ? (await loadApiKey()).trim() : '';
  const stories = await readStoryRecords();
  if (dirty) return;
  memory = {
    apiKey,
    language: prefs.language,
    geminiModel: prefs.geminiModel,
    chatSize: prefs.chatSize,
    bgmVolume: prefs.bgmVolume,
    sfxVolume: prefs.sfxVolume,
    chatSound: prefs.chatSound,
    greetMode: prefs.greetMode,
    rememberApiKey: prefs.rememberApiKey,
    termsAccepted: prefs.termsAccepted,
    tutorialSeen: prefs.tutorialSeen,
    stories,
  };
}

export function hydrateStorage() {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const migrated = await migrateLegacyStorage();
        if (!dirty && migrated) await pullAll();
        hydrated = true;
        if (dirty) await persistAll();
      } catch {
        hydrated = true;
      } finally {
        synced = true;
        emit();
      }
    })();
  }
  return hydratePromise;
}
