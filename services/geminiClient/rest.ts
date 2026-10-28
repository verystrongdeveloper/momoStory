import { modelOrder, rememberModel, canFallback, normalizeModel } from '../../shared/geminiModels';
import { getGeminiModel } from '../geminiModel';
import { prompts } from '../../shared/prompts';
import { GEMINI_OFFLINE_MESSAGE, throwIfOffline } from './errors';
import { withGenerationLanguage } from '../../shared/prompts/generationLanguage';
import type { AppLanguage } from '@/storage/types';
import type { ChatRoom } from '@/shared/chatRoom';
import { conversationHistory, type ConversationContext } from '../../shared/conversation';
import { endpoints, parseSelection } from '../../shared/aiProviders';

type Part = { text: string };
type Content = { role: 'user' | 'model'; parts: Part[] };

type Session = {
  history: Content[];
};

const sessions = new Map<string, Session>();
export function resetChatSessions(character: string, apiKey: string, room: string = 'bond') {
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

function sessionFor(character: string, sessionKey: string, apiKey: string, room: string): Session {
  const cacheKey = [keyId(apiKey), character, room, sessionKey].join(':');
  const existing = sessions.get(cacheKey);
  if (existing) return existing;
  const created: Session = { history: [] };
  sessions.set(cacheKey, created);
  return created;
}

export function restoreConversation(character: string, apiKey: string, room: string, context: ConversationContext) {
  sessions.set([keyId(apiKey), character, room, ''].join(':'), { history: conversationHistory(context) });
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


function checkCanceled(signal?: AbortSignal) {
  if (signal?.aborted) throw Object.assign(new Error('REQUEST_CANCELED'), { name: 'AbortError' });
}
async function generate(apiKey: string, modelName: string, systemInstruction: string, history: Content[], message: string, signal?: AbortSignal): Promise<string> {
  checkCanceled(signal);
  throwIfOffline();
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`,
      {
        method: 'POST',
        signal,
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
    checkCanceled(signal);
    throw new Error(GEMINI_OFFLINE_MESSAGE);
  }

  const raw = await res.text();
  checkCanceled(signal);
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

async function generateCompatible(provider: 'openrouter' | 'venice', apiKey: string, model: string, instruction: string, history: Content[], message: string, signal?: AbortSignal): Promise<string> {
  checkCanceled(signal);
  throwIfOffline();
  const name = provider === 'openrouter' ? 'OpenRouter' : 'Venice';
  const fail = (message: string) => Object.assign(new Error(message), { code: 'AI_PROVIDER_ERROR' });
  if (model === 'auto') {
    if (provider === 'venice') throw fail('설정에서 Venice 모델을 선택해 주세요. 모델별 API 요금이 적용됩니다.');
    model = 'openrouter/free';
  }
  let response: Response;
  try {
    response = await fetch(`${endpoints[provider]}/chat/completions`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [
        { role: 'system', content: instruction },
        ...history.map(item => ({ role: item.role === 'model' ? 'assistant' : 'user', content: item.parts.map(part => part.text).join('') })),
        { role: 'user', content: message },
      ] }),
    });
  } catch {
    checkCanceled(signal);
    throw fail(`${name}에 연결하지 못했습니다. 네트워크 연결을 확인해 주세요.`);
  }
  checkCanceled(signal);
  if (!response.ok) {
    const reason = response.status === 401 || response.status === 403 ? 'API 키와 모델 접근 권한을 확인해 주세요.'
      : response.status === 402 ? 'API 크레딧 또는 잔액을 확인해 주세요.'
      : response.status === 429 ? '사용 한도 또는 요청 빈도를 초과했습니다. 잠시 후 다시 시도해 주세요.'
      : response.status === 404 ? '설정에서 현재 제공 중인 모델을 선택해 주세요.' : '잠시 후 다시 시도해 주세요.';
    throw fail(`${name} 요청 실패 (${response.status}). ${reason}`);
  }
  const data = await response.json();
  checkCanceled(signal);
  const text = data.choices?.[0]?.message?.content;
  if (data.choices?.[0]?.finish_reason === 'length') throw fail(`${name} 응답이 길이 제한으로 중단됐습니다. 다른 모델을 선택하거나 대화 길이를 줄여 주세요.`);
  if (typeof text !== 'string' || !text.trim()) throw fail(`${name} 응답이 비어 있습니다. 다른 모델을 선택하거나 다시 시도해 주세요.`);
  return text.trim();
}

/** Explicit selection is strict; automatic selection can recover from retired or busy models. */
export async function sendWithFallback(
  character: string,
  sessionKey: string,
  message: string,
  systemInstruction: string | undefined,
  apiKey: string,
  language: AppLanguage = 'ko',
  room: string = 'bond',
  modelSelection: string = getGeminiModel(),
  signal?: AbortSignal,
): Promise<string> {
  checkCanceled(signal);
  const selection = normalizeModel(modelSelection);
  const { provider, model } = parseSelection(selection);
  const instruction = withGenerationLanguage(systemText(character, systemInstruction), language, sessionKey === 'event' ? 'event' : sessionKey === 'select' ? 'select' : 'chat');
  if (provider !== 'gemini') {
    const session = sessionFor(character, sessionKey, apiKey, room);
    const text = await generateCompatible(provider, apiKey, model, instruction, session.history, message, signal);
    checkCanceled(signal);
    session.history.push({ role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text }] });
    return text;
  }
  const order = await modelOrder(apiKey, selection);
  checkCanceled(signal);
  const attempted = new Set<string>();
  let refreshed = false;
  let lastError: unknown;

  for (const modelName of order) {
    checkCanceled(signal);
    if (attempted.has(modelName)) continue;
    attempted.add(modelName);
    const session = sessionFor(character, sessionKey, apiKey, room);
    try {
      const text = await generate(apiKey, modelName, instruction, session.history, message, signal);
      checkCanceled(signal);
      session.history.push(
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text }] },
      );
      if (selection === 'auto') rememberModel(apiKey, modelName);
      return text;
    } catch (err) {
      checkCanceled(signal);
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
  if (!apiKey) throw new Error('선택한 AI 서비스의 API 키를 입력하세요');
  if (apiKey.length > 512) throw new Error('API 키 형식이 올바르지 않습니다');
  return apiKey;
}

export function dialogKey(character: string, apiKey: string, room: ChatRoom = 'bond'): string {
  return `${keyId(apiKey)}:${character}:${room}`;
}
