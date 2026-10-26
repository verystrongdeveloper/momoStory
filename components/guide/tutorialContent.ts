import type { AppLanguage } from '@/storage/types';

export type TutorialPage = { id: string; title: string; paragraphs: string[]; aiStudio?: boolean };
const content: Record<AppLanguage, TutorialPage[]> = {
  ko: [
    { id: 'welcome', title: 'MomoStory', paragraphs: [
      '블루 아카이브 캐릭터와 대화하고, 그 대화를 바탕으로 인연 스토리를 만드는 비공식 팬 프로그램입니다. AI가 만든 내용은 공식 설정과 다를 수 있습니다.',
      '아카이브에서 다른 사람의 스토리를 감상할 수도 있습니다. 감상에는 Gemini API 키가 필요하지 않으며, 새 대화와 스토리를 생성할 때만 본인의 키를 사용합니다.',
    ] },
    { id: 'api', title: 'Gemini API 키 발급', aiStudio: true, paragraphs: [
      '1. 아래 버튼으로 Google AI Studio를 열고 본인 Google 계정으로 로그인합니다.',
      '2. API 키를 생성하고 복사합니다. 필요한 프로젝트 설정과 이용 가능 여부는 Google의 안내를 따르세요.',
      '키는 비밀번호와 같습니다. 다른 사람에게 보내거나 채팅·댓글·공개 대본에 붙여 넣지 마세요. API 사용량과 비용은 본인 Google 계정에 적용됩니다.',
    ] },
    { id: 'key', title: "키와 AI 설정", paragraphs: [
      "톱니바퀴 설정 → AI 및 대화 → Gemini API 키에 붙여 넣고 저장합니다. 좁은 화면에서는 설정 아이콘이 아래쪽에 있습니다.",
      "API 키 기억하기를 켜면 이 기기에 저장하고, 끄면 이번 실행에서만 사용합니다. 프로그램에 공용 Gemini 키가 포함되어 있지는 않습니다.",
      "같은 AI 및 대화 화면에서 Gemini 모델과 선생 모드도 고릅니다. 모델 변경은 다음 요청부터, 순한맛·매운맛 변경은 다음 스토리 생성부터 적용됩니다.",
    ] },
    { id: 'chat', title: '캐릭터와 대화하기', paragraphs: [
      '사람 아이콘에서 상대를 고르고 메시지를 입력한 뒤 보내기를 누릅니다. 먼저 말 걸기를 켜면 방에 들어갈 때 캐릭터가 먼저 말을 겁니다.',
      '인연스토리 채팅방에서는 메시지와 캐릭터 응답이 한 쌍 이상 완성되면 스토리 생성 버튼으로 현재 대화를 바탕으로 스토리를 만들고 라이브러리에 저장할 수 있습니다. 먼저 말 걸기의 첫 인사만으로는 생성할 수 없습니다. 대화 횟수 제한 없이 원하는 시점에 생성할 수 있으며, 스토리를 생성하거나 감상한 뒤에도 기존 대화를 이어가고 누적된 대화로 새 스토리를 다시 생성할 수 있습니다.',
    ] },
    { id: 'story', title: '인연 스토리 진행', paragraphs: [
      '대화창뿐 아니라 화면의 빈 곳을 눌러도 진행됩니다. PC·웹에서는 스페이스도 사용할 수 있습니다. 글자가 나오는 중이면 먼저 문장을 완성하고, 다시 누르면 다음으로 넘어갑니다.',
      '선택지는 원하는 항목을 누르거나 PC·웹에서 맨 위부터 숫자키 1~9로 고릅니다. 일반 재생의 AUTO도 선택지에서는 멈춥니다. 선택할 때는 설정에서 고른 채팅 효과음이 재생됩니다.',
      '배경이 바뀌면 페이드 전환 중 대화창과 선택지가 잠시 숨겨집니다. 화면의 볼륨 메뉴에서 BGM·효과음을 조절할 수 있습니다.',
    ] },
    { id: 'library', title: '라이브러리와 저장된 대화', paragraphs: [
      '책 아이콘이 라이브러리입니다. 검색 범위를 제목 또는 내용으로 골라 저장된 스토리를 찾을 수 있습니다.',
      '카드 하나가 독립된 채팅방입니다. 대화 뒤에 인연 스토리로 버튼이 나타나고, 그 아래로 다음 대화가 이어집니다. 새 스토리를 생성하면 해당 위치에 버튼이 추가되며, 버튼 옆의 …에서 수정·추출·공개할 수 있습니다.',
      '카드의 … 메뉴에서 대본 수정·텍스트 추출·영상 추출·아카이브 공개·삭제를 할 수 있습니다. 저장된 채팅이 없는 스토리도 재생할 수 있습니다.',
      '프롬프트 복사는 대본 작성 안내를 복사합니다. 불러오기는 텍스트 파일을 가져오며, 새로 만들기는 빈 대본 편집기를 엽니다.',
    ] },
    { id: 'editor', title: '대본 편집과 오류 확인', paragraphs: [
      '채팅방 수정에서 방 제목을 바꾸고 대화 사이의 인연 스토리 버튼을 눌러 해당 대본을 수정합니다. 현재 대화와 각 스토리 대본을 편집하며, 수정은 이후 채팅과 스토리 생성에 반영됩니다. 편집기는 스토리 수정과 채팅 편집 탭으로 나뉩니다. 채팅 편집에서 메시지 내용·발신자·순서·프로필 표시를 바꾸고 메시지를 추가·삭제할 수 있습니다. 저장은 두 탭의 수정 내용을 함께 반영하며, 취소하면 반영하지 않습니다.',
      '대본을 쓰면 자동으로 형식을 검사합니다. 웹·PC에서는 잘못된 줄에 빨간 물결 밑줄이 표시됩니다. 모바일은 오류 목록을 눌러 해당 줄을 선택할 수 있습니다. 줄 번호는 빈 줄을 포함합니다.',
      '첫 줄은 타이틀 : 제목 또는 title : 제목, 마지막 줄은 endEvent를 사용합니다. 대기는 waitSecond : 2와 waitSecond = 2를 모두 지원합니다.',
      '사용 가능 에셋에서 파일명을 확인하세요. 에셋 삽입은 커서가 [ ] 안에 있을 때만 되며 같은 키는 교체됩니다. 오류가 있어도 로컬 저장은 가능하지만, 공개할 때는 서버가 다시 검사합니다.',
    ] },
    { id: 'video', title: 'MP4 영상 추출', paragraphs: [
      '라이브러리 카드의 … → 영상 추출에서 16:9 또는 9:16을 선택하고, 채팅 포함 또는 스토리만 추출을 고릅니다. 최대 10분까지 지원합니다.',
      '영상은 자동 진행하며 선택지는 첫 번째 항목을 자동 선택합니다. 스토리 연출과 배경 전환, BGM·효과음 및 선택지 확인음도 반영합니다. 선택한 채팅 효과음과 현재 볼륨을 사용합니다.',
      '저장 위치 선택을 지원하는 PC 환경에서는 위치와 파일명을 먼저 지정한 뒤 영상을 만듭니다. 지원하지 않는 브라우저는 최신 Chrome·Edge 또는 Windows 프로그램을 사용하세요.',
      'Android 영상 저장은 APK 전용입니다. Expo Go에서는 저장할 수 없습니다. 추출이 끝날 때까지 화면을 열어 두세요.',
    ] },
    { id: 'community', title: '아카이브 감상과 좋아요', paragraphs: [
      '여러 사람 아이콘을 누르면 아카이브가 열립니다. 전체 스토리와 좋아요한 스토리를 전환하고 제목 검색, 최신순·인기순 정렬을 사용할 수 있습니다.',
      '인기순에서 전체 기간·일간·주간·월간·연간을 선택합니다. 게시일이 아닌 해당 기간에 받은 현재 유효한 좋아요 수로 집계하며, 한국 시간 기준 오늘·이번 주 월요일부터·이번 달·올해를 뜻합니다.',
      '게시글의 채팅·스토리 감상을 누르면 읽기 전용 대화와 스토리를 재생합니다. 좋아요를 누르면 좋아요한 스토리 목록에서 다시 찾을 수 있고, 다시 누르면 취소됩니다.',
      '댓글을 작성하거나 본인 댓글·게시글을 삭제할 수 있습니다. 문제가 있는 게시글은 신고하세요. 조회수는 같은 익명 사용자당 한국 날짜 기준 하루 한 번 집계합니다.',
    ] },
    { id: 'publish', title: '스토리 공개와 개인정보', paragraphs: [
      '라이브러리 카드의 … → 공개하기에서 채팅 + 인연스토리 또는 인연스토리만을 고른 뒤 내용을 확인하고 게시합니다. 인연스토리만을 고르면 채팅은 공개하지 않고 내 라이브러리에 그대로 남습니다. 공개되는 제목·대본·선택한 채팅에 개인정보나 키가 들어 있지 않은지 꼭 확인하세요.',
      '가입·닉네임 입력 화면은 없습니다. 앱 내부의 익명 세션으로 좋아요 목록과 본인 게시물 관리 권한을 구분합니다. 기기 변경·앱 데이터 삭제·브라우저 저장 데이터 삭제 시 이 기록과 권한은 복구할 수 없습니다.',
      '라이브러리를 수정해도 게시글은 자동으로 바뀌지 않습니다. 같은 라이브러리 카드를 다시 공개하면 기존 게시글의 제목·대본·선택한 채팅을 업데이트하며 좋아요·댓글·조회수와 최초 공개일은 유지합니다. 스토리만 공개를 고르면 기존 공개 채팅도 제거합니다. 공개와 업데이트는 합계 하루 5회, 1분 간격입니다.',
    ] },
    { id: 'limits', title: '공개·댓글 제한', paragraphs: [
      '한국 시간 자정 기준 익명 사용자당 공개는 하루 5개, 댓글은 하루 10개입니다. 공개 간격은 1분, 댓글 간격은 10초이며 삭제해도 당일 작성 횟수는 돌아오지 않습니다.',
      '댓글은 공백 포함 1~300자이며 빈 댓글은 허용하지 않습니다. 게시글 제목은 100자 이하, 대본과 채팅은 합계 5만 자·UTF-8 200KB 이하입니다.',
      '해석할 수 없는 대본, 지원하지 않는 화자·에셋, 잘못된 선택지·명령, 과도하게 긴 내용은 공개할 수 없습니다. 오류가 뜨면 라이브러리 편집기의 오류 목록을 확인하세요.',
      '아카이브 서버가 연결되지 않았다는 안내가 나오면 운영자의 서버 설정이 필요합니다. 개인 Gemini 키를 입력해서 해결하는 문제가 아닙니다.',
    ] },
    { id: 'settings', title: "설정 목록과 세부 화면", paragraphs: [
      "설정을 열면 알림·화면·사운드·AI 및 대화·언어·안내·앱 정보 및 업데이트 목록이 나옵니다. 원하는 항목을 눌러 그 안에서 설정을 조작합니다. 상단 뒤로가기나 Android 뒤로가기 버튼으로 목록에 돌아옵니다.",
      "설정 → 언어에서 표시 언어를 바꿉니다. UI와 새로 생성하는 채팅·스토리의 제목·이름·소속·대사에 적용되며, 기존 저장본이나 공개된 스토리는 자동 번역하지 않습니다.",
      "설정 → 알림에서 채팅·스토리 생성·영상 추출 완료 알림과 내용 미리보기를 조절합니다. 기기에서 알림 권한을 허용해야 받을 수 있습니다.",
      "설정 → 앱 정보 및 업데이트에서 현재 버전을 확인하고 업데이트를 확인합니다. 사용 방법과 이용 약관은 설정 → 안내에서 다시 열 수 있습니다.",
    ] },
    { id: 'display', title: "화면 방향과 채팅 크기", paragraphs: [
      "휴대폰 앱은 기본적으로 세로 고정입니다. 설정 → 화면 → 화면 방향에서 세로 또는 가로를 직접 선택합니다. 기기를 돌려도 선택한 방향을 유지하며 앱과 스토리에 바로 적용되고 자동 저장됩니다. 화면 방향 선택은 Android·iOS 앱에서만 표시됩니다.",
      "설정 → 화면 → 채팅 크기에서 80~150%로 조절하고 미리보기로 확인합니다. 일반 채팅과 저장된 대화에 적용되며 자동 저장됩니다. 기본 크기를 누르면 100%로 돌아갑니다.",
    ] },
    { id: 'sound', title: "사운드와 채팅 효과음", paragraphs: [
      "설정 → 사운드에서 BGM·효과음 볼륨을 조절하고 채팅 효과음 5종 또는 사용 안 함을 고릅니다. 미리듣기는 음소거 상태에서도 기본 볼륨으로 재생됩니다.",
      "선택한 소리는 채팅·스토리 선택지·영상 추출에 적용됩니다. 스토리 안에서 바꾼 BGM·효과음 볼륨도 이 설정과 공유합니다.",
    ] },
  ],
  en: [
    { id: 'welcome', title: 'MomoStory', paragraphs: ['An unofficial fan app for chatting with Blue Archive characters and creating bond stories from your conversations. AI-generated content may differ from the official setting.', 'You can also watch stories in the archive without a Gemini API key. Your own key is required only to generate new chats and stories.'] },
    { id: 'api', title: 'Get a Gemini API key', aiStudio: true, paragraphs: ['1. Open Google AI Studio below and sign in with your own Google account.', '2. Create and copy an API key. Follow Google’s instructions for project requirements and availability.', 'Treat your key like a password. Never send it to others or paste it into chats, comments or public scripts. API usage and charges apply to your Google account.'] },
    { id: 'key', title: "Key and AI settings", paragraphs: [
      "Open the gear-shaped Settings icon → AI & conversations → Gemini API key, paste your key, and save. On narrow screens, Settings is in the bottom navigation.",
      "Remember API key keeps it on this device. Turn it off to use it only for the current session. The app does not include a shared Gemini key.",
      "Choose Gemini model and Sensei mode on the same AI & conversations screen. Model changes apply to the next request; Mild/Spicy changes apply to the next story generation.",
    ] },
    { id: 'chat', title: 'Chat with a character', paragraphs: ['Use the person icon to choose a character, enter a message and send. Enable Greet first to let the character start when you enter.', 'In Bond story chat, Create story becomes available after at least one completed message and character reply. It creates a story from the current conversation and saves it to your library. The initial greeting alone does not count. Chat without an exchange limit and generate whenever you want. After generating or watching a story, continue the same conversation and generate more stories from the accumulated chat.'] },
    { id: 'story', title: 'Play a bond story', paragraphs: ['Tap the dialogue or an empty part of the screen. On PC and web, Space works too. While text is appearing, the first tap completes it; the next advances.', 'Choose options yourself. Normal playback’s AUTO stops at choices. Selecting an option plays your selected chat sound.', 'Background changes fade between scenes, briefly hiding dialogue and choices. Use the in-story volume menu for music and effects.'] },
    { id: 'library', title: 'Library and saved chat', paragraphs: ['The book icon opens your library. Select title or content as the search scope.', 'Each card is an independent chat room. A bond story button appears after its conversation, with more chat continuing below. Generate another story to add its button at that point. The menu beside each button offers editing, export and publishing.', 'The card’s … menu offers script editing, text export, video export, publishing and deletion.', 'Copy prompt copies script-writing instructions. Import opens a text file. New opens a blank script editor.'] },
    { id: 'editor', title: 'Edit and check a script', paragraphs: ['Switch between Edit story and Edit chat. In Edit chat, change message text, senders, order and profile visibility, or add and delete messages. Save applies both drafts together; Cancel discards changes.', 'Scripts are checked automatically. Web and PC show red wavy underlines on incorrect lines. On mobile, select an error in the list to select that line. Line numbers include blank lines.', 'Start with 타이틀 : Title or title : Title and finish with endEvent. Both waitSecond : 2 and waitSecond = 2 work.', 'Check filenames in available assets. Insertion requires the cursor inside [ ]; existing keys are replaced. You may save an invalid script locally, but the server checks it again before publishing.'] },
    { id: 'video', title: 'Export MP4 video', paragraphs: ['Use a library card’s … → Video export. Choose 16:9 or 9:16, and include chat or export the story only. The maximum is 10 minutes.', 'Video playback is automatic and chooses the first option. Story effects, background transitions, music, effects and choice confirmation sounds are included using your selected chat sound and current volumes.', 'Supported PC environments ask for a filename and destination before rendering. If unsupported, use a current Chrome/Edge browser or the Windows app.', 'Android video saving requires the APK, not Expo Go. Keep the export screen open until it finishes.'] },
    { id: 'community', title: 'Archive and liked stories', paragraphs: ['The people icon opens the archive. Switch between All and Liked stories, search titles, and sort by latest or popularity.', 'Popularity supports all-time, daily, weekly, monthly and yearly periods. It counts currently active likes received during that period, not the post date. Periods use Korea time: today, this week from Monday, this month, or this year.', 'Watch chat & story opens read-only messages and story playback. Like a post to find it later in Liked stories; press again to unlike.', 'Write comments, delete your own comments/posts, and report problematic posts. Views count once per anonymous user per Korean calendar day.'] },
    { id: 'publish', title: 'Publish and protect your privacy', paragraphs: ['Choose … → Publish on a library card, then select Chat + bond story or Bond story only. Review the selected content before confirming. Story-only publishing excludes chat while keeping it in your library. Check the public title, script and any included chat for personal information or API keys.', 'There is no registration or nickname form. An internal anonymous session identifies your likes and ownership. Switching devices, clearing app data or deleting browser storage loses that identity; it cannot be recovered.', 'Local edits alone do not change the public post. Publish the same library card again to update its title, script and selected chat while preserving likes, comments, views and the original publication date. Choosing Story only removes previously public chat. Publications and updates share a limit of 5 per day, one minute apart.'] },
    { id: 'limits', title: 'Posting and comment limits', paragraphs: ['Each anonymous user may publish 5 posts and 10 comments per Korean calendar day, resetting at midnight. Wait 1 minute between posts and 10 seconds between comments. Deleting does not refund your daily quota.', 'Comments must contain 1–300 characters including spaces; empty comments are rejected. Titles are up to 100 characters. Script plus chat must fit within 50,000 characters and 200KB of UTF-8 text.', 'Unparseable scripts, unsupported speakers/assets, invalid choices/commands and overly long content cannot be published. Check the script editor’s error list.', 'A archive server not connected message requires configuration by the operator. Entering a personal Gemini key does not fix it.'] },
    { id: 'settings', title: "Settings list and detail screens", paragraphs: [
      "Settings lists Notifications, Display, Sound, AI & conversations, Language, Help, and About & updates. Tap a category to adjust its settings. Use the top back arrow or Android Back to return to the list.",
      "Use Settings → Language to change the UI and newly generated chat/story titles, names, affiliations and dialogue. Saved and public stories are not automatically translated.",
      "Use Settings → Notifications for chat, story generation and video completion alerts, and content previews. Device notification permission is required to receive alerts.",
      "Check the current version and updates in Settings → About & updates. Reopen this guide and the terms in Settings → Help.",
    ] },
    { id: 'display', title: "Screen orientation and chat size", paragraphs: [
      "The phone app defaults to portrait lock. Choose Portrait or Landscape in Settings → Display → Screen orientation. Turning your phone keeps the selected orientation. It applies immediately to the app and stories and saves automatically. This control is only shown in Android and iOS apps.",
      "Use Settings → Display → Chat size to adjust to 80–150% and check the preview. It applies to normal and saved chats and saves automatically. Reset restores 100%.",
    ] },
    { id: 'sound', title: "Sound and chat effects", paragraphs: [
      "Use Settings → Sound to adjust BGM and effects volume and select one of five chat sounds or None. Preview uses a default volume even when muted.",
      "The selected sound applies to chats, story choices and video export. BGM and effects volumes are shared with the in-story volume menu.",
    ] },
  ],
  ja: [
    { id: 'welcome', title: 'MomoStory', paragraphs: ['ブルーアーカイブのキャラクターと会話し、その会話から絆ストーリーを作る非公式ファンアプリです。AIの生成内容は公式設定と異なる場合があります。', 'アーカイブのストーリー鑑賞にGemini APIキーは不要です。新しい会話やストーリーを生成するときだけ、自分のキーを使用します。'] },
    { id: 'api', title: 'Gemini APIキーの取得', aiStudio: true, paragraphs: ['1. 下のボタンでGoogle AI Studioを開き、自分のGoogleアカウントでログインします。', '2. APIキーを作成してコピーします。必要なプロジェクト設定や利用条件はGoogleの案内に従ってください。', 'キーはパスワードと同じです。他人に渡したり、会話・コメント・公開台本に貼り付けたりしないでください。使用量や料金は自分のGoogleアカウントに適用されます。'] },
    { id: 'key', title: "キーとAIの設定", paragraphs: [
      "歯車の設定 → AIと会話 → Gemini APIキーに貼り付けて保存します。狭い画面では設定は下部タブにあります。",
      "APIキーを記憶するとこの端末に保存します。オフの場合は今回の起動中のみ使用します。共用のGeminiキーは含まれていません。",
      "同じAIと会話の画面でGeminiモデルと先生モードも選べます。モデル変更は次のリクエストから、マイルド・スパイシーの変更は次のストーリー生成から適用されます。",
    ] },
    { id: 'chat', title: 'キャラクターと会話する', paragraphs: ['人のアイコンで相手を選び、メッセージを入力して送信します。先に話しかける設定をオンにすると、入室時に相手が話し始めます。', '絆ストーリーチャットでは、メッセージと相手の返答が1往復以上完了すると「ストーリー生成」で現在の会話からストーリーを作り、ライブラリに保存できます。最初の挨拶だけでは生成できません。会話回数に制限はなく、好きなタイミングで生成できます。生成や鑑賞の後も同じ会話を続け、蓄積した会話から新しいストーリーを何度でも生成できます。'] },
    { id: 'story', title: '絆ストーリーの操作', paragraphs: ['会話欄や画面の空いた場所をタップして進めます。PC・Webではスペースキーも使えます。文字表示中は全文を表示し、もう一度押すと次へ進みます。', '選択肢は自分で選びます。通常再生のAUTOも選択肢で止まります。選ぶと設定したチャット効果音が鳴ります。', '背景変更時はフェードし、切り替え中は会話欄と選択肢を一時的に隠します。音量メニューでBGMと効果音を調整できます。'] },
    { id: 'library', title: 'ライブラリと保存済み会話', paragraphs: ['本のアイコンがライブラリです。検索範囲をタイトル・内容から選べます。', 'カード1枚が独立したルームです。会話の後に絆ストーリーボタンが表示され、その下で会話が続きます。生成するたびにその位置にボタンが追加され、横のメニューから編集・出力・公開できます。', 'カードの…から編集・テキスト出力・動画出力・アーカイブ公開・削除ができます。', 'プロンプトのコピーは台本作成の案内をコピーします。読み込みはテキストファイルを取り込み、新規作成は空の編集画面を開きます。'] },
    { id: 'editor', title: '台本編集とエラー確認', paragraphs: ['ストーリー編集とチャット編集を切り替えられます。チャットでは本文・送信者・順序・プロフィール表示の変更やメッセージの追加・削除ができます。保存は両タブに反映され、キャンセルは変更を破棄します。', '台本は自動検査されます。Web・PCでは誤った行に赤い波線が出ます。モバイルではエラー一覧を押すと該当行を選択します。行番号は空行を含みます。', '最初は「타이틀 : 題名」または「title : 題名」、最後はendEventです。waitSecond : 2とwaitSecond = 2の両方に対応します。', '使用可能な素材でファイル名を確認してください。素材挿入はカーソルが[ ]内にあるときだけ可能で、同じキーは置き換えます。エラーのある台本もローカル保存できますが、公開前にサーバーが再検査します。'] },
    { id: 'video', title: 'MP4動画出力', paragraphs: ['ライブラリの…→動画出力で16:9か9:16、会話を含むかストーリーのみかを選びます。最大10分です。', '動画は自動再生し、選択肢は最初の項目を選びます。演出・背景切り替え・BGM・効果音・選択音を反映し、現在の音量と選んだチャット音を使います。', '対応するPC環境では動画生成前に保存先とファイル名を指定します。非対応の場合は最新のChrome・EdgeまたはWindowsアプリを使用してください。', 'Androidの動画保存にはAPKが必要で、Expo Goでは保存できません。完了まで画面を開いておいてください。'] },
    { id: 'community', title: 'アーカイブといいね', paragraphs: ['複数人のアイコンでアーカイブを開きます。すべて・いいねしたストーリーの切り替え、タイトル検索、新着順・人気順に対応します。', '人気順は全期間・日間・週間・月間・年間を選べます。投稿日時ではなく、その期間に受けた現在有効ないいね数で集計します。韓国時間の今日・今週月曜から・今月・今年が基準です。', 'チャット・ストーリー鑑賞は読み取り専用です。いいねした作品は専用一覧で再確認でき、もう一度押すと解除します。', 'コメント投稿、自分の投稿・コメントの削除、問題のある投稿の通報ができます。閲覧数は韓国時間の1日につき匿名ユーザーごとに1回です。'] },
    { id: 'publish', title: '公開と個人情報', paragraphs: ['ライブラリの…→公開するで「チャット＋絆ストーリー」か「絆ストーリーのみ」を選び、内容を確認して投稿します。ストーリーのみの場合、チャットは公開せずライブラリに残ります。公開するタイトル・台本・選択した会話に個人情報やキーが含まれていないか確認してください。', '登録・ニックネーム入力はありません。内部の匿名セッションでいいねと管理権限を区別します。端末変更・アプリデータ削除・ブラウザー保存データ削除後は復元できません。', 'ローカル編集だけでは公開投稿は変わりません。同じライブラリカードを再公開すると既存投稿を更新し、いいね・コメント・閲覧数・初回公開日は保持します。ストーリーのみを選ぶと以前公開した会話も削除します。公開と更新は1日合計5回、1分間隔です。'] },
    { id: 'limits', title: '投稿・コメントの制限', paragraphs: ['韓国時間の午前0時にリセットされ、匿名ユーザーごとに公開は1日5件、コメントは10件です。公開は1分、コメントは10秒間隔で、削除しても回数は戻りません。', 'コメントは空白を含め1〜300文字で、空のコメントは不可です。タイトルは100文字、台本と会話は合計5万文字・UTF-8で200KB以内です。', '解釈できない台本、未対応の話者・素材、不正な選択肢・命令、長すぎる内容は公開できません。編集画面のエラー一覧を確認してください。', 'アーカイブ未接続の場合は運営者の設定が必要です。個人のGeminiキーを入力しても解決しません。'] },
    { id: 'settings', title: "設定一覧と詳細画面", paragraphs: [
      "設定には通知・画面・サウンド・AIと会話・言語・ガイド・アプリ情報とアップデートが並びます。項目をタップして詳細を変更し、上部の戻るボタンかAndroidの戻るボタンで一覧に戻ります。",
      "設定 → 言語で表示言語を変更します。UIと新しく生成する会話やストーリーのタイトル・名前・所属・台詞に適用されます。保存済み・公開済みの作品は自動翻訳しません。",
      "設定 → 通知でチャット、ストーリー生成、動画書き出しの完了通知と内容のプレビューを調整します。受信には端末の通知権限が必要です。",
      "設定 → アプリ情報とアップデートで現在のバージョンと更新を確認できます。使い方と利用規約は設定 → ガイドから再度開けます。",
    ] },
    { id: 'display', title: "画面の向きとチャットサイズ", paragraphs: [
      "スマートフォンアプリは初期状態で縦向き固定です。設定 → 画面 → 画面の向きで縦か横を選びます。端末を回しても選んだ向きを維持し、アプリとストーリーにすぐ反映して自動保存します。この項目はAndroid・iOSアプリのみ表示されます。",
      "設定 → 画面 → チャットサイズで80～150%に調整し、プレビューで確認できます。通常と保存済みの会話に適用され、自動保存されます。初期サイズに戻すと100%になります。",
    ] },
    { id: 'sound', title: "サウンドとチャット効果音", paragraphs: [
      "設定 → サウンドでBGMと効果音の音量を調整し、5種類のチャット効果音またはオフを選べます。ミュート中でも試聴は標準音量で再生します。",
      "選んだ音はチャット・ストーリーの選択肢・動画書き出しに反映されます。ストーリー内のBGM・効果音の音量も同じ設定を共有します。",
    ] },
  ],
  zh: [
    { id: 'welcome', title: 'MomoStory', paragraphs: ['这是与《蔚蓝档案》角色聊天并根据对话生成羁绊故事的非官方同人应用。AI生成的内容可能与官方设定不同。', '观看档案馆故事不需要Gemini API密钥。只有生成新聊天和故事时才需要使用自己的密钥。'] },
    { id: 'api', title: '获取Gemini API密钥', aiStudio: true, paragraphs: ['1. 点击下方按钮打开Google AI Studio，用自己的Google账号登录。', '2. 创建并复制API密钥。所需项目配置和可用条件请遵循Google的说明。', '密钥如同密码。不要提供给他人，也不要粘贴到聊天、评论或公开剧本中。API用量及费用计入你的Google账号。'] },
    { id: 'key', title: "密钥与AI设置", paragraphs: [
      "打开齿轮设置 → AI与对话 → Gemini API密钥，粘贴后保存。窄屏的设置位于底部导航。",
      "开启记住API密钥会保存在本设备；关闭后仅本次运行有效。应用不包含公用Gemini密钥。",
      "同一AI与对话页面还可选择Gemini模型与老师模式。模型更改从下一次请求生效；温和或辛辣模式从下次生成故事起生效。",
    ] },
    { id: 'chat', title: '与角色聊天', paragraphs: ['点击人物图标选择角色，输入消息并发送。开启主动开场后，进入时角色会先说话。', '在羁绊故事聊天室中，至少完成一组消息与角色回复后，即可点击“生成故事”，根据当前对话生成故事并保存到资料库。仅有开场问候不算一组。聊天轮数不限，可自行选择生成时机。生成或看完故事后仍可继续原来的对话，并根据累积的对话再次生成新故事。'] },
    { id: 'story', title: '推进羁绊故事', paragraphs: ['点击对话框或画面空白处推进。PC和网页也支持空格键。文字显示中先补全句子，再次点击进入下一句。', '选项须自行选择，普通播放的AUTO也会在选项处暂停。选择时播放设置中的聊天音效。', '背景变化时淡出淡入，并暂时隐藏对话和选项。可在故事音量菜单中调整背景音乐及音效。'] },
    { id: 'library', title: '资料库与已保存聊天', paragraphs: ['书本图标打开资料库，可选择按标题或内容搜索。', '每张卡片都是独立聊天室。对话后出现羁绊故事按钮，后续聊天显示在按钮下方。每次生成新故事，按钮都保留在当时的位置，旁边的菜单可编辑、导出或发布。', '卡片的…菜单提供剧本编辑、文本导出、视频导出、档案馆发布和删除。', '复制提示词用于获取剧本创作说明；导入用于读取文本文件；新建打开空白编辑器。'] },
    { id: 'editor', title: '编辑剧本与检查错误', paragraphs: ['编辑器分为故事编辑与聊天编辑。在聊天编辑中可以修改内容、发送者、顺序及头像显示，并添加或删除消息。保存同时应用两个标签页的修改，取消则放弃修改。', '剧本自动检查格式。网页和PC用红色波浪线标记错误行；移动端点击错误列表可选择对应行。行号包含空行。', '首行为“타이틀 : 标题”或“title : 标题”，末行为endEvent。支持waitSecond : 2和waitSecond = 2。', '请在可用资源中确认文件名。光标位于[ ]内时才能插入资源，相同键会被替换。错误剧本可以本地保存，但公开前服务器会再次验证。'] },
    { id: 'video', title: '导出MP4视频', paragraphs: ['在资料库卡片的…→视频导出中选择16:9或9:16，并选择包含聊天或仅故事。最多10分钟。', '视频自动播放并选择第一个选项，保留故事演出、背景切换、音乐、音效和选项确认音，使用当前音量及选定的聊天音效。', '支持的PC环境会在生成前选择文件名和保存位置。不支持时请使用最新版Chrome、Edge或Windows应用。', 'Android视频保存需要APK，Expo Go不支持。完成前请保持导出界面打开。'] },
    { id: 'community', title: '档案馆与点赞列表', paragraphs: ['多人图标打开档案馆。可切换全部与点赞的故事，搜索标题，并按最新或热门排序。', '热门支持全部时间、日榜、周榜、月榜及年榜。按该期间收到且仍有效的点赞计算，而非发帖日期。以韩国时间的今天、本周周一起、本月、本年为准。', '观看聊天与故事为只读播放。点赞后可在点赞列表中再次找到，再按一次即可取消。', '可发表评论、删除自己的帖子及评论、举报问题帖子。浏览量以韩国日期为准，每名匿名用户每天计一次。'] },
    { id: 'publish', title: '公开发布与隐私', paragraphs: ['在资料库卡片的…→公开发布中选择“聊天＋羁绊故事”或“仅羁绊故事”，确认内容后提交。仅公开故事时，聊天不会公开，仍保留在你的资料库中。请检查公开的标题、剧本和所选聊天是否包含个人信息或密钥。', '无需注册或输入昵称。应用内部的匿名会话区分点赞及管理权限。更换设备、清除应用数据或浏览器存储后无法恢复。', '仅修改本地剧本不会更新公开帖子。再次发布同一资料库卡片将更新原帖，保留点赞、评论、浏览量及首次发布日期。选择仅故事会移除之前公开的聊天。发布和更新合计每天5次，间隔1分钟。'] },
    { id: 'limits', title: '发帖与评论限制', paragraphs: ['以韩国时间午夜重置，每名匿名用户每天最多发布5篇、评论10条。发布间隔1分钟，评论间隔10秒；删除不会恢复次数。', '评论为1至300字，含空格，不允许空评论。标题最多100字；剧本与聊天合计不得超过5万字、UTF-8文本200KB。', '无法解析的剧本、不支持的角色或资源、错误选项或指令以及过长内容不能公开，请查看编辑器错误列表。', '档案馆服务器未连接需要运营者配置，输入个人Gemini密钥无法解决。'] },
    { id: 'settings', title: "设置列表与详情页面", paragraphs: [
      "设置列表包含通知、显示、声音、AI与对话、语言、帮助、应用信息与更新。点击项目后在详情页调整，通过顶部返回按钮或Android返回键回到列表。",
      "在设置 → 语言中更改界面与新生成聊天、故事的标题、姓名、所属及对话。已有保存和公开故事不会自动翻译。",
      "在设置 → 通知中调整聊天、故事生成、视频导出完成通知与内容预览。接收通知需要设备授予通知权限。",
      "在设置 → 应用信息与更新中查看当前版本并检查更新。在设置 → 帮助中重新打开使用方法与条款。",
    ] },
    { id: 'display', title: "屏幕方向与聊天大小", paragraphs: [
      "手机应用默认锁定竖屏。在设置 → 显示 → 屏幕方向中选择竖屏或横屏。转动手机时保持所选方向，立即应用于应用和剧情并自动保存。此选项仅在Android与iOS应用中显示。",
      "在设置 → 显示 → 聊天大小中调整为80至150%，并查看预览。适用于普通和已保存聊天，自动保存。恢复默认大小可回到100%。",
    ] },
    { id: 'sound', title: "声音与聊天音效", paragraphs: [
      "在设置 → 声音中调整背景音乐和音效音量，选择五种聊天音效或关闭。静音时试听仍以默认音量播放。",
      "所选声音应用于聊天、剧情选项和视频导出。剧情内背景音乐及音效音量也与此设置共用。",
    ] },
  ],
};

export function getTutorialContent(language: AppLanguage): TutorialPage[] {
  return content[language] ?? content.ko;
}
