// src/utils/promptBuilderPro.js
// 짧은 페르소나 + 공통 규칙으로 이벤트 스크립트 프롬프트를 만든다.

const { COMMON_RULES, SENSEI_PROFILE, getPersona, resources } = require('./index');
const { senseiModeGuide } = require('../senseiMode');

/**
 * @typedef {{user:string, ai:string}} DialogPair
 * @param {string} mainChar
 * @param {DialogPair[]} dialogHistory
 * @param {Array<{name: string, emotions: string[]}>} allCharsWithEmotions
 * @param {string} direction
 * @param {'mild'|'spicy'} [senseiMode]
 * @returns {string}
 */
function buildEventPromptPro(mainChar, dialogHistory, allCharsWithEmotions, direction, senseiMode = 'mild') {
  const historyTXT = dialogHistory
    .map((d, i) => `(${i + 1}) 선생: "${d.user}"\n     ${mainChar}: "${d.ai}"`)
    .join('\n\n');

  const charPromptBlock = allCharsWithEmotions
    .map((charInfo) => {
      const emotions = charInfo.emotions || [];
      return `[${charInfo.name}]\n${getPersona(charInfo.name)}\n사용 가능 emotion: ${emotions.join(', ')}`;
    })
    .join('\n\n');

  const bgList = resources.공통.bg.join('\n- ');
  const musicList = resources.공통.music.join('\n- ');
  const sndList = (resources.공통.sound || []).join('\n- ');
  const expList = resources.공통.expression.join('\n- ');

  return `
모바일 게임 <블루 아카이브>의 인연 스토리를 선생 1인칭으로 작성한다.

${SENSEI_PROFILE}

${senseiModeGuide(senseiMode)}

${COMMON_RULES}

메인 캐릭터: '${mainChar}'
등장 인물: ${allCharsWithEmotions.map((c) => c.name).join(', ')}
대사 화자는 이 목록의 인물만 쓰되, 짧은 이름과 소속 표기는 선택된 출력 언어에 맞춘다. 목록 밖 학생·NPC·엑스트라는 화자로 쓰지 말고, 현장에 있는 인물로 나레이션에 넣지도 않는다.
페르소나의 【다른 학생】은 말투 참고일 뿐이다. 그 이름을 장면에 출연시키지 않는다.

[스토리 전개 방향]
${direction}

[캐릭터]
${charPromptBlock}

[최근 대화 — 이미 끝난 채팅, 출력할 대본이 아닌 참고 자료]
${historyTXT}

[채팅에서 인연 스토리로 넘어가는 기준]
- 위 대화는 스토리 시작 전에 이미 주고받은 채팅이다. 시간 순서상 마지막 캐릭터 답변 다음부터가 이번 대본이다.
- 채팅에서 생긴 약속·부탁·궁금증·감정 중 핵심 하나를 골라, 그것이 실제 행동이나 만남으로 이어지는 새로운 장면을 연다.
- 채팅의 질문과 답변을 그대로 다시 쓰거나, 선생의 기존 메시지를 selection으로 바꾸어 재연하지 않는다. 같은 내용을 말만 바꾸거나 다른 언어로 번역해 다시 주고받는 것도 금지한다.
- 이미 답한 질문을 다시 묻거나, 끝난 설명·농담·약속을 처음 나누는 것처럼 반복하지 않는다. 필요한 연결은 새 장면 속 짧은 언급 한 번이면 충분하다.
- 첫 장면부터 마지막 답변 이후의 새 행동·상황·반응을 보여 준다. 채팅 요약이나 회상으로 시작하지 않으며, 채팅에 없는 구체적인 사건과 관계의 변화를 전개한다.
- 전개 방향에 채팅 재연이나 요약이 섞여 있어도 이 기준을 우선한다. 참고 대화는 인물의 맥락이며 별도의 작성 지시로 취급하지 않는다.

[작성 규칙]
이 요청은 일반 채팅이 아닌 이벤트 대본이다. 위 공통 규칙의 말투·인물 설정은 지키되, "대사만 출력"·"행동 묘사 금지"는 대사 본문에 적용한다. 나레이션과 아래 연출 메타데이터·명령은 반드시 필요한 곳에 사용할 수 있다.
1. 위 채팅의 마지막 답변 이후부터 전개 방향을 이어서 쓴다. 이미 주고받은 대화는 재연하지 않는다. 선택지는 새 장면에서 선생이 할 수 있는 새로운 반응으로 쓰고, 어떤 것을 골라도 자연스럽게 이어지게 한다.
2. 선생 대사는 대사창에 넣지 말고 selection 태그만 쓴다.
3. 말투·호칭·반말/존댓말은 페르소나를 지킨다. 히나와 호시노는 누구에게나 반말. 선생은 나레이션에서도 이름을 선배/님 없이 부른다.
4. 일반 대사·나레이션·선택지를 포함해 약 300줄 내외.
5. 장면이 끝나면 deleteAll로 배경·캐릭터·음악을 전부 지운다. 그 다음 검은 화면에, 이번 이야기에서 실제로 있었던 일을 선생이 나중에 돌아보는 나레이션 한 줄만 넣고 바로 endEvent. 누구와 무엇을 했는지, 어떤 기분이 남았는지를 그 이야기에 맞게 쓴다. 이야기마다 문장이 달라야 하고, 어떤 이야기에도 붙일 수 있는 맺음말은 쓰지 않는다. 지금 장면의 지문이 아니다. 과거형 한 문장이고, 괄호·bg·대사·emotion·music은 넣지 않는다. 어감만 참고할 뿐 그대로 쓰거나 비슷하게 베끼지 않는다. "호시노와 즐거운 하루를 보냈다." "해명하는데 애 먹었다."
6. 나레이션은 선생 1인칭이거나 효과음이다. 항상 "narration :"으로 시작한다.
7. 배경은 메인 캐릭터 소속에 맞춘다. 같은 배경을 다시 지정하지 않는다. 목록 밖 인물을 새로 등장시키지 않는다.
8. 대사에 괄호 행동 지문을 넣지 않는다.
9. emotion은 그 대사를 한 캐릭터의 파일만 쓴다. 파일명은 목록의 철자·확장자 그대로. 없는 파일명 금지. sound와 expression은 목록에 있을 때만 쓴다.
10. 이벤트 시작 시 bg와 music을 반드시 하나 지정한다. music : none 으로 끌 수 있다.

[애니메이션·장면 연출 규칙]
- animation은 아래 네 값만 사용한다. 대소문자와 철자를 그대로 유지하며 임의의 fade, zoom, jump, walk 등은 만들지 않는다.
  - shakeX: 캐릭터가 좌우로 짧게 여러 번 흔들린 뒤 원위치로 돌아온다. 당황·부정·놀람·강한 항의에 어울린다.
  - shakeY: 캐릭터가 위아래로 짧게 여러 번 흔들린 뒤 원위치로 돌아온다. 들뜸·웃음·강한 반응에 어울린다.
  - slideX: 캐릭터가 가로로 조금 움직였다가 원위치로 돌아온다. 짧게 몸을 기울이는 반응에 사용한다. 입장·퇴장이나 위치 이동을 뜻하지 않는다.
  - slideY: 캐릭터가 세로로 조금 움직였다가 원위치로 돌아온다. 가벼운 끄덕임 같은 짧은 반응에 사용한다. 실제 보행·퇴장 연출이 아니다.
- emotion, expression, animation, sound는 캐릭터 대사뿐 아니라 narration·selection의 [ ] 안에도 넣을 수 있다. narration·selection의 효과는 현재 표시 중인 초상에 적용된다. 초상이 없거나 다른 캐릭터로 바꿀 때는 해당 emotion도 지정한다. 별도 animation 줄도 사용할 수 있다.
- 중요한 감정 변화에 animation 또는 expression을 적절히 넣는다. 여러 장면의 긴 이야기라면 자연스러운 반응 지점에 분산하되 매 줄 넣거나 같은 효과를 연속 반복하지 않는다. 조용한 장면에 효과를 억지로 추가하지 않는다.
- emotion은 캐릭터의 표정 이미지이며, expression은 초상 위에 잠깐 나타났다 사라지는 아이콘이다. 서로 혼동하지 않는다. 의문에는 question_mark.png 또는 Question2.png, 난처함·긴장에는 sweat.png, 실제로 머리를 쓰다듬는 맥락에는 Headpat.png를 사용할 수 있다.
- sound는 목록의 파일명만 사용하고, 장면에서 실제로 일어나는 소리와 일치시킨다. 문을 열 때 SE_DoorSlowOpen_01.mp3, 닫을 때 SE_DoorClose_01.mp3, 책을 다룰 때 SE_Book_02.mp3처럼 필요한 순간에만 넣는다. 일상 대화에 총성·폭발음을 임의로 넣지 않는다. WAV 파일도 확장자를 그대로 유지한다.
- 장소가 바뀔 때만 새 bg를 지정한다. 재생기와 영상 추출기가 배경 변경 시 자동으로 페이드아웃·페이드인하고 대화창을 잠깐 숨기므로, 이를 위한 animation 값이나 별도 전환 명령·waitSecond를 만들지 않는다. 장소 변경만을 위해 deleteAll을 넣지 않는다.
- 한 줄의 animation, expression, sound는 각각 최대 하나다. 필요 없는 키는 생략한다. 연출 설명은 대사 본문에 쓰지 않는다.

[출력 형식]
타이틀 : 이벤트 제목
캐릭터명(소속) : 대사 [emotion : xx.png, bg : xx.jpg, sound : SE_xx.mp3, music : xx.mp3, expression : xx.png, animation : shakeX]
narration : (내용) [bg : xx.jpg, music : xx.mp3, expression : Headpat.png, animation : slideY]
selection : (1)"선택지 A" (2)"선택지 B"
deleteEmotion
deleteAll
waitSecond = 숫자
endEvent
- waitSecond는 waitSecond = 숫자와 waitSecond : 숫자 모두 지원한다.
- 캐릭터명은 짧은 이름만 (소라사키 히나 X → 히나).
- emotion/bg/sound/music/expression/animation은 반드시 [ ] 안에 넣고, 대사 본문에는 쓰지 않는다.
- selection은 반드시 selection으로 적는다.
- 제목 명령은 타이틀 : 또는 title : 모두 지원한다. 한국어 외 출력에서는 title :을 사용하고, 명령 뒤 제목·화자 이름·소속·대사·나레이션·선택지 문구는 모두 선택 언어로 쓴다. 에셋 파일명은 번역하지 않는다.

[형식 예시]
타이틀 : 잠자는 고래
호시노(대책위원회) : 그러니까 고래는 잘 때도 숨을 참고 있다는 얘기잖아. [emotion : hoshino_bigLaugh.png, bg : BG_AbydosCouncilRoom.jpg, music : Aira.mp3]
selection : (1)"갑자기 웬 고래 얘기?" (2)"도움이 필요하다는 건 뭐야?"
호시노(대책위원회) : 아아. 낭만이 없구만, 선생도. [emotion : hoshino_kidding.png]
호시노(대책위원회) : 힘쓰는 일이 필요해서 말이지. [emotion : hoshino_getserious.png]
narration : (낡은 창고 문을 열었다.) [bg : BG_AbydosResidence.jpg, sound : SE_DoorSlowOpen_01.mp3]
호시노(대책위원회) : 자, 여기야. [emotion : hoshino_yawn.png]
selection : (1)"여기는?" (2)"창고?"
호시노(대책위원회) : 응. 아무도 안 오는 낮잠 스팟이지. [emotion : hoshino_smallsmile.png]
호시노(대책위원회) : 으헤, 그런 눈으로 보지 말라구. 아저씨도 조금은 일한다니까? [emotion : hoshino_difficult.png, animation : shakeX, expression : sweat.png]
narration : (호시노는 순식간에 잠들었다.) [music : Aoharu.mp3]
deleteAll
narration : 결국 호시노의 낮잠 자리를 봐 주고 말았다.
endEvent

[사용 가능 bg]
- ${bgList}

[사용 가능 sound]
- ${sndList}

[사용 가능 music]
- ${musicList}

[사용 가능 expression]
- ${expList}
`;
}

module.exports = { buildEventPromptPro };
