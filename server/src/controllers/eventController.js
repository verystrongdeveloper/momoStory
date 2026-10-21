// src/controllers/eventController.js
const { getChat, GEMINI_MODEL } = require('../services/geminiService');
const { buildSelectionPrompt } = require('../utils/selectionPromptBuilder');
const { buildEventPromptPro } = require('../utils/promptBuilderPro');
const { getDialogHistory, readKey } = require('./chatController');
const { resources } = require('../config/prompts');
const { getAvailableCharacters, hasStoryAssets, keepAssetSpeakers } = require('../utils/characterList');

const SELECTOR_SYSTEM = `너는 스토리 기획자다. 캐릭터처럼 말하지 않는다. 요청한 JSON만 출력한다. 대사·거절·설명 금지.`;
const EVENT_WRITER_SYSTEM = `너는 블루 아카이브 인연 스토리 스크립트 작성기다. 캐릭터처럼 대답하지 말고, 요청한 출력 형식 그대로 스크립트만 작성한다.`;

exports.createEvent = async (req, res) => {
  const { character } = req.body;
  const apiKey = readKey(req, res);
  if (!apiKey) return;
  if (!character) {
    return res.status(400).json({ error: 'character 누락' });
  }

  // 최근 3쌍 대화 확보
  const dialogHistory = getDialogHistory(character, apiKey);
  if (dialogHistory.length !== 3) {
    return res.status(400).json({ error: 'dialogHistory 부족(3쌍 필요)' });
  }

  try {
    /* 1) 등장 인물 선정 — 캐릭터 채팅 세션과 분리한다 */
    const selector = await getChat(character, GEMINI_MODEL, 'select', SELECTOR_SYSTEM, apiKey, req.body.language, 'bond', req.body.model);
    const selPrompt = buildSelectionPrompt(dialogHistory);
    console.log('🧠 [등장 인물 선정 프롬프트]');
    console.log(selPrompt);
    const selRes = await selector.sendMessage(selPrompt);

    // ── JSON 파싱 ────────────────────────────────────────────────────────
    // flash 모델이 ```json … ``` 로 감싸도 중괄호 블록만 추출
    const rawSelText = typeof selRes.response.text === 'function'
      ? await selRes.response.text()
      : selRes.response.text;

    console.log(`📦 [${GEMINI_MODEL} 응답]`);
    console.log(rawSelText);
    const jsonMatch = rawSelText.match(/\{[\s\S]*}/);
    let selection;
    if (!jsonMatch) {
      console.warn('[등장 인물 선정] JSON 아님, 메인 캐릭터만으로 진행');
      selection = {
        characters: [],
        reason: '선정 응답 없음',
        direction: `최근 대화를 이어 '${character}' 중심의 인연 스토리를 진행한다.`,
      };
    } else {
      selection = JSON.parse(jsonMatch[0]);
    }
    console.log('📦 [추출된 JSON]');
    console.log(selection);

    // ★ 변경된 부분: Flash 모델 응답에서 캐릭터 이름만 가져오고, emotions는 resources에서 조회
    const selectedExtraChars = selection.characters || []; // [{ name: "이름" }] 형식
    const allCharsWithEmotions = [];

    // 메인 캐릭터 추가
    allCharsWithEmotions.push({
      name: character,
      emotions: resources[character]?.emotions || []
    });

    // 선택된 추가 캐릭터들을 순회하며 emotions 정보 추가
    selectedExtraChars.forEach(selectedChar => {
      if (selectedChar.name && selectedChar.name !== character && hasStoryAssets(selectedChar.name)) {
        allCharsWithEmotions.push({
          name: selectedChar.name,
          emotions: resources[selectedChar.name].emotions,
        });
      }
    });

    console.log('✨ [Pro 모델로 전달될 캐릭터 및 이모션 목록]');
    console.log(JSON.stringify(allCharsWithEmotions, null, 2));

    /* 2) 이벤트 스크립트 생성. 채팅 세션과 섞이지 않도록 세션을 분리한다. */
    const proChat = await getChat(character, GEMINI_MODEL, 'event', EVENT_WRITER_SYSTEM, apiKey, req.body.language, 'bond', req.body.model);
    // ★ 변경: Pro 모델에게는 이제 '모든' 캐릭터(메인 + 추가)와 그들의 감정 리스트를 함께 넘겨줍니다.
    const eventPrompt = buildEventPromptPro(
      character,
      dialogHistory,
      allCharsWithEmotions, // ⬅️ 변경된 인자
      selection.direction,
    );
    const eventRes = await proChat.sendMessage(eventPrompt);

    // pro 응답 본문
    const rawScript = typeof eventRes.response.text === 'function'
      ? await eventRes.response.text()
      : eventRes.response.text;
    const script = keepAssetSpeakers(rawScript.trim(), getAvailableCharacters(), req.body.language);

    if (!script.includes('endEvent')) {
      console.warn(`[${character}] 이벤트 스크립트 형식 경고`);
    }

    return res.json({ eventScript: script, selection });
  } catch (err) {
    console.error(`[이벤트 생성 오류 - ${character}]`, err);
    return res.status(500).json({ error: '이벤트 생성 실패', detail: err.message });
  }
};
