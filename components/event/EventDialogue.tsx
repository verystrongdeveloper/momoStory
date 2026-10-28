import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { storyFont, useLayout } from '@/hooks/useLayout';
import { EVENT_TIMING, parseEventSpeaker } from '@/utils/eventPresentation';

interface Props {
  character: string;
  text: string;
}

export interface DialogueHandle {
  /** 타이핑 중이면 문장을 끝까지 보여주고 true. 이미 끝났으면 false. */
  finish: () => boolean;
}

const TYPEWRITER_MS = EVENT_TIMING.typewriter * 1000;

/** 소속은 캐릭터 이름으로 자동 매칭한다. 기존 괄호 표기도 읽을 수 있다. */
const EventDialogue = forwardRef<DialogueHandle, Props>(function EventDialogue({ character, text }, ref) {
  const { eventWidth, eventHeight } = useLayout();
  const styles = useMemo(() => makeStyles(eventWidth, eventHeight), [eventWidth, eventHeight]);
  const { name, affiliation } = parseEventSpeaker(character);

  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);

  useLayoutEffect(() => {
    shownRef.current = 0;
    setShown(0);
  }, [text]);

  useEffect(() => {
    if (shown >= text.length) return;
    const t = setTimeout(() => {
      setShown((n) => {
        if (shownRef.current >= text.length) return text.length;
        const next = Math.min(text.length, n + 1);
        shownRef.current = next;
        return next;
      });
    }, TYPEWRITER_MS);
    return () => clearTimeout(t);
  }, [shown, text]);

  useImperativeHandle(ref, () => ({
    finish() {
      if (shownRef.current >= text.length) return false;
      shownRef.current = text.length;
      setShown(text.length);
      return true;
    },
  }), [text]);

  return (
    <View style={styles.wrap}>
      {!!name && (
        <View style={styles.nameRow}>
          <Text selectable={false} style={styles.name}>{name}</Text>
          {!!affiliation && <Text selectable={false} style={styles.affiliation}>{affiliation}</Text>}
        </View>
      )}
      {!!name && <View style={styles.rule} />}
      <Text selectable={false} style={styles.text}>{text.slice(0, shown)}</Text>
    </View>
  );
});

export default EventDialogue;

const makeStyles = (W: number, H: number) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      alignItems: 'stretch',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'flex-start',
      gap: 8,
    },
    name: {
      fontSize: storyFont(W, H, 0.044, 22),
      fontWeight: '800',
      color: '#ffffff',
      letterSpacing: 0.2,
    },
    affiliation: {
      fontSize: storyFont(W, H, 0.027, 16),
      fontWeight: '800',
      color: '#6fc5ee',
    },
    rule: {
      marginTop: Math.round(H * 0.01),
      marginBottom: Math.round(H * 0.018),
      height: 1,
      width: '42%',
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.5)',
    },
    text: {
      width: '100%',
      fontSize: storyFont(W, H, 0.04, 20),
      lineHeight: storyFont(W, H, 0.056, 28),
      color: '#ffffff',
      textAlign: 'left',
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
  });
