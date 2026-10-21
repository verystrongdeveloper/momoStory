import { modelOrder, rememberModel, canFallback, normalizeModel } from '../../shared/geminiModels';
import { getGeminiModel } from '../geminiModel';
import { prompts } from '../../shared/prompts';
import { GEMINI_OFFLINE_MESSAGE, throwIfOffline } from './errors';
import { withGenerationLanguage } from '../../shared/prompts/generationLanguage';
import type { AppLanguage } from '@/storage/types';
import type { ChatRoom } from '@/shared/chatRoom';

type Part = { text: string };
type Content = { role: 'user' | 'model'; parts: Part[] };

type Session = {
  history: Content[];
};

const sessions = new Map<string, Session>();
export function resetChatSessions(character: string, apiKey: string, room: ChatRoom = 'bond') {
  const prefix = `${keyId(apiKey)}:${character}:${room}:`;
  for (const key of sessions.keys()) if (key.startsWith(prefix)) sessions.delete(key);
}


function keyId(apiKey: string): string {
  let hash = 0;
  for (let i = 0; i < apiKey.length; i += 1) {
    hash = Math.imul(31, hash) + apiKey.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function sessionFor(character: string, sessionKey: string, apiKey: string, room: ChatRoom): Session {
  const cacheKey = [keyId(apiKey), character, room, sessionKey].join(':');
  const existing = sessions.get(cacheKey);
  if (existing) return existing;
  const created: Session = { history: [] };
  sessions.set(cacheKey, created);
  return created;
}

function systemText(character: string, systemInstruction?: string): string {
  return systemInstruction || prompts[character] || `${character}처럼 말해.`;
}

class GeminiHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}


async function generate(apiKey: string, modelName: string, systemInstruction: string, history: Content[], message: string): Promise<string> {
  throwIfOffline();
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [...history, { role: 'user', parts: [{ text: message }] }],
        }),
      },
    );
  } catch {
    throw new Error(GEMINI_OFFLINE_MESSAGE);
  }

  const raw = await res.text();
  let data: {
    error?: { message?: string };
    candidates?: { content?: { parts?: Part[] } }[];
  } = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    const detail = data.error?.message || `Gemini 응답 실패 (${res.status})`;
    throw new GeminiHttpError(res.status, detail);
  }

  const text = (data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text || '').join('').trim();
  if (!text) throw new Error('Gemini 응답이 비어 있습니다.');
  return text;
}

/** Explicit selection is strict; automatic selection can recover from retired or busy models. */
export async function sendWithFallback(
  character: string,
  sessionKey: string,
  message: string,
  systemInstruction: string | undefined,
  apiKey: string,
  language: AppLanguage = 'ko',
  room: ChatRoom = 'bond',
  modelSelection: string = getGeminiModel(),
): Promise<string> {
  const selection = normalizeModel(modelSelection);
  const order = await modelOrder(apiKey, selection);
  const attempted = new Set<string>();
  let refreshed = false;
  const instruction = withGenerationLanguage(systemText(character, systemInstruction), language, sessionKey === 'event' ? 'event' : sessionKey === 'select' ? 'select' : 'chat');
  let lastError: unknown;

  for (const modelName of order) {
    if (attempted.has(modelName)) continue;
    attempted.add(modelName);
    const session = sessionFor(character, sessionKey, apiKey, room);
    try {
      const text = await generate(apiKey, modelName, instruction, session.history, message);
      session.history.push(
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text }] },
      );
      if (selection === 'auto') rememberModel(apiKey, modelName);
      return text;
    } catch (err) {
      lastError = err;
      if (selection !== 'auto' || !(err instanceof GeminiHttpError) || !canFallback(err.status)) throw err;
      if (!refreshed && (err.status === 404 || err.status === 410)) {
        refreshed = true;
        order.push(...(await modelOrder(apiKey, 'auto', true)).filter(model => !attempted.has(model)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini 응답 실패: 사용 가능한 텍스트 모델을 확인해 주세요.');
}

export function userApiKey(raw: string): string {
  const apiKey = raw.trim();
  if (!apiKey) throw new Error('Gemini API 키를 입력하세요');
  if (apiKey.length > 200) throw new Error('Gemini API 키 형식이 올바르지 않습니다');
  return apiKey;
}

export function dialogKey(character: string, apiKey: string, room: ChatRoom = 'bond'): string {
  return `${keyId(apiKey)}:${character}:${room}`;
}
