import React, { useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { avatarCropOf, avatarOf } from '@/constants/characters';

interface Props {
  characterName: string;
  source?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * 캐릭터별 확대/위치 설정으로 원본 전신 이미지를 프로필 프레임에 맞춰 보여준다.
 * offset 값은 프레임 크기에 대한 비율이므로 아바타 크기가 달라도 같은 구도를 유지한다.
 */
export default function CharacterAvatar({ characterName, source, style, onLoad, onError }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const crop = avatarCropOf(characterName);
  const image = crop.image ?? source ?? avatarOf(characterName);
  const scale = crop.scale ?? 1;
  const offsetX = (crop.offsetX ?? 0) * size.width;
  const offsetY = (crop.offsetY ?? 0) * size.height;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  if (!image) return null;

  return (
    <View
      onLayout={onLayout}
      style={[styles.frame, crop.backgroundColor ? { backgroundColor: crop.backgroundColor } : null, style]}
    >
      <View pointerEvents="none" style={[styles.offsetLayer, { transform: [{ translateX: offsetX }, { translateY: offsetY }] }]}>
        <Image source={image} resizeMode={crop.fit ?? 'cover'} onLoad={onLoad} onError={onError} style={[styles.image, { transform: [{ scale }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  offsetLayer: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
