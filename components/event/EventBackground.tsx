import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { bgMap } from '@/constants/eventAssets';

interface Props {
  bgKey: string | null;
  fadeAnim: Animated.Value;
  onReady?: (key: string) => void;
}

const sourceOf = (key: string) => bgMap[key as keyof typeof bgMap];

/**
 * 배경을 바꿀 때 이미지 주소를 같은 자리에 갈아끼우면, 새 그림이 그려지기 전에
 * 한 프레임이 비면서 검은 화면이 번쩍인다.
 * 이전 그림을 남겨 두고, 새 그림이 로드된 뒤에만 그 위로 올린다.
 */
export default function EventBackground({ bgKey, fadeAnim, onReady }: Props) {
  const [current, setCurrent] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const incomingRef = useRef<string | null>(null);

  useEffect(() => {
    incomingRef.current = next;
  }, [next]);

  useEffect(() => {
    if (!bgKey) {
      setCurrent(null);
      setNext(null);
      return;
    }
    if (bgKey === current || bgKey === next) return;
    if (!current) {
      setCurrent(bgKey);
      return;
    }
    setNext(bgKey);
  }, [bgKey, current, next]);

  const commit = (key: string) => {
    if (incomingRef.current !== key) return;
    setCurrent(key);
    setNext(null);
  };

  const currentSource = current ? sourceOf(current) : null;
  const nextSource = next ? sourceOf(next) : null;
  if (!currentSource && !nextSource) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.bg, { opacity: fadeAnim }]}>
      {current && currentSource ? (
        <Image
          key={current}
          source={currentSource}
          style={styles.fill}
          resizeMode="cover"
          fadeDuration={0}
          onLoad={() => onReady?.(current)}
          onError={() => onReady?.(current)}
        />
      ) : null}
      {next && nextSource ? (
        <Image
          key={next}
          source={nextSource}
          style={styles.fill}
          resizeMode="cover"
          fadeDuration={0}
          onLoad={() => { commit(next); onReady?.(next); }}
          onError={() => { commit(next); onReady?.(next); }}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bg: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', zIndex: 0 },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
});
