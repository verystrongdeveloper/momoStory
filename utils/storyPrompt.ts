import { CHARACTERS } from '@/constants/characters';
import { bgMap, emotionMap, expressionMap, musicMap, sfxMap } from '@/constants/eventAssets';

const join = (items: string[]) => items.join(', ');

function emotionFile(key: string) {
  return key.startsWith('hina_') ? `${key}.jpg` : `${key}.png`;
}

function emotionLines() {
  const groups = new Map<string, string[]>();
  for (const key of Object.keys(emotionMap)) {
    const owner = key.split('_')[0];
    const list = groups.get(owner) ?? [];
    list.push(emotionFile(key));
    groups.set(owner, list);
  }
  return [...groups.entries()].map(([owner, files]) => `- ${owner}: ${files.join(', ')}`).join('\n');
}

/** 다른 AI에게 붙여 넣어 이 앱용 스토리 대본을 받게 하는 프롬프트. */
export function buildStoryPrompt() {
  const names = CHARACTERS.map((character) => character.name).join(', ');
  const bgs = join(Object.keys(bgMap).map((key) => `${key}.jpg`));
  const musics = join([...Object.keys(musicMap), 'none']);
  const sounds = join(Object.keys(sfxMap));
  const expressions = join(Object.keys(expressionMap));

  return `블루 아카이브의 선생 시점 이벤트 스토리 대본만 작성한다.
설명, 인사, 마크다운, 코드블록은 넣지 않는다. 아래 형식의 대본만 출력한다. 그 텍스트를 그대로 txt로 저장해 앱에 불러온다.

[규칙]
- 첫 줄은 "타이틀 : 제목" 또는 "title : 제목". 제목 내용은 출력 언어로 쓴다.
- 캐릭터 대사는 "짧은이름 : 대사 [emotion : 파일.png, bg : BG_이름.jpg, sound : SE_이름.mp3, music : 파일.mp3, expression : 파일.png]".
- 선생의 말은 대사로 쓰지 않는다. 선생이 고르는 말은 selection만 쓴다.
- 나레이션은 "narration : 내용 [bg : BG_이름.jpg, music : 파일.mp3, sound : SE_이름.mp3]". 선생 1인칭이거나 효과음이다.
- 선택지는 "selection : (1)"선택지 A" (2)"선택지 B"". 따옴표와 번호 형식을 지킨다.
- 에셋은 반드시 이미 있는 [ ] 안에만 쓴다. 한 줄에 bg, emotion, sound, music, expression은 각각 하나만. 같은 항목을 두 번 쓰지 않는다.
- 없는 파일명은 만들지 않는다. 아래 목록의 철자와 확장자를 그대로 쓴다.
- emotion은 그 대사를 한 캐릭터의 파일만 쓴다.
- 시작할 때 bg와 music을 하나씩 지정한다. 음악을 끄려면 music : none.
- 장면이 끝나면 deleteAll. 그 다음, 이번 이야기에서 실제로 있었던 일을 선생이 나중에 돌아보는 과거형 나레이션 한 줄만 쓰고 endEvent. 그 줄에는 괄호, bg, 대사, emotion, music을 넣지 않는다.
- 대본에 쓸 수 있는 명령은 deleteEmotion, deleteAll, waitSecond = 숫자, endEvent.
- 캐릭터는 짧은 이름만 쓴다. 선생은 선배나 님 없이 이름만 부른다.
- 소속·직책은 앱이 이름에 따라 자동 표시한다. 화자 이름이나 speaker 메타데이터에 소속·직책을 괄호로 붙이지 않는다.
- 등장시킬 학생: ${names}
- 대사 화자는 위 학생만 쓴다. 그 외 이름은 화자도, 현장에 있는 인물도 되지 않는다.

[형식 예시]
타이틀 : 잠자는 고래
호시노 : 그러니까 고래는 잘 때도 숨을 참고 있다는 얘기잖아. [emotion : hoshino_laugh.png, bg : BG_AbydosCouncilRoom.jpg, music : Aira.mp3]
selection : (1)"갑자기 웬 고래 얘기?" (2)"도움이 필요하다는 건 뭐야?"
호시노 : 아아. 낭만이 없구만, 선생도. [emotion : hoshino_teasing_smile.png]
deleteAll
narration : 결국 호시노의 낮잠 자리를 봐 주고 말았다.
endEvent

[배경 bg]
${bgs}

[음악 music]
${musics}

[효과음 sound]
${sounds}

[연출 expression]
${expressions}

[표정 emotion]
${emotionLines()}`;
}
