export const CHAT_POP_KEY = 'Chat_Pop.wav';
export const CHAT_POP_DURATION = 0.18;
export const CHAT_SOUND_IDS = ['pop', 'bloop', 'bell', 'click', 'soft', 'none'] as const;
export type ChatSoundId = typeof CHAT_SOUND_IDS[number];
export function normalizeChatSound(value: unknown): ChatSoundId {
  return CHAT_SOUND_IDS.includes(value as ChatSoundId) ? value as ChatSoundId : 'pop';
}
export function chatSoundKey(id: ChatSoundId): string {
  return id === 'pop' ? CHAT_POP_KEY : `Chat_${id}.wav`;
}
