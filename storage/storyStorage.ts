import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { NATIVE_STORIES_KEY, parseStories, sanitizeStories, StoryRecord } from './types';

const libraryFile = () => new File(Paths.document, 'momo-stories.json');

export async function readStoryRecords(): Promise<StoryRecord[]> {
  try {
    const file = libraryFile();
    if (file.exists) return parseStories(await file.text()) ?? [];
    // Existing installations keep their library on the first upgrade.
    return parseStories(await AsyncStorage.getItem(NATIVE_STORIES_KEY)) ?? [];
  } catch { return []; }
}

export async function writeStoryRecords(stories: StoryRecord[]): Promise<void> {
  // Finish writing before replacing the previous library.
  const temporary = new File(Paths.document, 'momo-stories.pending.json');
  temporary.write(JSON.stringify(sanitizeStories(stories)));
  temporary.moveSync(libraryFile(), { overwrite: true });
}
