// Stored room context is sent explicitly so a room survives app/server restarts.
function conversationContext(value) {
  if (!value || typeof value.id !== 'string' || !/^[\w-]{1,100}$/.test(value.id)) return null;
  const messages = Array.isArray(value.messages) ? value.messages.filter(message =>
    message && (message.sender === 'user' || message.sender === 'character') && typeof message.text === 'string') : [];
  const scripts = Array.isArray(value.scripts) ? value.scripts.filter(script => typeof script === 'string') : [];
  return { id: value.id, messages, scripts };
}
function dialogPairs(messages) {
  const pairs = [];
  let user = null;
  for (const message of messages) {
    if (message.sender === 'user') { user = message.text; }
    else if (user !== null) { pairs.push({ user, ai: message.text }); user = null; }
    else if (pairs.length) { pairs[pairs.length - 1].ai += '\n' + message.text; }
  }
  return pairs;
}
function continuationText(scripts) {
  return scripts.length ? '\n\n[이 채팅방에서 이미 진행한 스토리 — 사건과 관계를 이어가고 같은 사건을 반복하지 마세요]\n' + scripts.map((script, index) => `--- ${index + 1} ---\n${script}`).join('\n') : '';
}
function conversationHistory(context) {
  const history = [];
  if (context.scripts.length) {
    history.push({ role: 'user', parts: [{ text: continuationText(context.scripts) }] },
      { role: 'model', parts: [{ text: '이전 스토리의 사건과 관계를 이어서 대화하겠습니다.' }] });
  }
  for (const message of context.messages) {
    const role = message.sender === 'user' ? 'user' : 'model';
    const last = history[history.length - 1];
    if (last?.role === role) last.parts[0].text += '\n' + message.text;
    else history.push({ role, parts: [{ text: message.text }] });
  }
  // Gemini requires chat history to begin with a user turn.
  if (history[0]?.role === 'model') history.unshift({ role: 'user', parts: [{ text: '(이전 대화)' }] });
  return history;
}
module.exports = { conversationContext, dialogPairs, continuationText, conversationHistory };
