import type { SavedChatMessage } from '../storage/types';
export type ConversationContext = { id: string; messages: SavedChatMessage[]; scripts: string[] };
export function conversationContext(value: unknown): ConversationContext | null;
export function dialogPairs(messages: SavedChatMessage[]): { user: string; ai: string }[];
export function continuationText(scripts: string[]): string;
export function conversationHistory(context: ConversationContext): { role: 'user' | 'model'; parts: { text: string }[] }[];
