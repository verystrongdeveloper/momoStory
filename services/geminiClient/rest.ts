import { prompts } from '../../shared/prompts';
import { GEMINI_OFFLINE_MESSAGE, throwIfOffline } from './errors';
import { withGenerationLanguage } from '../../shared/prompts/generationLanguage';
import type { AppLanguage } from '@/storage/types';
import type { ChatRoom } from '@/shared/chatRoom';

const MODEL_FALLBACKS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

const GEMINI_MODEL = MODEL_FALLBACKS[0];

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
let activeModel = GEMINI_MODEL;

function keyId(apiKey: string): string {
  let hash = 0;
  for (let i = 0; i < apiKey.length; i += 1) {
    hash = Math.imul(31, hash) + apiKey.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function orderFrom(modelName: string): string[] {
  const index = MODEL_FALLBACKS.indexOf(modelName);
  if (index === -1) return [modelName, ...MODEL_FALLBACKS];
  return MODEL_FALLBACKS.slice(index).concat(MODEL_FALLBACKS.slice(0, index));
}

function sessionFor(character: string, modelName: string, sessionKey: string, apiKey: string, room: ChatRoom): Session {
  const cacheKey = [keyId(apiKey), character, room, modelName, sessionKey].filter(Boolean).join(':');
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

function isOverloaded(err: unknown): boolean {
  return err instanceof GeminiHttpError && (err.status === 503 || err.status === 429);
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

/** 서버 geminiService와 같이, 세션은 모델별로 비우고 503/429만 다음 모델로 넘긴다. */
export async function sendWithFallback(
  character: string,
  sessionKey: string,
  message: string,
  systemInstruction: string | undefined,
  apiKey: string,
  language: AppLanguage = 'ko',
  room: ChatRoom = 'bond',
): Promise<string> {
  const order = orderFrom(activeModel);
  const instruction = withGenerationLanguage(systemText(character, systemInstruction), language, sessionKey === 'event' ? 'event' : sessionKey === 'select' ? 'select' : 'chat');
  let lastError: unknown;

  for (const modelName of order) {
    const session = sessionFor(character, modelName, sessionKey, apiKey, room);
    try {
      const text = await generate(apiKey, modelName, instruction, session.history, message);
      session.history.push(
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text }] },
      );
      activeModel = modelName;
      return text;
    } catch (err) {
      lastError = err;
      if (!isOverloaded(err)) throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini 응답 실패');
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
