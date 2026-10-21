const { getAvailableCharacters } = require('./characterList');
const { senseiModeGuide } = require('../senseiMode');

/**
 * @typedef {{user:string, ai:string}} DialogPair
 * @param  {DialogPair[]} dialogHistory
 * @param {'mild'|'spicy'} [senseiMode]
 * @returns {string}
 */
function buildSelectionPrompt(dialogHistory, senseiMode = 'mild') {
  const charList = getAvailableCharacters();

  const historyTXT = dialogHistory
    .map((d, i) => `(${i + 1}) 선생: "${d.user}"\n    캐릭터: "${d.ai}"`)
    .join('\n');

  return `역할극 금지. JSON 외 텍스트 금지.

${senseiModeGuide(senseiMode)}

[등장 인물 선정]
아래는 선생과 메인 캐릭터의 최근 3쌍 대화입니다.
${historyTXT}

이벤트에 등장할 추가 인물은 최대 2명. 대화에 명확한 근거가 있는 인물만 고른다.
같은 소속이라는 이유만으로 넣지 않는다. 초점은 메인 캐릭터다.
추가 인물이 없으면 characters는 빈 배열.

direction은 마지막 캐릭터 답변 이후에 벌어질 새 사건의 시놉시스 3~4문장이다.
최근 채팅은 이미 끝난 대화이므로 direction에 채팅 내용을 재연하거나 요약하지 않는다.
채팅에서 드러난 약속·부탁·궁금증·감정을 실제 행동으로 연결하고, 첫 장면의 새 상황과 이후 변화·마무리를 제안한다.
기존 질문을 다시 묻거나 이미 답한 내용을 처음부터 설명하는 전개는 피한다.

등장 가능: ${charList.join(', ') || '(없음)'}
표정 에셋이 있는 이 목록만 고른다. 목록에 없는 이름은 넣지 않는다.

출력 예시:
{"characters":[{"name":"히나"}],"reason":"대화에서 언급됨","direction":"시놉시스 3~4문장"}
`;
}

module.exports = { buildSelectionPrompt };
