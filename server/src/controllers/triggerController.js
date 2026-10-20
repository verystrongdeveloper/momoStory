// src/controllers/triggerController.js
const { getChat } = require('../services/geminiService');
const { readKey } = require('./chatController');
exports.sendTrigger = async (req, res) => {
  const { character } = req.body;
  const room = req.body.room === 'chat' ? 'chat' : 'bond';
  const apiKey = readKey(req, res);
  if (!apiKey) return;
  if (!character) return res.status(400).json({ error: 'character 누락' });

  try {
    const chat = await getChat(character, undefined, '', undefined, apiKey, req.body.language, room);
    const result = await chat.sendMessage(`
당신은 블루 아카이브 세계관의 캐릭터입니다. 선생님에게 구체적인 이유로 말을 거세요. 뭔가 재밌는 일이 터질 것 같은 내용으로 걸면 됩니다. 어떤 재밌는 일이 터질지 다양하게 생각해 본 후 말을 걸어주세요. 무언가 반짝였다던가 이런 내용은 너무 진부하니 삼가세요. 제발 다양하게 생각해 본 후 그 리스트에서 하나만 딱 뽑아서 말을 거세요. 그리고 너무 길지 않게 말하도록 주의
    `);
    const triggerLine = result.response.text();

    res.json({ triggerLine });
  } catch (err) {
    console.error(`[트리거 생성 오류]`, err);
    res.status(500).json({ error: '트리거 생성 실패' });
  }
};
