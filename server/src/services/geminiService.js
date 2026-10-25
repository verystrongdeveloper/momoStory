// src/services/geminiService.js
const { modelOrder, rememberModel, canFallback, normalizeModel } = require('../../../shared/geminiModels');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { prompts } = require('../config/prompts');
const { normalizeGenerationLanguage, withGenerationLanguage } = require('../../../shared/prompts/generationLanguage');

// Automatic discovery is shared with the installed app.
const GEMINI_MODEL = 'auto';

const clients = new Map();
const sessions = new Map();
const { conversationHistory } = require('../../../shared/conversation');

function restoreConversation(character, apiKey, room, context) {
  sessions.set([keyId(apiKey), character, room, ''].join(':'), { history: conversationHistory(context), failed: true });
}


function keyId(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
}

/** 요청 본문 키가 있으면 그 키, 없으면 서버 환경 변수. */
function apiKeyFrom(req) {
  const raw = req.body?.apiKey;
  if (typeof raw === 'string' && raw.trim()) {
    const fromReq = raw.trim();
    return fromReq.length > 200 ? null : fromReq;
  }
  return (process.env.GEMINI_API_KEY || '').trim();
}

function clientFor(apiKey) {
  const id = keyId(apiKey);
  if (!clients.has(id)) clients.set(id, new GoogleGenerativeAI(apiKey));
  return { id, genAI: clients.get(id) };
}

async function openChat(character, modelName, sessionKey, systemInstruction, apiKey, language, room) {
  const { id, genAI } = clientFor(apiKey);
  const cacheKey = [id, character, room, sessionKey].join(':');
  const instruction = withGenerationLanguage(systemInstruction || prompts[character] || `${character}처럼 말해.`, language, sessionKey === 'event' ? 'event' : sessionKey === 'select' ? 'select' : 'chat');
  const existing = sessions.get(cacheKey);
  if (existing && !existing.failed && existing.instruction === instruction && existing.modelName === modelName) return existing;
  // Recreate from confirmed history: failed SDK sends can poison getHistory().
  const history = existing?.history || [];
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: instruction,
  });
  // The SDK mutates its history array; confirmed history must remain independent
  // so a canceled send cannot leak an unconfirmed turn into a later request.
  const chat = model.startChat({ history: structuredClone(history) });
  const session = { chat, history, instruction, modelName, failed: false };
  sessions.set(cacheKey, session);
  return session;
}

function checkCanceled(signal) {
  if (signal?.aborted) throw Object.assign(new Error('REQUEST_CANCELED'), { name: 'AbortError' });
}
async function sendWithFallback(character, sessionKey, message, systemInstruction, apiKey, language, room, selection = 'auto', signal) {
  checkCanceled(signal);
  selection = normalizeModel(selection);
  const order = await modelOrder(apiKey, selection);
  checkCanceled(signal);
  const attempted = new Set(); let refreshed = false;
  let lastError;

  for (const modelName of order) {
    checkCanceled(signal);
    if (attempted.has(modelName)) continue;
    attempted.add(modelName);
    try {
      const session = await openChat(character, modelName, sessionKey, systemInstruction, apiKey, language, room);
      let result;
      try {
        checkCanceled(signal);
        result = await session.chat.sendMessage(message, signal ? { signal } : undefined);
        checkCanceled(signal);
        const history = await session.chat.getHistory();
        checkCanceled(signal);
        session.history = structuredClone(history);
      } catch (error) { session.failed = true; throw error; }
      if (selection === 'auto') rememberModel(apiKey, modelName);
      return result;
    } catch (err) {
      checkCanceled(signal);
      lastError = err;
      if (selection !== 'auto' || !canFallback(err?.status)) throw err;
      if (!refreshed && (err.status === 404 || err.status === 410)) {
        refreshed = true;
        order.push(...(await modelOrder(apiKey, 'auto', true)).filter(model => !attempted.has(model)));
      }
    }
  }

  throw lastError || new Error('사용 가능한 Gemini 텍스트 모델이 없습니다.');
}

/**
 * @param {string} character 캐릭터 이름
 * @param {string} [_modelName] 호환용. 실제 모델은 selection 설정을 따른다.
 * @param {string} [sessionKey] 같은 캐릭터라도 세션을 나눌 때 사용
 * @param {string} [systemInstruction] 있으면 캐릭터 기본 프롬프트 대신 사용
 */
async function getChat(character, _modelName = GEMINI_MODEL, sessionKey = '', systemInstruction, apiKey, language = 'ko', room = 'bond', selection = 'auto') {
  const selectedLanguage = normalizeGenerationLanguage(language);
  return {
    sendMessage(message, options) {
      return sendWithFallback(character, sessionKey, message, systemInstruction, apiKey, selectedLanguage, room, selection, options?.signal);
    },
  };
}

function resetChatSessions(character, apiKey, room = 'bond') {
  const prefix = `${keyId(apiKey)}:${character}:${room}:`;
  for (const key of sessions.keys()) if (key.startsWith(prefix)) sessions.delete(key);
}

module.exports = { getChat, GEMINI_MODEL, apiKeyFrom, keyId, resetChatSessions, restoreConversation };
