import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { getAppLanguage, subscribeAppLanguage } from '@/services/appLanguage';
import type { AppLanguage } from '@/storage/types';
import { communityTranslations } from './community';
import { scriptEditorTranslations } from './scriptEditor';

type Dictionary = Record<string, string>;

const translations: Record<AppLanguage, Dictionary> = {
  ko: {
    ...communityTranslations.ko,
    ...scriptEditorTranslations.ko,
    videoChatMode: '영상에 포함할 내용', videoIncludeChat: '채팅 포함', videoExcludeChat: '스토리만', videoStoryOnlyHint: '채팅 없이 인연 스토리만 영상으로 만듭니다. 선택지는 자동 진행하며 현재 BGM·효과음 볼륨을 사용합니다.',
    chatSound: '채팅 효과음', chatSoundHint: '선택한 소리는 자동 저장되며 채팅과 영상 추출에 적용됩니다. 미리듣기는 음소거 중에도 기본 볼륨으로 재생됩니다.', previewSound: '미리듣기', previewChatSound: '{name} 미리듣기', soundPreviewFailed: '소리를 재생하지 못했습니다. 다시 시도해 주세요.', chatSound_pop: '물방울 뽁', chatSound_bloop: '전자 알림 뾰록', chatSound_bell: '맑은 벨', chatSound_click: '가벼운 톡', chatSound_soft: '부드러운 팝', chatSound_none: '사용 안 함',
    appVersion: '현재 버전',
    checkUpdate: '업데이트 확인', updateChecking: '확인 중…', updateCurrent: '최신 정식 버전 이상을 사용 중입니다.', updateAvailable: '새 버전 {version}이 있습니다.', openUpdateDownload: '다운로드 페이지', updateCheckFailed: '업데이트를 확인하지 못했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.', updateOpenFailed: '다운로드 페이지를 열지 못했습니다. 아래 주소를 이용해 주세요.',
    videoPrepareFailed: '영상에 필요한 이미지·음원·글꼴을 읽지 못했습니다. 앱을 다시 실행한 후 재시도해 주세요.',
    videoEncodeFailed: '영상 생성 중 오류가 발생했습니다. 앱을 다시 실행하고 Android System WebView를 최신 버전으로 업데이트해 주세요.',
    videoSaveFailed: '영상 파일을 저장하지 못했습니다. 저장 위치와 접근 권한, 여유 공간을 확인해 주세요.',
    videoChooseLocation: '저장 창에서 파일명과 위치를 선택해 주세요. 선택하기 전에는 영상을 생성하지 않습니다.',
    videoSavedFile: '선택한 위치에 MP4 파일을 저장했습니다.', fileSaveUnsupported: '이 브라우저는 저장 위치 선택을 지원하지 않습니다. 최신 Chrome·Edge 또는 Windows 프로그램을 사용해 주세요.',
    videoLimitHint: '최대 10분까지 추출할 수 있습니다.',
    exportVideo: '영상 추출', videoRatio: '영상 비율', videoDownload: 'MP4 다운로드', videoExportHint: '채팅과 스토리가 이어지는 영상을 만듭니다. 선택지는 첫 번째 항목을 자동 선택하며, 현재 BGM·효과음 볼륨을 사용합니다.', videoPreparing: '영상 준비 중', videoEncoding: '영상 생성 중', videoSaving: '파일 저장 중', videoKeepOpen: '완료될 때까지 이 화면을 열어 두세요.', videoSavedDownloads: '다운로드/MomoStory 폴더에 MP4를 저장했습니다. 이전 Android에서는 선택한 폴더에 저장됩니다.', videoDownloadStarted: 'MP4 파일 다운로드를 시작했습니다.', videoExportFailed: '영상을 만들거나 저장하지 못했습니다. 여유 공간을 확인하고 다시 시도해 주세요.', videoUnsupported: '이 환경은 MP4 영상 생성을 지원하지 않습니다. 최신 Chrome, Edge 또는 Android System WebView로 업데이트해 주세요.', videoNativeRebuild: '영상 저장 기능이 포함된 새 APK를 설치해 주세요.', videoTooLong: '현재 영상 추출은 10분 이하의 스토리를 지원합니다.', videoTooLarge: '영상 파일이 너무 큽니다. 대화나 대본을 줄인 후 다시 시도해 주세요.',
    storyExportFailedTitle: '추출 실패', storyExportFailed: '파일을 추출하지 못했습니다. 파일을 공유할 수 있는 앱이 설치되어 있는지 확인한 후 다시 시도해 주세요.',
    storySearchMode: '검색 범위', searchByTitle: '제목', searchByContent: '내용', storySearchPlaceholder: '검색어 입력', searchStoryTitle: '제목 검색', searchStoryContent: '내용 검색',
    searchStories: '제목이나 내용으로 검색', clearStorySearch: '검색어 지우기', noStorySearchResults: '검색 결과가 없습니다.', storySearchCount: '전체 {total}개 중 {count}개',
    chatSize: '채팅 크기', decreaseChatSize: '채팅 크기 줄이기', increaseChatSize: '채팅 크기 키우기', resetChatSize: '기본 크기', chatSizeHint: '80~150%로 조절할 수 있습니다. 일반 채팅과 저장된 대화에 적용되며 자동 저장됩니다.', chatPreviewCharacter: '선생, 오늘은 무슨 일이야?', chatPreviewUser: '잠깐 이야기하러 왔어!',
    createStory: '새로 만들기', emptyDraft: '스토리 대본을 입력해 주세요.',
    noSavedChat: '이 스토리에는 저장된 대화 내역이 없습니다.', savedChatReadOnly: '저장된 대화입니다. 메시지를 보낼 수 없습니다.', chatReplayHint: '대화를 재생하고 있습니다. 화면을 누르면 전체 대화를 표시합니다.', showAllChat: '전체 대화 보기',
    language: '언어', settings: '설정', sound: '사운드', bgm: 'BGM 볼륨', sfx: '효과음 볼륨', volumeHint: '스토리 안에서 바꾼 볼륨과 같습니다.',
    guide: '안내', howToUse: '사용 방법', terms: '이용 약관',
    apiKey: 'Gemini API 키', apiKeyPlaceholder: '본인 키를 입력하세요', save: '저장', rememberKey: 'API 키 기억하기', keySaved: '이 기기에만 저장됩니다. 다른 사람과 공유하지 마세요.', keySession: '이번 실행에서만 사용합니다.', keyRequired: '대화와 스토리 생성에 이 키를 사용합니다.',
    greetFirst: '먼저 말 걸기', greetOn: '방에 들어가면 먼저 말을 겁니다.', greetOff: '꺼 두면 먼저 말을 걸지 않습니다.', selectCharacter: '대화할 상대를 선택하세요.',
    messagePlaceholder: '메시지를 입력하세요', messageKeyRequired: '설정에서 API 키를 입력해 주세요', send: '보내기', bondEvent: '인연 이벤트', bondStory: '{name}의 인연 스토리로',
    library: '라이브러리', copyPrompt: '프롬프트 복사', load: '불러오기', editStory: '스토리 수정', assets: '사용 가능 에셋', cancel: '취소', emptyStories: '저장된 스토리가 없습니다.', storyMenu: '스토리 관리', deleteQuestion: '지울까요?', delete: '삭제', edit: '수정', export: '추출',
    promptCopied: '프롬프트를 복사했습니다.', copyFailed: '복사에 실패했습니다.', emptyFile: '파일에 대본이 없습니다.',
    assetHint: '커서 앞에 [ 가 있을 때만 넣습니다. 같은 항목이 있으면 바꿉니다.', audioHint: ' 이름에 올리면 들립니다.', searchName: '이름 검색', previewAsset: '에셋 미리보기', noBackgroundMusic: '배경 음악 없음', playingPreview: '오디오 미리보기를 재생하고 있어요.', tapOutside: '바깥을 누르면 미리보기를 닫습니다.', background: '배경', emotion: '표정', music: '음악', soundEffect: '효과음', effect: '연출',
    soundSettings: '사운드 설정', soundSettingsHint: '배경 음악과 효과음 볼륨을 조절합니다.', close: '닫기', mute: '음소거', unmute: '음소거 해제', exitEvent: '이벤트 나가기', nextLine: '다음 대사',
    termsTitle: '이용 약관', tutorialTitle: '사용 방법', agreeTerms: '위 내용을 확인했고, 이에 동의합니다.', agreeStart: '동의하고 시작', skip: '건너뛰기', previous: '이전', start: '시작하기', next: '다음', openAiStudio: 'Google AI Studio 열기',
  },
  en: {
    ...communityTranslations.en,
    ...scriptEditorTranslations.en,
    videoChatMode: 'Video content', videoIncludeChat: 'Include chat', videoExcludeChat: 'Story only', videoStoryOnlyHint: 'Export only the story without chat. Choices advance automatically. Uses your current music and effects volumes.',
    chatSound: 'Chat sound', chatSoundHint: 'Your choice is saved and used in chat and video exports. Preview uses a default volume when muted.', previewSound: 'Preview', previewChatSound: 'Preview {name}', soundPreviewFailed: 'Could not play the sound. Please try again.', chatSound_pop: 'Water drop', chatSound_bloop: 'Electronic bloop', chatSound_bell: 'Clear bell', chatSound_click: 'Light click', chatSound_soft: 'Soft pop', chatSound_none: 'Off',
    appVersion: 'App version',
    checkUpdate: 'Check for updates', updateChecking: 'Checking…', updateCurrent: 'You are running the latest stable version or newer.', updateAvailable: 'Version {version} is available.', openUpdateDownload: 'Download page', updateCheckFailed: 'Could not check for updates. Check your connection and try again.', updateOpenFailed: 'Could not open the download page. Use this address:',
    videoPrepareFailed: 'Could not read the images, audio, or font needed for the video. Restart the app and try again.',
    videoEncodeFailed: 'Video creation failed. Restart the app and update Android System WebView if applicable.',
    videoSaveFailed: 'Could not save the video file. Check the destination, permissions, and available storage.',
    videoChooseLocation: 'Choose a filename and location in the save dialog. Video creation starts only after selection.',
    videoSavedFile: 'MP4 saved to your selected location.', fileSaveUnsupported: 'This browser cannot choose a save location. Use current Chrome, Edge, or the Windows app.',
    videoLimitHint: 'Export videos up to 10 minutes long.',
    exportVideo: 'Export video', videoRatio: 'Video aspect ratio', videoDownload: 'Download MP4', videoExportHint: 'Export chat followed by the story. The first choice is selected automatically. Uses your current music and effects volumes.', videoPreparing: 'Preparing video', videoEncoding: 'Creating video', videoSaving: 'Saving file', videoKeepOpen: 'Keep this screen open until complete.', videoSavedDownloads: 'MP4 saved in Downloads/MomoStory, or your selected folder on older Android versions.', videoDownloadStarted: 'Your MP4 download has started.', videoExportFailed: 'Could not create or save the video. Check available storage and try again.', videoUnsupported: 'MP4 encoding is unavailable here. Update Chrome, Edge, or Android System WebView.', videoNativeRebuild: 'Install a new APK that includes video downloads.', videoTooLong: 'Video export currently supports stories up to 10 minutes.', videoTooLarge: 'The video is too large. Shorten the chat or script and try again.',
    storyExportFailedTitle: 'Export failed', storyExportFailed: 'Could not export the file. Check that a file-sharing app is installed, then try again.',
    storySearchMode: 'Search in', searchByTitle: 'Title', searchByContent: 'Content', storySearchPlaceholder: 'Search', searchStoryTitle: 'Search titles', searchStoryContent: 'Search content',
    searchStories: 'Search titles or content', clearStorySearch: 'Clear search', noStorySearchResults: 'No matching stories.', storySearchCount: '{count} of {total} stories',
    chatSize: 'Chat size', decreaseChatSize: 'Decrease chat size', increaseChatSize: 'Increase chat size', resetChatSize: 'Default size', chatSizeHint: 'Adjust from 80% to 150%. Applies to live and saved chats and saves automatically.', chatPreviewCharacter: 'Sensei, what brings you here today?', chatPreviewUser: 'Just came to chat!',
    createStory: 'Create new', emptyDraft: 'Enter a story script.',
    noSavedChat: 'This story has no saved chat history.', savedChatReadOnly: 'Saved conversation. Messages cannot be sent.', chatReplayHint: 'Playing conversation. Tap to show all messages.', showAllChat: 'Show all messages',
    language: 'Language', settings: 'Settings', sound: 'Sound', bgm: 'BGM volume', sfx: 'Sound effects volume', volumeHint: 'Matches the volume used in stories.',
    guide: 'Help', howToUse: 'How to use', terms: 'Terms of use',
    apiKey: 'Gemini API key', apiKeyPlaceholder: 'Enter your API key', save: 'Save', rememberKey: 'Remember API key', keySaved: 'Saved only on this device. Do not share it.', keySession: 'Used only for this session.', keyRequired: 'This key is used for chat and story generation.',
    greetFirst: 'Start the conversation', greetOn: 'The character speaks first when you enter.', greetOff: 'Characters will not speak first.', selectCharacter: 'Choose someone to chat with.',
    messagePlaceholder: 'Type a message', messageKeyRequired: 'Enter an API key in Settings', send: 'Send', bondEvent: 'Bond event', bondStory: "{name}'s bond story",
    library: 'Library', copyPrompt: 'Copy prompt', load: 'Import', editStory: 'Edit story', assets: 'Available assets', cancel: 'Cancel', emptyStories: 'No saved stories.', storyMenu: 'Manage story', deleteQuestion: 'Delete this story?', delete: 'Delete', edit: 'Edit', export: 'Export',
    promptCopied: 'Prompt copied.', copyFailed: 'Could not copy the prompt.', emptyFile: 'This file has no script.',
    assetHint: 'Insert only when the cursor follows [. Existing fields are replaced.', audioHint: ' Hover a name to listen.', searchName: 'Search names', previewAsset: 'Asset preview', noBackgroundMusic: 'No background music', playingPreview: 'Playing an audio preview.', tapOutside: 'Tap outside to close the preview.', background: 'Background', emotion: 'Expression', music: 'Music', soundEffect: 'Sound effect', effect: 'Effect',
    soundSettings: 'Sound settings', soundSettingsHint: 'Adjust background music and sound effects.', close: 'Close', mute: 'Mute', unmute: 'Unmute', exitEvent: 'Exit event', nextLine: 'Next line',
    termsTitle: 'Terms of use', tutorialTitle: 'How to use', agreeTerms: 'I have read and agree to the above.', agreeStart: 'Agree and start', skip: 'Skip', previous: 'Previous', start: 'Start', next: 'Next', openAiStudio: 'Open Google AI Studio',
  },
  ja: {
    ...communityTranslations.ja,
    ...scriptEditorTranslations.ja,
    videoChatMode: '動画に含める内容', videoIncludeChat: 'チャットを含む', videoExcludeChat: 'ストーリーのみ', videoStoryOnlyHint: 'チャットを含めずストーリーのみを書き出します。選択肢は自動進行し、現在のBGM・効果音音量を使用します。',
    chatSound: 'チャット効果音', chatSoundHint: '選択は自動保存され、チャットと動画に反映されます。試聴はミュート中でも標準音量で再生します。', previewSound: '試聴', previewChatSound: '{name}を試聴', soundPreviewFailed: '再生できませんでした。もう一度お試しください。', chatSound_pop: '水滴', chatSound_bloop: '電子通知音', chatSound_bell: '澄んだベル', chatSound_click: '軽いクリック', chatSound_soft: '柔らかいポップ', chatSound_none: '使用しない',
    appVersion: '現在のバージョン',
    checkUpdate: '更新を確認', updateChecking: '確認中…', updateCurrent: '最新の正式版以降を使用中です。', updateAvailable: '新しいバージョン {version} があります。', openUpdateDownload: 'ダウンロードページ', updateCheckFailed: '更新を確認できませんでした。接続を確認して再試行してください。', updateOpenFailed: 'ページを開けませんでした。次のURLをご利用ください。',
    videoPrepareFailed: '動画に必要な画像・音声・フォントを読み込めませんでした。アプリを再起動して再試行してください。',
    videoEncodeFailed: '動画の生成中にエラーが発生しました。アプリを再起動し、Android System WebViewを更新してください。',
    videoSaveFailed: '動画を保存できませんでした。保存先、アクセス権限、空き容量を確認してください。',
    videoChooseLocation: '保存ダイアログで名前と場所を選んでください。選択後に動画の作成を開始します。',
    videoSavedFile: '選択した場所にMP4を保存しました。', fileSaveUnsupported: 'このブラウザーでは保存先を選べません。最新のChrome・EdgeまたはWindowsアプリをご利用ください。',
    videoLimitHint: '10分以内の動画を書き出せます。',
    exportVideo: '動画を書き出す', videoRatio: '動画の縦横比', videoDownload: 'MP4をダウンロード', videoExportHint: '会話とストーリーを連続した動画にします。選択肢は最初の項目を自動選択し、現在のBGM・効果音音量を使用します。', videoPreparing: '動画を準備中', videoEncoding: '動画を作成中', videoSaving: 'ファイルを保存中', videoKeepOpen: '完了するまでこの画面を開いておいてください。', videoSavedDownloads: 'ダウンロード/MomoStoryにMP4を保存しました。旧Androidでは選択したフォルダーに保存されます。', videoDownloadStarted: 'MP4のダウンロードを開始しました。', videoExportFailed: '動画を作成または保存できませんでした。空き容量を確認して再試行してください。', videoUnsupported: 'MP4生成に未対応の環境です。Chrome、Edge、Android System WebViewを更新してください。', videoNativeRebuild: '動画保存機能を含む新しいAPKをインストールしてください。', videoTooLong: '現在の動画書き出しは10分以内に対応しています。', videoTooLarge: '動画が大きすぎます。会話や台本を短くして再試行してください。',
    storyExportFailedTitle: '書き出しに失敗', storyExportFailed: 'ファイルを書き出せませんでした。ファイルを共有できるアプリがインストールされているか確認し、もう一度お試しください。',
    storySearchMode: '検索範囲', searchByTitle: 'タイトル', searchByContent: '内容', storySearchPlaceholder: '検索語を入力', searchStoryTitle: 'タイトルを検索', searchStoryContent: '内容を検索',
    searchStories: 'タイトルや内容で検索', clearStorySearch: '検索をクリア', noStorySearchResults: '検索結果がありません。', storySearchCount: '全{total}件中{count}件',
    chatSize: 'チャットの大きさ', decreaseChatSize: 'チャットを小さくする', increaseChatSize: 'チャットを大きくする', resetChatSize: '標準サイズ', chatSizeHint: '80〜150%で調整できます。通常・保存済みの会話に適用され、自動保存されます。', chatPreviewCharacter: '先生、今日はどうしたの？', chatPreviewUser: 'ちょっと話しに来たよ！',
    createStory: '新規作成', emptyDraft: 'ストーリーの台本を入力してください。',
    noSavedChat: 'このストーリーには保存された会話がありません。', savedChatReadOnly: '保存された会話です。メッセージは送信できません。', chatReplayHint: '会話を再生中です。タップするとすべて表示します。', showAllChat: '会話をすべて表示',
    language: '言語', settings: '設定', sound: 'サウンド', bgm: 'BGM音量', sfx: '効果音の音量', volumeHint: 'ストーリー内の音量設定と共通です。',
    guide: 'ガイド', howToUse: '使い方', terms: '利用規約',
    apiKey: 'Gemini API キー', apiKeyPlaceholder: 'API キーを入力', save: '保存', rememberKey: 'API キーを記憶する', keySaved: 'この端末にのみ保存されます。共有しないでください。', keySession: '今回の実行中のみ使用します。', keyRequired: 'チャットとストーリー生成にこのキーを使います。',
    greetFirst: '先に話しかける', greetOn: '入室時にキャラクターから話しかけます。', greetOff: 'キャラクターから先に話しかけません。', selectCharacter: '会話する相手を選んでください。',
    messagePlaceholder: 'メッセージを入力', messageKeyRequired: '設定で API キーを入力してください', send: '送信', bondEvent: '絆イベント', bondStory: '{name}の絆ストーリーへ',
    library: 'ライブラリ', copyPrompt: 'プロンプトをコピー', load: '読み込む', editStory: 'ストーリーを編集', assets: '使用可能なアセット', cancel: 'キャンセル', emptyStories: '保存されたストーリーはありません。', storyMenu: 'ストーリーを管理', deleteQuestion: '削除しますか？', delete: '削除', edit: '編集', export: '書き出す',
    promptCopied: 'プロンプトをコピーしました。', copyFailed: 'コピーに失敗しました。', emptyFile: 'ファイルに台本がありません。',
    assetHint: 'カーソルの前に [ がある時だけ追加できます。同じ項目は置き換えます。', audioHint: ' 名前に重ねると再生されます。', searchName: '名前を検索', previewAsset: 'アセットプレビュー', noBackgroundMusic: 'BGMなし', playingPreview: 'オーディオプレビューを再生しています。', tapOutside: '外側をタップすると閉じます。', background: '背景', emotion: '表情', music: '音楽', soundEffect: '効果音', effect: '演出',
    soundSettings: 'サウンド設定', soundSettingsHint: 'BGMと効果音の音量を調整します。', close: '閉じる', mute: 'ミュート', unmute: 'ミュート解除', exitEvent: 'イベントを終了', nextLine: '次のセリフ',
    termsTitle: '利用規約', tutorialTitle: '使い方', agreeTerms: '上記を確認し、同意します。', agreeStart: '同意して始める', skip: 'スキップ', previous: '戻る', start: '始める', next: '次へ', openAiStudio: 'Google AI Studio を開く',
  },
  zh: {
    ...communityTranslations.zh,
    ...scriptEditorTranslations.zh,
    videoChatMode: '视频内容', videoIncludeChat: '包含聊天', videoExcludeChat: '仅故事', videoStoryOnlyHint: '仅导出故事，不包含聊天。选项自动推进，使用当前音乐和音效音量。',
    chatSound: '聊天音效', chatSoundHint: '选择将自动保存并用于聊天和视频导出。静音时试听仍使用默认音量。', previewSound: '试听', previewChatSound: '试听{name}', soundPreviewFailed: '无法播放声音，请重试。', chatSound_pop: '水滴', chatSound_bloop: '电子提示音', chatSound_bell: '清脆铃声', chatSound_click: '轻点击', chatSound_soft: '柔和气泡', chatSound_none: '关闭',
    appVersion: '当前版本',
    checkUpdate: '检查更新', updateChecking: '检查中…', updateCurrent: '您正在使用最新正式版或更新版本。', updateAvailable: '发现新版本 {version}。', openUpdateDownload: '下载页面', updateCheckFailed: '无法检查更新。请检查网络连接后重试。', updateOpenFailed: '无法打开下载页面。请使用以下地址：',
    videoPrepareFailed: '无法读取视频所需的图片、音频或字体。请重启应用后重试。',
    videoEncodeFailed: '生成视频时发生错误。请重启应用并更新Android System WebView。',
    videoSaveFailed: '无法保存视频文件。请检查保存位置、访问权限和可用空间。',
    videoChooseLocation: '请在保存窗口中选择文件名和位置。选择后才会开始生成视频。',
    videoSavedFile: 'MP4已保存到所选位置。', fileSaveUnsupported: '此浏览器不支持选择保存位置。请使用最新版Chrome、Edge或Windows应用。',
    videoLimitHint: '支持导出10分钟以内的视频。',
    exportVideo: '导出视频', videoRatio: '视频比例', videoDownload: '下载MP4', videoExportHint: '将聊天和故事连续导出为视频。自动选择第一个选项，使用当前音乐和音效音量。', videoPreparing: '准备视频', videoEncoding: '生成视频', videoSaving: '保存文件', videoKeepOpen: '请保持此页面打开，直至完成。', videoSavedDownloads: 'MP4已保存到下载/MomoStory文件夹。旧版Android保存到所选文件夹。', videoDownloadStarted: 'MP4文件已开始下载。', videoExportFailed: '无法生成或保存视频。请检查可用空间后重试。', videoUnsupported: '当前环境不支持MP4编码。请更新Chrome、Edge或Android System WebView。', videoNativeRebuild: '请安装包含视频下载功能的新APK。', videoTooLong: '目前支持导出10分钟以内的视频。', videoTooLarge: '视频文件过大。请缩短聊天或剧本后重试。',
    storyExportFailedTitle: '导出失败', storyExportFailed: '无法导出文件。请确认已安装可共享文件的应用，然后重试。',
    storySearchMode: '搜索范围', searchByTitle: '标题', searchByContent: '内容', storySearchPlaceholder: '输入关键词', searchStoryTitle: '搜索标题', searchStoryContent: '搜索内容',
    searchStories: '按标题或内容搜索', clearStorySearch: '清除搜索', noStorySearchResults: '没有搜索结果。', storySearchCount: '共{total}篇，找到{count}篇',
    chatSize: '聊天大小', decreaseChatSize: '缩小聊天', increaseChatSize: '放大聊天', resetChatSize: '默认大小', chatSizeHint: '可在80%至150%之间调整。适用于实时和已保存的对话，并自动保存。', chatPreviewCharacter: '老师，今天有什么事？', chatPreviewUser: '来聊聊天！',
    createStory: '新建', emptyDraft: '请输入故事剧本。',
    noSavedChat: '此故事没有保存的聊天记录。', savedChatReadOnly: '已保存的对话，无法发送消息。', chatReplayHint: '正在播放对话，点击屏幕显示全部消息。', showAllChat: '显示全部对话',
    language: '语言', settings: '设置', sound: '声音', bgm: '背景音乐音量', sfx: '音效音量', volumeHint: '与故事中的音量设置相同。',
    guide: '帮助', howToUse: '使用方法', terms: '使用条款',
    apiKey: 'Gemini API 密钥', apiKeyPlaceholder: '输入您的 API 密钥', save: '保存', rememberKey: '记住 API 密钥', keySaved: '仅保存在此设备上，请勿分享。', keySession: '仅在本次运行中使用。', keyRequired: '此密钥用于聊天和生成故事。',
    greetFirst: '主动开场', greetOn: '进入时角色会先开口。', greetOff: '角色不会主动开口。', selectCharacter: '请选择聊天对象。',
    messagePlaceholder: '输入消息', messageKeyRequired: '请在设置中输入 API 密钥', send: '发送', bondEvent: '羁绊事件', bondStory: '进入{name}的羁绊故事',
    library: '资料库', copyPrompt: '复制提示词', load: '导入', editStory: '编辑故事', assets: '可用资源', cancel: '取消', emptyStories: '没有已保存的故事。', storyMenu: '管理故事', deleteQuestion: '要删除吗？', delete: '删除', edit: '编辑', export: '导出',
    promptCopied: '已复制提示词。', copyFailed: '复制失败。', emptyFile: '文件中没有剧本。',
    assetHint: '只有光标前有 [ 时才能插入。相同项目会被替换。', audioHint: ' 悬停名称即可试听。', searchName: '搜索名称', previewAsset: '资源预览', noBackgroundMusic: '无背景音乐', playingPreview: '正在播放音频预览。', tapOutside: '点击外侧关闭预览。', background: '背景', emotion: '表情', music: '音乐', soundEffect: '音效', effect: '演出',
    soundSettings: '声音设置', soundSettingsHint: '调整背景音乐和音效音量。', close: '关闭', mute: '静音', unmute: '取消静音', exitEvent: '退出事件', nextLine: '下一句',
    termsTitle: '使用条款', tutorialTitle: '使用方法', agreeTerms: '我已阅读并同意以上内容。', agreeStart: '同意并开始', skip: '跳过', previous: '上一步', start: '开始', next: '下一步', openAiStudio: '打开 Google AI Studio',
  },
};

type I18nValue = { language: AppLanguage; t: (key: string, values?: Record<string, string | number>) => string };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribeAppLanguage, getAppLanguage, () => 'ko');
  const t = useCallback((key: string, values?: Record<string, string | number>) => {
    let text = translations[language][key] ?? translations.ko[key] ?? key;
    for (const [name, value] of Object.entries(values ?? {})) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  }, [language]);
  const value = useMemo(() => ({ language, t }), [language, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}
