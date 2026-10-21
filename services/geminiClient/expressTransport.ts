import { getGeminiModel } from '../geminiModel';
import { getSenseiMode } from '../senseiMode';
import { getGeminiKey } from '@/services/geminiKey';
import { getAppLanguage } from '@/services/appLanguage';
import { GEMINI_OFFLINE_MESSAGE, throwIfOffline } from './errors';
import type { ChatRoom } from '@/shared/chatRoom';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  throwIfOffline();
  const apiKey = getGeminiKey();
  const payload = { ...body, language: getAppLanguage(), model: getGeminiModel() };
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiKey ? { ...payload, apiKey } : payload),
    });
  } catch {
    throw new Error(GEMINI_OFFLINE_MESSAGE);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[api] ${path} ${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

/** 기존 Express /api. 직접 호출이 production web에서 확인되기 전까지 기본 경로다. */
export const expressTransport = {
  reset: (character: string, room: ChatRoom = 'bond') => post<{ ok: boolean }>('/api/chat/reset', { character, room }),
  trigger: (character: string, room: ChatRoom = 'bond') =>
    post<{ triggerLine: string }>('/api/trigger', { character, room }),

  chat: (character: string, message: string, room: ChatRoom = 'bond') =>
    post<{ reply: string; eventReady: boolean }>('/api/chat', { character, message, room }),

  createEvent: (character: string) =>
    post<{ eventScript: string }>('/api/event', { character, senseiMode: getSenseiMode() }),
};
