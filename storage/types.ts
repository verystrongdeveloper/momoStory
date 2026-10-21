import { normalizeModel } from '../shared/geminiModels';
import { normalizeChatSound, type ChatSoundId } from '../utils/chatPresentation';
export type AppLanguage = 'ko' | 'en' | 'ja' | 'zh';

export type Preferences = {
  language: AppLanguage;
  geminiModel: string;
  chatSize: number;
  bgmVolume: number;
  sfxVolume: number;
  chatSound: ChatSoundId;
  greetMode: boolean;
  rememberApiKey: boolean;
  termsAccepted: boolean;
  tutorialSeen: boolean;
};

export type SavedChatMessage = {
  sender: 'user' | 'character';
  text: string;
  showImage?: boolean;
};

export type StoryRecord = {
  id: string;
  title: string;
  character: string;
  script: string;
  createdAt: number;
  chatMessages?: SavedChatMessage[];
};

export type StorageSnapshot = Preferences & {
  apiKey: string;
  stories: StoryRecord[];
};

export const DEFAULT_PREFERENCES: Preferences = {
  language: 'en',
  geminiModel: 'auto',
  chatSize: 1,
  bgmVolume: 0.5,
  sfxVolume: 0.5,
  chatSound: 'pop',
  greetMode: false,
  rememberApiKey: false,
  termsAccepted: false,
  tutorialSeen: false,
};

export const MIGRATION_FLAG = 'momo.migration.v1';
export const PREFERENCES_KEY = 'momo.preferences';
export const WEB_API_KEY = 'momo.secure.apiKey';
export const NATIVE_API_KEY = 'momo.geminiApiKey';
export const NATIVE_PREFERENCES_KEY = 'momo.preferences';
export const NATIVE_STORIES_KEY = 'momo.stories';

export const OLD_API_KEY = 'momo.geminiApiKey';
export const OLD_VOLUME = 'momo.bgmVolume';
export const OLD_GREET = 'momo.greetMode';
export const OLD_STORIES = 'momo.storyLibrary';

export function clampVolume(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const next = Math.min(1, Math.max(0, value));
  return Math.round(next * 100) / 100;
}

export const MIN_CHAT_SIZE = 0.8;
export const MAX_CHAT_SIZE = 1.5;

export function clampChatSize(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.round(Math.min(MAX_CHAT_SIZE, Math.max(MIN_CHAT_SIZE, value)) * 10) / 10;
}

export function parseVolume(raw: string | null): number {
  if (raw == null || raw === '') return DEFAULT_PREFERENCES.bgmVolume;
  return clampVolume(Number(raw)) ?? DEFAULT_PREFERENCES.bgmVolume;
}

export function sanitizeStories(input: unknown): StoryRecord[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && typeof item.id === 'string' && typeof item.script === 'string')
    .map((item) => ({
      id: item.id,
      script: item.script,
      title: typeof item.title === 'string' ? item.title : '스토리',
      character: typeof item.character === 'string' ? item.character : '스토리',
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
      ...(Array.isArray(item.chatMessages) ? {
        chatMessages: item.chatMessages
          .filter((message: unknown): message is SavedChatMessage =>
            typeof message === 'object' && message !== null &&
            'sender' in message && (message.sender === 'user' || message.sender === 'character') &&
            'text' in message && typeof message.text === 'string')
          .map((message: SavedChatMessage) => ({
            sender: message.sender,
            text: message.text,
            showImage: message.showImage === true,
          })),
      } : {}),
    }));
}

/** JSON이 깨져 있으면 null. 마이그레이션은 그때 옛 값을 지우지 않는다. */
export function parseStories(raw: string | null): StoryRecord[] | null {
  if (raw == null || raw === '') return [];
  try {
    return sanitizeStories(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function parsePreferences(raw: string | null): Preferences {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      language: parsed.language === 'ko' || parsed.language === 'en' || parsed.language === 'ja' || parsed.language === 'zh' ? parsed.language : DEFAULT_PREFERENCES.language,
      geminiModel: normalizeModel(parsed.geminiModel),
      chatSize: typeof parsed.chatSize === 'number' ? clampChatSize(parsed.chatSize) ?? DEFAULT_PREFERENCES.chatSize : DEFAULT_PREFERENCES.chatSize,
      bgmVolume: clampVolume(Number(parsed.bgmVolume)) ?? DEFAULT_PREFERENCES.bgmVolume,
      sfxVolume: clampVolume(Number(parsed.sfxVolume)) ?? DEFAULT_PREFERENCES.sfxVolume,
      chatSound: normalizeChatSound(parsed.chatSound),
      greetMode: parsed.greetMode === true,
      rememberApiKey: parsed.rememberApiKey === true,
      termsAccepted: parsed.termsAccepted === true,
      tutorialSeen: parsed.tutorialSeen === true,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}
