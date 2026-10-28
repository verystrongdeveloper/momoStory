import type { AppLanguage } from '@/storage/types';

type OnboardingContent = {
  languageTitle: string;
  languageHint: string;
  continueLabel: string;
  changeLanguage: string;
  termsLead: string;
  terms: { title: string; body: string }[];
};

export const onboardingContent: Record<AppLanguage, OnboardingContent> = {
  en: {
    languageTitle: 'Choose your language',
    languageHint: 'Select the language for MomoStory. You can change it later in Settings.',
    continueLabel: 'Continue',
    changeLanguage: 'Change language',
    termsLead: 'MomoStory is an unofficial fan work based on Blue Archive by Nexon Games. Please read and agree to the following before continuing.',
    terms: [
      { title: 'Fan work', body: 'This is a non-commercial fan work. It is not an official service of Nexon or Nexon Games and is not affiliated with the developer or publisher.' },
      { title: 'Rights', body: 'The Blue Archive name, characters, images, music, and setting belong to Nexon Games and their respective rights holders.' },
      { title: 'Use', body: 'Use this program only for personal enjoyment and fan activities. Do not sell it, present it as official material, or use it commercially.' },
      { title: 'Removal', body: 'Distribution of this program and related materials may be stopped and the materials removed without notice if requested by a rights holder or if an issue arises.' },
      { title: 'API key and conversations', body: 'Choose Gemini, OpenRouter or Venice and enter your own API key for that service. Remember API key stores all service keys only on this device. Chat and story prompts are sent to the selected service. API pricing and usage limits vary by service and model.' },
      { title: 'Generated content', body: 'AI-generated dialogue and stories may differ from the official setting.' },
    ],
  },
  ko: {
    languageTitle: '언어 선택',
    languageHint: 'MomoStory에서 사용할 언어를 선택해 주세요. 나중에 설정에서 변경할 수 있습니다.',
    continueLabel: '계속',
    changeLanguage: '언어 변경',
    termsLead: 'MomoStory는 넥슨게임즈의 「블루 아카이브」를 바탕으로 한 비공식 2차 창작물입니다. 계속하려면 아래 내용을 확인하고 동의해 주세요.',
    terms: [
      { title: '2차 창작', body: '이 프로그램은 팬이 만든 비상업적 2차 창작이며, 넥슨 또는 넥슨게임즈의 공식 서비스가 아닙니다. 개발사·배급사와 관련이 없습니다.' },
      { title: '권리', body: '블루 아카이브의 명칭, 캐릭터, 이미지, 음악, 설정에 대한 권리는 넥슨게임즈와 해당 권리자에게 있습니다.' },
      { title: '이용', body: '개인적인 감상과 팬 활동으로만 이용합니다. 판매하거나, 공식 자료인 것처럼 안내하거나, 상업적으로 이용하지 않습니다.' },
      { title: '삭제', body: '권리자의 요청이 있거나 문제가 될 경우, 이 프로그램과 관련 자료는 예고 없이 배포가 중단되고 삭제될 수 있습니다.' },
      { title: 'API 키와 대화', body: 'Gemini, OpenRouter, Venice 중 사용할 서비스를 선택하고 본인의 API 키를 입력합니다. 키 기억하기를 켜면 모든 서비스의 키를 이 기기에만 저장합니다. 대화와 스토리 생성 내용은 선택한 서비스로 전송됩니다. 서비스와 모델에 따라 API 요금과 사용 한도가 다릅니다.' },
      { title: '생성된 내용', body: 'AI가 만든 대사와 스토리는 공식 설정과 다를 수 있습니다.' },
    ],
  },
  ja: {
    languageTitle: '言語を選択',
    languageHint: 'MomoStoryで使用する言語を選んでください。後から設定で変更できます。',
    continueLabel: '続ける',
    changeLanguage: '言語を変更',
    termsLead: 'MomoStoryは、ネクソンゲームズの「ブルーアーカイブ」を基にした非公式の二次創作です。続ける前に、以下を確認して同意してください。',
    terms: [
      { title: '二次創作', body: 'このプログラムはファンが制作した非営利の二次創作であり、ネクソンまたはネクソンゲームズの公式サービスではありません。開発元・販売元とは関係ありません。' },
      { title: '権利', body: 'ブルーアーカイブの名称、キャラクター、画像、音楽、設定の権利は、ネクソンゲームズおよび各権利者に帰属します。' },
      { title: '利用', body: '個人的な鑑賞やファン活動に限って利用してください。販売、公式資料と誤認させる案内、商業利用はしないでください。' },
      { title: '削除', body: '権利者からの要請や問題が生じた場合、このプログラムと関連資料は予告なく配布を停止し、削除されることがあります。' },
      { title: 'APIキーと会話', body: 'Gemini、OpenRouter、Veniceからサービスを選択し、自分のAPIキーを入力してください。キー記憶を有効にすると全サービスのキーをこの端末にのみ保存します。会話とストーリー生成内容は選択したサービスに送信されます。API料金と利用上限はサービスやモデルによって異なります。' },
      { title: '生成された内容', body: 'AIが生成した台詞やストーリーは、公式設定と異なる場合があります。' },
    ],
  },
  zh: {
    languageTitle: '选择语言',
    languageHint: '请选择 MomoStory 使用的语言。之后可以在设置中更改。',
    continueLabel: '继续',
    changeLanguage: '更改语言',
    termsLead: 'MomoStory 是基于 Nexon Games《蔚蓝档案》的非官方同人作品。继续之前，请阅读并同意以下内容。',
    terms: [
      { title: '同人作品', body: '本程序是粉丝制作的非商业同人作品，并非 Nexon 或 Nexon Games 的官方服务，与开发商或发行商无关。' },
      { title: '权利', body: '《蔚蓝档案》的名称、角色、图像、音乐及设定的权利归 Nexon Games 及相应权利人所有。' },
      { title: '使用', body: '仅限个人欣赏及粉丝活动使用。请勿出售、将其描述为官方资料或用于商业用途。' },
      { title: '删除', body: '如权利人提出要求或出现问题，本程序及相关资料可能未经预告停止分发并被删除。' },
      { title: 'API 密钥和对话', body: '选择Gemini、OpenRouter或Venice，并输入自己的API密钥。启用记住密钥后，所有服务的密钥仅保存在本设备。对话和故事生成内容会发送至所选服务。API费用和使用限额因服务和模型而异。' },
      { title: '生成的内容', body: 'AI 生成的台词及故事可能与官方设定不同。' },
    ],
  },
};
