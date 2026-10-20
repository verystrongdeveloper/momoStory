// src/services/geminiService.js
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { prompts } = require('../config/prompts');
const { normalizeGenerationLanguage, withGenerationLanguage } = require('../../../shared/prompts/generationLanguage');

// 앞 모델이 503/429면 다음 모델로 넘긴다.
const MODEL_FALLBACKS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

const GEMINI_MODEL = MODEL_FALLBACKS[0];

const clients = new Map();
const sessions = new Map();
let activeModel = GEMINI_MODEL;

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

function isOverloaded(err) {
  return err?.status === 503 || err?.status === 429;
}

function orderFrom(modelName) {
  const index = MODEL_FALLBACKS.indexOf(modelName);
  if (index === -1) return [modelName, ...MODEL_FALLBACKS];
  return MODEL_FALLBACKS.slice(index).concat(MODEL_FALLBACKS.slice(0, index));
}

async function openChat(character, modelName, sessionKey, systemInstruction, apiKey, language, room) {
  const { id, genAI } = clientFor(apiKey);
  const cacheKey = [id, character, room, modelName, sessionKey].filter(Boolean).join(':');
  const instruction = withGenerationLanguage(systemInstruction || prompts[character] || `${character}처럼 말해.`, language, sessionKey === 'event' ? 'event' : sessionKey === 'select' ? 'select' : 'chat');
  const existing = sessions.get(cacheKey);
  if (existing?.instruction === instruction) return existing.chat;
  // SDK system instructions are fixed at session creation. Recreate on language
  // change, retaining the conversation instead of continuing with the old language.
  const history = existing ? await existing.chat.getHistory() : [];

  console.log(`[Cache MISS] Creating new session for ${cacheKey}`);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: instruction,
  });
  const chat = model.startChat({ history });
  sessions.set(cacheKey, { chat, instruction });
  return chat;
}

async function sendWithFallback(character, sessionKey, message, systemInstruction, apiKey, language, room) {
  const order = orderFrom(activeModel);
  let lastError;

  for (const modelName of order) {
    try {
      const chat = await openChat(character, modelName, sessionKey, systemInstruction, apiKey, language, room);
      const result = await chat.sendMessage(message);
      if (activeModel !== modelName) {
        console.log(`[MomoStory] 모델 전환: ${activeModel} -> ${modelName}`);
      }
      activeModel = modelName;
      return result;
    } catch (err) {
      lastError = err;
      if (!isOverloaded(err)) throw err;
      console.warn(`[MomoStory] ${modelName} 혼잡(${err.status}), 다음 모델로 시도`);
    }
  }

  throw lastError;
}

/**
 * @param {string} character 캐릭터 이름
 * @param {string} [_modelName] 호환용. 실제 순서는 MODEL_FALLBACKS를 따른다.
 * @param {string} [sessionKey] 같은 캐릭터라도 세션을 나눌 때 사용
 * @param {string} [systemInstruction] 있으면 캐릭터 기본 프롬프트 대신 사용
 */
async function getChat(character, _modelName = GEMINI_MODEL, sessionKey = '', systemInstruction, apiKey, language = 'ko', room = 'bond') {
  const selectedLanguage = normalizeGenerationLanguage(language);
  return {
    sendMessage(message) {
      return sendWithFallback(character, sessionKey, message, systemInstruction, apiKey, selectedLanguage, room);
    },
  };
}

function resetChatSessions(character, apiKey, room = 'bond') {
  const prefix = `${keyId(apiKey)}:${character}:${room}:`;
  for (const key of sessions.keys()) if (key.startsWith(prefix)) sessions.delete(key);
}

module.exports = { getChat, GEMINI_MODEL, apiKeyFrom, keyId, resetChatSessions };
