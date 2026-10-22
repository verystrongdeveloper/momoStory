import type { SavedChatMessage } from '@/storage/types';
import type { ChatRoom } from '@/shared/chatRoom';

export type TemporaryMessage = Omit<SavedChatMessage, 'sender'> & { sender: 'user' | 'character' | 'typing' };
type TemporaryChat = {
  messages: TemporaryMessage[];
  input: string;
  isWaiting: boolean;
  eventReady: boolean;
  completedPairs: number;
  greetingStarted: boolean;
  needsReset: boolean;
  storyScript: string | null;
  generation: number;
  unreadCount: number;
};

const empty = (): TemporaryChat => ({ messages: [], input: '', isWaiting: false, eventReady: false, completedPairs: 0, greetingStarted: false, needsReset: false, storyScript: null, generation: 0, unreadCount: 0 });

function createChat() {
  let snapshot = empty();
  const listeners = new Set<() => void>();
  let readers = 0;
  const update = (change: Partial<TemporaryChat> | ((previous: TemporaryChat) => Partial<TemporaryChat>)) => {
    const patch = typeof change === 'function' ? change(snapshot) : change;
    const characterCount = (messages: TemporaryMessage[]) => messages.filter(message => message.sender === 'character').length;
    const added = patch.messages ? Math.max(0, characterCount(patch.messages) - characterCount(snapshot.messages)) : 0;
    const unreadCount = readers > 0 ? 0 : patch.unreadCount ?? snapshot.unreadCount + added;
    snapshot = { ...snapshot, ...patch, unreadCount };
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update,
    openReader: () => {
      readers++;
      if (snapshot.unreadCount) update({ unreadCount: 0 });
      let active = true;
      return () => { if (active) { active = false; readers--; } };
    },
    clear: (change: Partial<TemporaryChat> = {}) => update({ ...empty(), generation: snapshot.generation + 1, ...change }),
  };
}

// Keep ongoing conversations alive when a chat screen unmounts. API keys are
// kept only in memory, and conversations belonging to different keys never mix.
const chats = new Map<string, Map<string, ReturnType<typeof createChat>>>();
export function getTemporaryChat(character: string, apiKey: string, room: ChatRoom = 'bond') {
  let characters = chats.get(apiKey);
  if (!characters) { characters = new Map(); chats.set(apiKey, characters); }
  const slot = `${character}:${room}`;
  let chat = characters.get(slot);
  if (!chat) { chat = createChat(); characters.set(slot, chat); }
  return chat;
}
