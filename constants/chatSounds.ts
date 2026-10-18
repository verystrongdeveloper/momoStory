import { CHAT_POP_KEY } from '@/utils/chatPresentation';

export const chatSoundSources: Record<string, number> = {
  [CHAT_POP_KEY]: require('../assets/audio/chat-pop.wav'),
  'Chat_bloop.wav': require('../assets/audio/chat-bloop.wav'),
  'Chat_bell.wav': require('../assets/audio/chat-bell.wav'),
  'Chat_click.wav': require('../assets/audio/chat-click.wav'),
  'Chat_soft.wav': require('../assets/audio/chat-soft.wav'),
};
