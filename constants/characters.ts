import type { ImageSourcePropType } from 'react-native';
import type { AppLanguage } from '@/storage/types';

export interface Character {
  /** AI 프롬프트와 에셋 매핑에 쓰는 고정 이름 */
  name: string;
  status: string;
  displayName: Record<AppLanguage, string>;
  displayStatus: Record<AppLanguage, string>;
  image: ImageSourcePropType;
}

export const CHARACTERS: Character[] = [
  {
    name: '호시노',
    status: '낮잠 중 방해금지',
    displayName: { ko: '호시노', en: 'Hoshino', ja: 'ホシノ', zh: '星野' },
    displayStatus: { ko: '낮잠 중 방해금지', en: 'Do not disturb — napping', ja: '昼寝中・起こさないで', zh: '午睡中，请勿打扰' },
    image: require('../assets/images/hoshino.jpg'),
  },
  {
    name: '히나',
    status: '',
    displayName: { ko: '히나', en: 'Hina', ja: 'ヒナ', zh: '日奈' },
    displayStatus: { ko: '', en: '', ja: '', zh: '' },
    image: require('../assets/images/hina.jpg'),
  },
  {
    name: '마리',
    status: '',
    displayName: { ko: '마리', en: 'Mari', ja: 'マリー', zh: '玛丽' },
    displayStatus: { ko: '', en: '', ja: '', zh: '' },
    image: require('../assets/images/mari/mari_default.png'),
  },
];

const byName = new Map(CHARACTERS.map((c) => [c.name, c]));

export function findCharacter(name: string): Character | undefined {
  return byName.get(name);
}

export function avatarOf(name: string): ImageSourcePropType | undefined {
  return byName.get(name)?.image;
}

export function displayCharacterName(name: string, language: AppLanguage): string {
  return byName.get(name)?.displayName[language] ?? name;
}
