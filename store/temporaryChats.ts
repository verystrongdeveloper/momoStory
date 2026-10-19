import type { SavedChatMessage } from '@/storage/types';

export type TemporaryMessage = Omit<SavedChatMessage, 'sender'> & { sender: 'user' | 'character' | 'typing' };
type TemporaryChat = {
  messages: TemporaryMessage[];
  input: string;
  isWaiting: boolean;
  eventReady: boolean;
  greetingStarted: boolean;
  needsReset: boolean;
};

const empty = (): TemporaryChat => ({ messages: [], input: '', isWaiting: false, eventReady: false, greetingStarted: false, needsReset: false });

function createChat() {
  let snapshot = empty();
  const listeners = new Set<() => void>();
  const update = (change: Partial<TemporaryChat> | ((previous: TemporaryChat) => Partial<TemporaryChat>)) => {
    snapshot = { ...snapshot, ...(typeof change === 'function' ? change(snapshot) : change) };
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update,
    clear: (change: Partial<TemporaryChat> = {}) => update({ ...empty(), ...change }),
  };
}

// Keep ongoing conversations alive when a chat screen unmounts. API keys are
// kept only in memory, and conversations belonging to different keys never mix.
const chats = new Map<string, Map<string, ReturnType<typeof createChat>>>();
export function getTemporaryChat(character: string, apiKey: string) {
  let characters = chats.get(apiKey);
  if (!characters) { characters = new Map(); chats.set(apiKey, characters); }
  let chat = characters.get(character);
  if (!chat) { chat = createChat(); characters.set(character, chat); }
  return chat;
}
