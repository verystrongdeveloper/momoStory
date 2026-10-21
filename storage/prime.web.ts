import {
  MIGRATION_FLAG,
  OLD_API_KEY,
  OLD_GREET,
  OLD_STORIES,
  OLD_VOLUME,
  PREFERENCES_KEY,
  WEB_API_KEY,
  parsePreferences,
  DEFAULT_PREFERENCES,
  parseStories,
  parseVolume,
  StorageSnapshot,
} from './types';

/** 웹 첫 화면용. 새 저장소가 있으면 그것을, 없으면 예전 localStorage를 메모리에만 올린다. */
export function readInitialSync(): StorageSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === '1') {
      const prefs = parsePreferences(localStorage.getItem(PREFERENCES_KEY));
      const apiKey = prefs.rememberApiKey ? (localStorage.getItem(WEB_API_KEY) ?? '').trim() : '';
      return { apiKey, ...prefs, stories: [] };
    }

    const apiKey = (localStorage.getItem(OLD_API_KEY) ?? '').trim();
    return {
      apiKey,
      language: DEFAULT_PREFERENCES.language,
      geminiModel: DEFAULT_PREFERENCES.geminiModel,
      chatSize: DEFAULT_PREFERENCES.chatSize,
      rememberApiKey: apiKey.length > 0,
      bgmVolume: parseVolume(localStorage.getItem(OLD_VOLUME)),
      sfxVolume: DEFAULT_PREFERENCES.sfxVolume,
      chatSound: DEFAULT_PREFERENCES.chatSound,
      greetMode: localStorage.getItem(OLD_GREET) === '1',
      termsAccepted: false,
      tutorialSeen: false,
      stories: parseStories(localStorage.getItem(OLD_STORIES)) ?? [],
    };
  } catch {
    return null;
  }
}
