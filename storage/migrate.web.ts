import { clearApiKey, loadApiKey, saveApiKey } from './secureStorage';
import { loadPreferences, savePreferences } from './preferencesStorage';
import { readStoryRecords, writeStoryRecords } from './storyStorage';
import {
  MIGRATION_FLAG,
  OLD_API_KEY,
  OLD_GREET,
  OLD_STORIES,
  OLD_VOLUME,
  DEFAULT_PREFERENCES,
  parseStories,
  parseVolume,
} from './types';

function sameStories(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * 예전 localStorage를 새 저장소로 한 번 옮긴다.
 * 읽어 온 값이 일치하기 전에는 옛 키를 지우지 않는다.
 * 성공하면 true. 새 저장소를 믿어도 된다.
 */
export async function migrateLegacyStorage(): Promise<boolean> {
  if (typeof localStorage === 'undefined') return true;

  try {
    if (localStorage.getItem(MIGRATION_FLAG) === '1') return true;

    const oldKeyRaw = localStorage.getItem(OLD_API_KEY);
    const oldVolumeRaw = localStorage.getItem(OLD_VOLUME);
    const oldGreetRaw = localStorage.getItem(OLD_GREET);
    const oldStoriesRaw = localStorage.getItem(OLD_STORIES);
    const hasAny = oldKeyRaw != null || oldVolumeRaw != null || oldGreetRaw != null || oldStoriesRaw != null;
    if (!hasAny) {
      localStorage.setItem(MIGRATION_FLAG, '1');
      return true;
    }

    const stories = parseStories(oldStoriesRaw);
    if (stories == null) return false;

    const apiKey = (oldKeyRaw ?? '').trim();
    const rememberApiKey = apiKey.length > 0;
    const prefs = {
      language: DEFAULT_PREFERENCES.language,
      chatSize: DEFAULT_PREFERENCES.chatSize,
      bgmVolume: parseVolume(oldVolumeRaw),
      sfxVolume: DEFAULT_PREFERENCES.sfxVolume,
      chatSound: DEFAULT_PREFERENCES.chatSound,
      greetMode: oldGreetRaw === '1',
      includeBondStory: DEFAULT_PREFERENCES.includeBondStory,
      rememberApiKey,
      termsAccepted: false,
      tutorialSeen: false,
    };

    if (rememberApiKey) await saveApiKey(apiKey);
    else await clearApiKey();
    await savePreferences(prefs);
    await writeStoryRecords(stories);

    const readKey = rememberApiKey ? (await loadApiKey()).trim() : '';
    const readPrefs = await loadPreferences();
    const readStories = await readStoryRecords();
    const ok =
      (!rememberApiKey || readKey === apiKey) &&
      readPrefs.bgmVolume === prefs.bgmVolume &&
      readPrefs.sfxVolume === prefs.sfxVolume &&
      readPrefs.greetMode === prefs.greetMode &&
      readPrefs.rememberApiKey === prefs.rememberApiKey &&
      sameStories(readStories, stories);

    if (!ok) return false;

    localStorage.removeItem(OLD_API_KEY);
    localStorage.removeItem(OLD_VOLUME);
    localStorage.removeItem(OLD_GREET);
    localStorage.removeItem(OLD_STORIES);
    localStorage.setItem(MIGRATION_FLAG, '1');
    return true;
  } catch {
    return false;
  }
}
