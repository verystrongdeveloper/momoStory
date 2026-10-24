import type { ImageSourcePropType } from 'react-native';
import type { AppLanguage } from '@/storage/types';

export interface Character {
  /** AI 프롬프트와 에셋 매핑에 쓰는 고정 이름 */
  name: string;
  status: string;
  displayName: Record<AppLanguage, string>;
  displayStatus: Record<AppLanguage, string>;
  image: ImageSourcePropType;
  /** 프로필 프레임 안에서 사용할 이미지와 얼굴 중심 크롭 설정 */
  avatar?: {
    image?: ImageSourcePropType;
    fit?: 'cover' | 'contain';
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    backgroundColor?: string;
  };
}

export const CHARACTERS: Character[] = [
  {
    name: '코유키',
    status: '아니 이게 제 잘못임;;?',
    displayName: { ko: '코유키', en: 'Koyuki', ja: 'コユキ', zh: '小雪' },
    displayStatus: { ko: '아니 이게 제 잘못임;;?', en: "It's my fault?!", ja: 'いや、これって私のせいですか……？', zh: '不對，這是我的錯嗎……？' },
    image: require('../assets/images/koyuki/koyuki_default.png'),
    avatar: {
      image: require('../assets/images/koyuki/koyuki_smile.png'),
      fit: 'contain',
      scale: 2.4,
      offsetY: 0.46,
      backgroundColor: '#f8e8ef',
    },
  },
  {
    name: '케이',
    status: '할 말이 있으면 말씀하세요.',
    displayName: { ko: '케이', en: 'Kei', ja: 'ケイ', zh: '凯伊' },
    displayStatus: { ko: '할 말이 있으면 말씀하세요.', en: 'If you have something to say, say it.', ja: '何かあるなら言ってください。', zh: '有什么话就直说吧。' },
    image: require('../assets/images/kei/kei_default.webp'),
    avatar: {
      image: require('../assets/images/kei/kei_default.webp'),
      fit: 'contain',
      scale: 2.4,
      offsetY: 0.46,
      backgroundColor: '#f4e8f0',
    },
  },
  {
    name: '호시노',
    status: '낮잠 중 방해금지',
    displayName: { ko: '호시노', en: 'Hoshino', ja: 'ホシノ', zh: '星野' },
    displayStatus: { ko: '낮잠 중 방해금지', en: 'Do not disturb — napping', ja: '昼寝中・起こさないで', zh: '午睡中，请勿打扰' },
    image: require('../assets/images/hoshino.jpg'),
    avatar: {
      image: require('../assets/images/hoshino/hoshino_smile.webp'),
      fit: 'contain',
      scale: 2.4,
      offsetY: 0.46,
      backgroundColor: '#f8e8eb',
    },
  },
  {
    name: '히나',
    status: '',
    displayName: { ko: '히나', en: 'Hina', ja: 'ヒナ', zh: '日奈' },
    displayStatus: { ko: '', en: '', ja: '', zh: '' },
    image: require('../assets/images/hina.jpg'),
    avatar: {
      image: require('../assets/images/hina/hina_smile.webp'),
      fit: 'contain',
      scale: 2.4,
      offsetY: 0.46,
      backgroundColor: '#eee8f1',
    },
  },
  {
    name: '마리',
    status: '늘 평안하세요',
    displayName: { ko: '마리', en: 'Mari', ja: 'マリー', zh: '玛丽' },
    displayStatus: { ko: '늘 평안하세요', en: '', ja: '', zh: '' },
    image: require('../assets/images/mari/mari_default.webp'),
    avatar: {
      image: require('../assets/images/mari/mari_smile.webp'),
      fit: 'contain',
      scale: 2.4,
      offsetY: 0.46,
      backgroundColor: '#f7e7d7',
    },
  },
  {
    name: '후부키',
    status: '커피 with 도넛!',
    displayName: { ko: '후부키', en: 'Fubuki', ja: 'フブキ', zh: '吹雪' },
    displayStatus: { ko: '커피 with 도넛!', en: 'Coffee with donuts!', ja: 'コーヒーにはドーナツ！', zh: '咖啡配甜甜圈！' },
    image: require('../assets/images/fubuki/fubuki_default.webp'),
    avatar: {
      image: require('../assets/images/fubuki/fubuki_smug.webp'),
      fit: 'contain',
      scale: 2.4,
      offsetY: 0.46,
      backgroundColor: '#e8edf7',
    },
  },
];

const byName = new Map(CHARACTERS.map((c) => [c.name, c]));

export function findCharacter(name: string): Character | undefined {
  return byName.get(name);
}

export function avatarOf(name: string): ImageSourcePropType | undefined {
  const character = byName.get(name);
  return character?.avatar?.image ?? character?.image;
}

export function avatarCropOf(name: string): NonNullable<Character['avatar']> {
  return byName.get(name)?.avatar ?? {};
}

export function displayCharacterName(name: string, language: AppLanguage): string {
  return byName.get(name)?.displayName[language] ?? name;
}
