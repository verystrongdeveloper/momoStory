import { useSyncExternalStore } from 'react';
import { getSetting, saveSetting, subscribeStorage } from '@/storage';
import { normalizeChatSound, type ChatSoundId } from '@/utils/chatPresentation';

export const getChatSound = () => normalizeChatSound(getSetting('chatSound'));
export const setChatSound = (value: ChatSoundId) => saveSetting('chatSound', value);
export const useChatSound = () => useSyncExternalStore(subscribeStorage, getChatSound, getChatSound);
