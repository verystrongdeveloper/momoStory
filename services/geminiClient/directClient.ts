import { resources } from '../../shared/prompts';
import { buildEventPromptPro } from '../../shared/prompts/promptBuilderPro';
import { buildSelectionPrompt } from '../../shared/prompts/selectionPromptBuilder';
import { hasStoryAssets, keepAssetSpeakers, parseStorySelection } from '../../shared/prompts/characterList';
import { getGeminiKey } from '@/services/geminiKey';
import { getAppLanguage } from '@/services/appLanguage';
import { getGeminiModel } from '../geminiModel';
import { getSenseiMode } from '../senseiMode';
import { dialogKey, resetChatSessions, sendWithFallback, userApiKey } from './rest';
import type { ChatRoom } from '@/shared/chatRoom';

type DialogPair = { user: string; ai: string };

const chatLogs = new Map<string, DialogPair[]>();

const TRIGGER_MESSAGE = `
당신은 블루 아카이브 세계관의 캐릭터입니다. 선생님에게 구체적인 이유로 말을 거세요. 뭔가 재밌는 일이 터질 것 같은 내용으로 걸면 됩니다. 어떤 재밌는 일이 터질지 다양하게 생각해 본 후 말을 걸어주세요. 무언가 반짝였다던가 이런 내용은 너무 진부하니 삼가세요. 제발 다양하게 생각해 본 후 그 리스트에서 하나만 딱 뽑아서 말을 거세요. 그리고 너무 길지 않게 말하도록 주의
    `;

const SELECTOR_SYSTEM = '너는 스토리 기획자다. 캐릭터처럼 말하지 않는다. 요청한 JSON만 출력한다. 대사·거절·설명 금지.';
const EVENT_WRITER_SYSTEM = '너는 블루 아카이브 인연 스토리 스크립트 작성기다. 캐릭터처럼 대답하지 말고, 요청한 출력 형식 그대로 스크립트만 작성한다.';

function readKey(): string {
  return userApiKey(getGeminiKey());
}

function pushLog(character: string, apiKey: string, pair: DialogPair): boolean {
  const slot = dialogKey(character, apiKey);
  const log = chatLogs.get(slot) ?? [];
  log.push(pair);
  if (log.length > 3) log.shift();
  chatLogs.set(slot, log);
  return log.length >= 3;
}

export const directClient = {
  async reset(character: string, room: ChatRoom = 'bond') {
    const apiKey = readKey();
    if (!character) throw new Error('character 누락');
    resetChatSessions(character, apiKey, room);
    chatLogs.delete(dialogKey(character, apiKey, room));
  },
  async trigger(character: string, room: ChatRoom = 'bond') {
    const language = getAppLanguage();
    const apiKey = readKey();
    if (!character) throw new Error('character 누락');
    const triggerLine = await sendWithFallback(character, '', TRIGGER_MESSAGE, undefined, apiKey, language, room);
    return { triggerLine };
  },

  async chat(character: string, message: string, room: ChatRoom = 'bond') {
    const language = getAppLanguage();
    const apiKey = readKey();
    if (!character || !message) throw new Error('character 또는 message 누락');
    const reply = await sendWithFallback(character, '', message, undefined, apiKey, language, room);
    const eventReady = room === 'bond' && pushLog(character, apiKey, { user: message, ai: reply });
    return { reply, eventReady };
  },

  async createEvent(character: string) {
    const language = getAppLanguage();
    const model = getGeminiModel();
    const senseiMode = getSenseiMode();
    const apiKey = readKey();
    if (!character) throw new Error('character 누락');
    const dialogHistory = chatLogs.get(dialogKey(character, apiKey)) ?? [];
    if (dialogHistory.length !== 3) throw new Error('dialogHistory 부족(3쌍 필요)');

    const rawSelText = await sendWithFallback(character, 'select', buildSelectionPrompt(dialogHistory, senseiMode), SELECTOR_SYSTEM, apiKey, language, 'bond', model);
    const selection = parseStorySelection(character, rawSelText);

    const allCharsWithEmotions: { name: string; emotions: string[] }[] = [
      { name: character, emotions: resources[character]?.emotions ?? [] },
    ];
    for (const selectedChar of selection.characters ?? []) {
      if (selectedChar.name && selectedChar.name !== character && hasStoryAssets(selectedChar.name)) {
        allCharsWithEmotions.push({
          name: selectedChar.name,
          emotions: resources[selectedChar.name]?.emotions ?? [],
        });
      }
    }

    const eventPrompt = buildEventPromptPro(character, dialogHistory, allCharsWithEmotions, selection.direction ?? '', senseiMode);
    const script = keepAssetSpeakers(
      (await sendWithFallback(character, 'event', eventPrompt, EVENT_WRITER_SYSTEM, apiKey, language, 'bond', model)).trim(),
      allCharsWithEmotions.map(info => info.name),
      language,
    );
    return { eventScript: script };
  },
};
