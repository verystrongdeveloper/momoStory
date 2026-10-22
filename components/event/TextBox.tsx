import React, { forwardRef, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import EventDialogue, { DialogueHandle } from './EventDialogue';
import { EventLine } from '@/types/EventLine';
import { storyFont, useLayout } from '@/hooks/useLayout';
import { shownEventDialogue } from '@/utils/eventPresentation';

interface Props {
  currentLine: EventLine | null;
  lastSpoken: EventLine | null;
  onPress?: () => void;
}

const TextBox = forwardRef<DialogueHandle, Props>(function TextBox({ currentLine, lastSpoken, onPress }, ref) {
  const { eventWidth, eventHeight } = useLayout();
  const styles = useMemo(() => makeStyles(eventWidth, eventHeight), [eventWidth, eventHeight]);

  const shown = shownEventDialogue(currentLine, lastSpoken);

  if (!shown?.text) return null;

  return (
    <Pressable onPress={onPress} style={styles.box}>
      <LinearGradient
        colors={['rgba(4,10,24,0.18)', 'rgba(4,10,24,0.72)', 'rgba(4,10,24,0.96)']}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <EventDialogue ref={ref} character={shown.character ?? ''} text={shown.text} />
      <View style={styles.caretWrap} pointerEvents="none">
        {Platform.OS === 'web' && currentLine?.type !== 'selection' && <Text selectable={false} style={styles.spaceHint}>SPACE</Text>}
        <Text selectable={false} style={styles.caret}>▾</Text>
      </View>
    </Pressable>
  );
});

export default TextBox;

const makeStyles = (W: number, H: number) =>
  StyleSheet.create({
    box: {
      // The large advance surface is focusable on web. Its default browser
      // focus outline looked like a flashing white border above the dialogue.
      // CSS `auto` outlines may still paint at 0px in Chromium. Disable the
      // style itself; RN's native typings omit the web-only `none` value.
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' as ViewStyle['outlineStyle'], outlineWidth: 0, outlineColor: 'transparent' } : {}),
      position: 'absolute',
      bottom: 0,
      width: '100%',
      height: H * 0.35,
      paddingTop: H * 0.065,
      paddingBottom: H * 0.05,
      paddingHorizontal: W * 0.055,
      zIndex: 8,
    },
    caretWrap: {
      alignItems: 'center',
      position: 'absolute',
      right: W * 0.04,
      bottom: H * 0.04,
    },
    spaceHint: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: storyFont(W, H, 0.014, 10),
      fontWeight: '700',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.55)',
      borderRadius: 3,
      backgroundColor: 'rgba(40,61,79,0.75)',
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    caret: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: storyFont(W, H, 0.026, 16),
      fontWeight: '800',
    },
  });
