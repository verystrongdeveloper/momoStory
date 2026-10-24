import { loadStories, saveStories, subscribeStorage } from '@/storage';
import type { SavedChatMessage, StoryRecord, StoryEpisode } from '@/storage/types';
import { canonicalCharacterName } from '../shared/prompts/speakerNames';

export type SavedStory = StoryRecord;

export function subscribeStories(listener: () => void) {
  return subscribeStorage(listener);
}

function readStored(): SavedStory[] {
  return loadStories().slice();
}

function writeStored(stories: SavedStory[]) {
  saveStories(stories);
}

const SKIP_SPEAKER = /^(타이틀|title|narration|selection|deleteAll|deleteEmotion|endEvent|waitSecond|bg|music|sound|animation)(?:\s|[:：]|$)/i;

function characterOf(script: string) {
  for (const raw of script.split('\n')) {
    const line = raw.trim();
    if (!line || SKIP_SPEAKER.test(line)) continue;
    const name = line.split(/[（(:：]/)[0].trim();
    if (name) return canonicalCharacterName(name);
  }
  return '스토리';
}

function titleOf(script: string, character: string) {
  const line = script
    .split('\n')
    .map((s) => s.trim())
    .find((s) => /^(?:타이틀|title)\s*[:：]/i.test(s));
  const title = line?.replace(/^(?:타이틀|title)\s*[:：]\s*/i, '').trim();
  return title || `${character}의 스토리`;
}

export function listStories(): SavedStory[] {
  return readStored().slice().sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
}

/** Legacy cards become rooms with one episode without rewriting their IDs. */
export function episodesOf(story: SavedStory): StoryEpisode[] {
  return story.episodes ?? (story.script.trim() ? [{
    id: story.id, title: titleOf(story.script, story.character), script: story.script,
    createdAt: story.createdAt, chatMessages: story.chatMessages ?? [],
  }] : []);
}

/** Select episode content for playback and exports. */
export function episodeStory(story: SavedStory, episodeId?: string): SavedStory | null {
  const episodes = episodesOf(story);
  const episode = episodeId ? episodes.find(item => item.id === episodeId) : episodes.at(-1);
  if (!episode) return null;
  return {
    ...story, ...episode, episodes: undefined,
    // The latest episode can be republished with the room's edited current chat.
    chatMessages: episode.id === episodes.at(-1)?.id ? story.chatMessages ?? episode.chatMessages : episode.chatMessages,
  };
}

/** Video chat covers only the interval leading up to the selected story button. */
export function videoEpisodeStory(story: SavedStory, episodeId: string): SavedStory | null {
  const episodes = episodesOf(story);
  const index = episodes.findIndex(episode => episode.id === episodeId);
  const selected = episodeStory(story, episodeId);
  if (index < 0 || !selected) return null;
  const messages = story.chatMessages ?? episodes[index].chatMessages;
  const boundary = (episode: StoryEpisode) => Math.min(messages.length, Math.max(0,
    episode.afterMessageCount ?? episode.chatMessages.length));
  const end = boundary(episodes[index]);
  const start = index > 0 ? boundary(episodes[index - 1]) : 0;
  return { ...selected, chatMessages: messages.slice(Math.min(start, end), end) };
}

/** A library card keeps one public identity, even when another episode is selected. */
export function publicationStory(story: SavedStory, episodeId?: string): SavedStory | null {
  const selected = episodeStory(story, episodeId);
  if (!selected) return null;
  // Public titles belong to the selected script, independently of the room name.
  return { ...selected, id: story.id, title: titleOf(selected.script, selected.character) };
}

export function updateRoom(id: string, change: Partial<Pick<SavedStory, 'title' | 'chatMessages' | 'episodes'>>): SavedStory | null {
  const stories = readStored();
  const index = stories.findIndex(story => story.id === id);
  if (index < 0) return null;
  const current = stories[index];
  const episodes = change.episodes ?? episodesOf(current);
  const next = { ...current, ...change, episodes, script: episodes.at(-1)?.script ?? '', updatedAt: Date.now() };
  stories[index] = next;
  writeStored(stories);
  return next;
}

export function appendRoomStory(id: string, script: string, chatMessages: SavedChatMessage[]): SavedStory | null {
  const story = readStored().find(story => story.id === id);
  if (!story) return null;
  const messages = chatMessages.map(message => ({ ...message }));
  const episodes = episodesOf(story);
  const title = titleOf(script, story.character);
  return updateRoom(id, { ...(episodes.length === 0 ? { title } : {}), chatMessages: messages, episodes: [...episodes, {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title,
    script, createdAt: Date.now(), chatMessages: messages,
    afterMessageCount: messages.length,
  }] });
}

/** 저장본의 대본을 바꾼다. 카드 제목은 대본의 타이틀 줄을 따른다. */
export function updateStory(id: string, script: string, chatMessages?: SavedChatMessage[]): SavedStory | null {
  const stories = readStored();
  const index = stories.findIndex((story) => story.id === id);
  if (index < 0) return null;
  const next = { ...stories[index], script, title: titleOf(script, stories[index].character),
    ...(stories[index].episodes?.length ? { episodes: stories[index].episodes!.map((episode, episodeIndex, episodes) => episodeIndex === episodes.length - 1 ? { ...episode, script, title: titleOf(script, stories[index].character) } : episode) } : {}),
    ...(chatMessages !== undefined ? { chatMessages: chatMessages.map(message => ({ ...message })) } : {}),
  };
  stories[index] = next;
  writeStored(stories);
  return next;
}

/** 이 브라우저에 저장된 스토리 하나만 지운다. */
export function deleteStory(id: string) {
  writeStored(readStored().filter((story) => story.id !== id));
}

/** txt 대본을 라이브러리에 넣는다. 카드의 캐릭터는 첫 화자 이름을 따른다. */
export function importStory(script: string, chatMessages?: SavedChatMessage[]): SavedStory {
  return saveStory(characterOf(script), script, chatMessages);
}

/** 공유 게시글의 고정 ID를 유지하여 반복 가져오기가 기존 저장본을 덮어쓰지 않게 한다. */
export function importSharedStory(source: SavedStory): SavedStory {
  const stories = readStored();
  const existing = stories.find(story => story.id === source.id);
  if (existing) return existing;
  const story: SavedStory = {
    id: source.id, title: source.title, character: source.character, script: source.script,
    createdAt: Date.now(),
    ...(source.chatMessages ? { chatMessages: source.chatMessages.map(message => ({ ...message })) } : {}),
  };
  writeStored([story, ...stories]);
  return story;
}

/** 생성된 스크립트를 라이브러리에 넣는다. 재생은 그대로 이어진다. */
export function saveStory(character: string, script: string, chatMessages?: SavedChatMessage[]): SavedStory {
  const story: SavedStory = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: titleOf(script, character),
    character,
    script,
    createdAt: Date.now(),
    ...(chatMessages ? { chatMessages: chatMessages.map((message) => ({ ...message })) } : {}),
  };
  writeStored([story, ...readStored()]);
  return story;
}
