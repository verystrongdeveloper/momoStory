// src/controllers/chatController.js
const chatLogs = new Map(); // 키+캐릭터+채팅방별 누적 대화
const { getChat, apiKeyFrom, keyId, resetChatSessions, restoreConversation } = require('../services/geminiService');
const { conversationContext } = require('../../../shared/conversation');

function historyKey(character, apiKey, room = 'bond') {
  return `${keyId(apiKey)}:${character}:${room}`;
}

function readKey(req, res) {
  const apiKey = apiKeyFrom(req);
  if (apiKey === null) {
    res.status(400).json({ error: 'Gemini API 키 형식이 올바르지 않습니다' });
    return null;
  }
  if (!apiKey) {
    res.status(400).json({ error: 'Gemini API 키를 입력하세요' });
    return null;
  }
  return apiKey;
}

/**
 * POST /api/chat
 */
exports.sendChat = async (req, res) => {
  const { character, message } = req.body;
  const room = req.body.room === 'chat' ? 'chat' : 'bond';
  const apiKey = readKey(req, res);
  if (!apiKey) return;
  if (!character || !message) {
    return res.status(400).json({ error: 'character 또는 message 누락' });
  }

  const controller = new AbortController();
  const disconnected = () => { if (!res.writableEnded) controller.abort(); };
  res.on?.('close', disconnected);

  try {
    const context = conversationContext(req.body.context);
    const sessionRoom = context ? `room-${context.id}` : room;
    if (context) restoreConversation(character, apiKey, sessionRoom, context);
    const chat   = await getChat(character, undefined, '', undefined, apiKey, req.body.language, sessionRoom, req.body.model);
    const result = await chat.sendMessage(message, { signal: controller.signal });
    if (controller.signal.aborted) return;
    const reply  = result.response.text();

    // 스토리 생성 후에도 다음 생성에 전체 대화를 전달한다.
    const slot = historyKey(character, apiKey, room);
    const log = chatLogs.get(slot) || [];
    if (room === 'bond' && !context) log.push({ user: message, ai: reply });
    chatLogs.set(slot, log);

    const eventReady = room === 'bond' && (context !== null || log.length >= 1);
    res.json({ reply, eventReady });
  } catch (err) {
    if (controller.signal.aborted) return;
    console.error('[Gemini 오류]', err);
    res.status(500).json({ error: 'Gemini 응답 실패' });
  } finally {
    res.off?.('close', disconnected);
  }
};

/**
 * 누적 대화 로그를 조회하는 헬퍼
 * controllers/eventController에서 사용
 */
exports.getDialogHistory = (character, apiKey) => [...(chatLogs.get(historyKey(character, apiKey)) || [])];
exports.chatLogs = chatLogs;
exports.historyKey = historyKey;
exports.readKey = readKey;

exports.resetChat = (req, res) => {
  const apiKey = readKey(req, res);
  if (!apiKey) return;
  const { character } = req.body;
  const room = req.body.room === 'chat' ? 'chat' : 'bond';
  if (typeof character !== 'string' || !character.trim() || character.length > 100) {
    return res.status(400).json({ error: 'character 누락' });
  }
  resetChatSessions(character, apiKey, room);
  chatLogs.delete(historyKey(character, apiKey, room));
  res.json({ ok: true });
};
