import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { emotionMap } from '@/constants/eventAssets';
import {
  getSpriteAspectRatio,
  SPRITE_BASELINE_RATIO,
  SPRITE_HEIGHT_RATIO,
} from '@/constants/spriteLayout';
import { useLayout } from '@/hooks/useLayout';
import { expressionLayoutAt } from '@/utils/eventPresentation';

export interface SpriteAnimation {
  type: 'shake' | 'slide';
  axis: 'x' | 'y';
  distance: number;
  duration: number;
  iterations: number;
}

interface Props {
  current: string | null;
  fadeAnim: Animated.Value;
  expression?: { image: any; fadeAnim: Animated.Value } | null;
  animation?: SpriteAnimation | null;
}

/**
 * The assets are not exported on a shared canvas: some are 717x1280,
 * some are 1280x863, and NPC assets can be as small as 171x600.
 * A square `contain` box therefore makes wide assets look too small.
 * Normalize the rendered height and keep a common foot baseline instead.
 */
type SpriteSlot = { key: string; src: any } | null;

function CharacterSprite({ current, fadeAnim, expression, animation }: Props) {
  const { eventWidth, eventHeight } = useLayout();
  const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const currentRef = useRef(current);
  currentRef.current = current;
  // 두 장을 겹쳐 두고, 다음 초상이 로드된 뒤에만 보여서 교체 순간에 비지 않게 한다.
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const [slots, setSlots] = useState<[SpriteSlot, SpriteSlot]>(() => {
    const src = current ? emotionMap[current] : null;
    return [current && src ? { key: current, src } : null, null];
  });
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const shown = slots[active];
  const aspectRatio = useMemo(
    () => (shown ? getSpriteAspectRatio(shown.key, shown.src) : 1),
    [shown],
  );
  const spriteHeight = eventHeight * SPRITE_HEIGHT_RATIO;
  const spriteWidth = spriteHeight * aspectRatio;

  const styles = useMemo(
    () => makeStyles(eventWidth, eventHeight, spriteWidth, spriteHeight),
    [eventWidth, eventHeight, spriteWidth, spriteHeight],
  );

  useEffect(() => {
    if (!current) {
      activeRef.current = 0;
      setActive(0);
      setSlots([null, null]);
      return;
    }

    const prev = slotsRef.current;
    const found = prev.findIndex((slot) => slot?.key === current);
    if (found === 0 || found === 1) {
      if (activeRef.current !== found) {
        activeRef.current = found;
        setActive(found);
      }
      return;
    }

    const src = emotionMap[current];
    if (!src) return;
    const showing = prev[activeRef.current];
    const idle = showing ? (activeRef.current === 0 ? 1 : 0) : activeRef.current;
    const next: [SpriteSlot, SpriteSlot] = [prev[0], prev[1]];
    next[idle] = { key: current, src };
    setSlots(next);
    // 빈 화면의 첫 초상은 로드 이벤트를 기다리지 않는다. 기다리면 배경만 먼저 보이고 캐릭터는 다음 표정까지 안 나온다.
    if (!showing) {
      activeRef.current = idle;
      setActive(idle);
    }
  }, [current]);

  const showSlot = (index: number, key: string) => {
    if (key !== currentRef.current || activeRef.current === index) return;
    activeRef.current = index;
    setActive(index);
  };

  useEffect(() => {
    if (!animation) {
      translate.setValue({ x: 0, y: 0 });
      return;
    }

    const { type, axis, distance, duration, iterations } = animation;
    const move = (dist: number) =>
      Animated.timing(translate, {
        toValue: axis === 'x' ? { x: dist, y: 0 } : { x: 0, y: dist },
        duration,
        useNativeDriver: true,
      });
    const reset = move(0);

    const sequence: Animated.CompositeAnimation[] = [];
    if (type === 'shake') {
      for (let i = 0; i < iterations; i += 1) sequence.push(move(distance), move(-distance));
    } else {
      sequence.push(move(distance));
    }
    sequence.push(reset);

    Animated.sequence(sequence).start();
  }, [animation, translate]);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ translateX: translate.x }, { translateY: translate.y }] },
      ]}
      pointerEvents="none"
    >
      {slots.map((slot, index) =>
        slot ? (
          <Image
            key={index}
            source={slot.src}
            style={[styles.char, index === active ? styles.front : styles.back]}
            resizeMode="contain"
            fadeDuration={0}
            onLoad={() => showSlot(index, slot.key)}
          />
        ) : null,
      )}
      {expression && (
        <Animated.Image
          source={expression.image}
          style={[styles.expression, { opacity: expression.fadeAnim }]}
          resizeMode="contain"
          fadeDuration={0}
        />
      )}
    </Animated.View>
  );
}

export default React.memo(CharacterSprite);

const makeStyles = (W: number, H: number, spriteWidth: number, spriteHeight: number) => {
  const expression = expressionLayoutAt(W, H, spriteWidth, spriteHeight);
  return StyleSheet.create({
    container: {
      position: 'absolute',
      left: (W - spriteWidth) / 2,
      bottom: H * SPRITE_BASELINE_RATIO,
      width: spriteWidth,
      height: spriteHeight,
      zIndex: 2,
    },
    char: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
    },
    front: {
      opacity: 1,
      zIndex: 1,
    },
    back: {
      opacity: 0,
      zIndex: 0,
    },
    expression: {
      position: 'absolute',
      top: expression.top,
      left: expression.left,
      width: expression.size,
      height: expression.size,
      zIndex: 2,
    },
  });
};
