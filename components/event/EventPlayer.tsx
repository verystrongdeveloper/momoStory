import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Asset } from 'expo-asset';
import { createAudioPlayer } from 'expo-audio';
import { useRouter } from 'expo-router';
import { bgMap, emotionMap, expressionMap, sfxMap } from '@/constants/eventAssets';
import { getSfxVolume } from '@/services/sfxVolume';
import { getChatSound } from '@/services/chatSound';
import { chatSoundSources } from '@/constants/chatSounds';
import { chatSoundKey } from '@/utils/chatPresentation';
import useBGM from '@/hooks/useBGM';
import useEventParser from '@/hooks/useEventParser';
import { EventFrame } from '@/hooks/useLayout';
import { EventLine } from '@/types/EventLine';
import CharacterSprite, { SpriteAnimation } from './CharacterSprite';
import EventBackground from './EventBackground';
import EventHud from './EventHud';
import EventSelection from './EventSelection';
import EventVolumeModal from './EventVolumeModal';
import TextBox from './TextBox';
import { DialogueHandle } from './EventDialogue';
import TitleBanner from './TitleBanner';
import { useI18n } from '@/i18n';
import { EVENT_TIMING } from '@/utils/eventPresentation';

interface Props {
  script: string;
}

interface Expression {
  image: any;
  fadeAnim: Animated.Value;
}

const TITLE_SHOW_MS = EVENT_TIMING.titleShow * 1000;
const TITLE_GAP_MS = EVENT_TIMING.titleGap * 1000;
const EXPRESSION_SHOW_MS = EVENT_TIMING.expressionShow * 1000;

const TYPEWRITER_MS = EVENT_TIMING.typewriter * 1000;
const AUTO_READ_MS = EVENT_TIMING.autoRead * 1000;

/** deleteAll 뒤, endEvent 직전의 나레이션. 검은 화면에 남는 선생의 한 줄. */
const isEndingCaption = (lines: EventLine[], index: number) => {
  const current = lines[index];
  const next = lines[index + 1];
  return current?.type === 'narration' && next?.type === 'command' && next.commandType === 'endEvent';
};

const EventPlayer: React.FC<Props> = ({ script }) => {
  const { t } = useI18n();
  const router = useRouter();
  const lines = useEventParser(script);
  const [idx, setIdx] = useState(0);
  const [presentedIdx, setPresentedIdx] = useState(0);
  const line = lines[presentedIdx] ?? null;
  const transitioning = idx !== presentedIdx;
  const [last, setLast] = useState<EventLine | null>(null);
  const [auto, setAuto] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [showTitle, setShowTitle] = useState(false);
  const [bg, setBg] = useState<string | null>(null);
  const bgRef = useRef<string | null>(null);
  const sceneOpacity = useRef(new Animated.Value(1)).current;
  const backgroundReady = useRef<(() => void) | null>(null);
  const [emo, setEmo] = useState<string | null>(null);
  const emoRef = useRef<string | null>(null);
  /** deleteEmotion으로 숨긴 뒤에만 투명도를 되돌린다. 대사마다 리셋하면 초상이 깜빡인다. */
  const spriteHiddenRef = useRef(false);
  const [animation, setAnimation] = useState<SpriteAnimation | null>(null);
  const [expression, setExpression] = useState<Expression | null>(null);
  const bgOpacity = useRef(new Animated.Value(1)).current;
  const emoOpacity = useRef(new Animated.Value(1)).current;
  const dialogueRef = useRef<DialogueHandle>(null);
  const chosenIndex = useRef<number | null>(null);
  const soundCleanups = useRef(new Set<() => void>());
  useEffect(() => () => {
    for (const cleanup of [...soundCleanups.current]) cleanup();
  }, []);

  const { setMusic, stop, volume, setVolume, muted, setMuted } = useBGM();
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const nextLine = () => {
    const next = idx + 1;
    if (next >= lines.length) return;
    const nextBackground = lines[next]?.bg;
    // Keep ordinary dialogue updates in one render. Delaying presentedIdx
    // for every line unmounted the entire dialogue section for one frame.
    if (!nextBackground || !bgRef.current || nextBackground === bgRef.current) {
      setPresentedIdx(next);
    }
    setIdx(next);
  };

  const goHome = () => router.replace('/');

  useEffect(() => {
    const target = lines[idx];
    if (!target?.bg || !bgRef.current || target.bg === bgRef.current) {
      setPresentedIdx(idx);
      return;
    }
    let active = true;
    const out = Animated.timing(sceneOpacity, { toValue: 0, duration: EVENT_TIMING.backgroundFade * 1000, useNativeDriver: true });
    let reveal: Animated.CompositeAnimation | undefined;
    out.start(({ finished }) => {
      if (!active || !finished) return;
      backgroundReady.current = () => {
        if (!active) return;
        backgroundReady.current = null;
        reveal = Animated.timing(sceneOpacity, { toValue: 1, duration: EVENT_TIMING.backgroundFade * 1000, useNativeDriver: true });
        reveal.start(({ finished: revealed }) => { if (active && revealed) setPresentedIdx(idx); });
      };
      setBg(target.bg!); bgRef.current = target.bg!;
      if (target.emotion) { setEmo(target.emotion); emoRef.current = target.emotion; }
    });
    return () => { active = false; backgroundReady.current = null; out.stop(); reveal?.stop(); sceneOpacity.setValue(1); };
  }, [idx, lines, sceneOpacity]);

  const onAdvance = () => {
    if (menuOpen || transitioning) return;
    // 타이핑 중이면 문장만 끝까지 보여주고, 끝난 뒤에 누르면 다음으로 넘어간다.
    if (dialogueRef.current?.finish()) return;
    if (line?.type === 'selection' && (line.options?.length ?? 0) > 0) return;
    const ended = line?.type === 'command' && line.commandType === 'endEvent';
    if (ended || isEndingCaption(lines, idx) || idx + 1 >= lines.length) {
      goHome();
      return;
    }
    nextLine();
  };

  useEffect(() => {
    // Desktop builds use the web player too; native touch playback is unchanged.
    if (typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || menuOpen) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest?.('input, textarea, select, button, a, [role="button"], [role="link"], [role="textbox"], [contenteditable="true"]')) return;
      event.preventDefault(); // Space should advance, not scroll the page.
      if (!event.repeat) onAdvance();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onAdvance, menuOpen]);

  useEffect(() => {
    if (!auto || menuOpen || transitioning) return;
    // 선택지는 사용자가 고를 때까지 멈춘다. 타이틀·명령은 자체 타이머가 넘긴다.
    if (!line || line.type === 'selection' || line.type === '타이틀' || line.type === 'command') return;
    const ending = isEndingCaption(lines, idx);
    const wait = (line.text?.length ?? 0) * TYPEWRITER_MS + AUTO_READ_MS;
    const t = setTimeout(() => {
      if (ending) goHome();
      else nextLine();
    }, wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, menuOpen, idx, line, transitioning]);

  const playSFX = (key: string) => {
    const src = sfxMap[key] ?? chatSoundSources[key];
    const soundVolume = mutedRef.current ? 0 : getSfxVolume();
    if (!src || soundVolume <= 0) return;
    let cleanup = () => {};
    try {
      const player = createAudioPlayer(src, { keepAudioSessionActive: true });
      let subscription: { remove: () => void } | undefined;
      let removed = false;
      cleanup = () => {
        if (removed) return;
        removed = true;
        soundCleanups.current.delete(cleanup);
        try { subscription?.remove(); } catch { /* already released */ }
        try { player.remove(); } catch { /* already released */ }
      };
      soundCleanups.current.add(cleanup);
      player.volume = soundVolume;
      subscription = player.addListener('playbackStatusUpdate', status => { if (status.didJustFinish) cleanup(); });
      player.play();
    } catch { cleanup(); /* A failed effect must not stop story progression. */ }
  };

  const chooseOption = (option: string) => {
    if (menuOpen || transitioning || line?.type !== 'selection' || !line.options?.includes(option) || chosenIndex.current === idx) return;
    chosenIndex.current = idx;
    const sound = getChatSound();
    if (sound !== 'none') playSFX(chatSoundKey(sound));
    nextLine();
  };

  /* 에셋 선로딩 */
  useEffect(() => {
    Asset.loadAsync([
      ...Object.values(bgMap),
      ...Object.values(emotionMap),
      ...Object.values(expressionMap),
      ...Object.values(sfxMap),
    ]);
  }, []);

  /* 언마운트 시 BGM 정리 */
  useEffect(() => () => void stop(), [stop]);

  /* 현재 라인 처리 */
  useEffect(() => {
    if (!line || transitioning) return;

    if (line.type === '타이틀') {
      setTitle(line.text ?? '');
      setShowTitle(true);
      // 사용자가 중간에 탭해서 넘어가면 타이머를 정리해 한 줄을 건너뛰지 않도록 한다.
      let gap: ReturnType<typeof setTimeout> | undefined;
      const show = setTimeout(() => {
        setShowTitle(false);
        gap = setTimeout(nextLine, TITLE_GAP_MS);
      }, TITLE_SHOW_MS);
      return () => {
        clearTimeout(show);
        if (gap) clearTimeout(gap);
        setShowTitle(false);
      };
    }

    if (line.type === 'dialogue' || line.type === 'narration') {
      setLast(line);
      if (isEndingCaption(lines, idx)) stop();
    }

    if (line.soundFile) playSFX(line.soundFile);
    if (line.bg) { setBg(line.bg); bgRef.current = line.bg; }
    if (line.emotion) {
      if (emoRef.current !== line.emotion) {
        emoRef.current = line.emotion;
        setEmo(line.emotion);
      }
      if (spriteHiddenRef.current) {
        emoOpacity.setValue(1);
        spriteHiddenRef.current = false;
      }
    }
    if (line.music !== undefined) setMusic(line.music);

    if (line.expression) {
      const image = expressionMap[line.expression];
      if (image) {
        const fadeAnim = new Animated.Value(0);
        setExpression({ image, fadeAnim });
        Animated.timing(fadeAnim, { toValue: 1, duration: EVENT_TIMING.expressionReveal * 1000, useNativeDriver: true }).start();
        setTimeout(() => {
          Animated.timing(fadeAnim, { toValue: 0, duration: EVENT_TIMING.expressionFade * 1000, useNativeDriver: true }).start(() =>
            setExpression(null),
          );
        }, EXPRESSION_SHOW_MS);
      } else {
        console.warn('[EventPlayer] expression 매핑 없음:', line.expression);
      }
    }

    if (line.type === 'animation' || line.animationType) {
      const raw = (line.animationType ?? '').toLowerCase();
      const anim: SpriteAnimation = {
        type: raw.includes('slide') ? 'slide' : 'shake',
        axis: raw.includes('x') ? 'x' : 'y',
        distance: EVENT_TIMING.motionDistance,
        duration: EVENT_TIMING.motionStep * 1000,
        iterations: EVENT_TIMING.motionIterations,
      };
      setAnimation(anim);
      setTimeout(() => setAnimation(null), anim.duration * anim.iterations * 2 + 100);
      if (line.type === 'animation') return;
    }

    if (line.type === 'command') {
      switch (line.commandType) {
        case 'waitSecond':
          setTimeout(nextLine, (line.waitSecond ?? 1) * 1000);
          return;
        case 'deleteEmotion':
          spriteHiddenRef.current = true;
          emoRef.current = null;
          Animated.timing(emoOpacity, { toValue: 0, duration: EVENT_TIMING.deleteFade * 1000, useNativeDriver: true }).start(() => {
            setEmo(null);
            nextLine();
          });
          return;
        case 'deleteAll':
          Animated.parallel([
            Animated.timing(bgOpacity, { toValue: 0, duration: EVENT_TIMING.deleteFade * 1000, useNativeDriver: true }),
            Animated.timing(emoOpacity, { toValue: 0, duration: EVENT_TIMING.deleteFade * 1000, useNativeDriver: true }),
          ]).start(() => {
            setBg(null);
            bgRef.current = null;
            setEmo(null);
            emoRef.current = null;
            spriteHiddenRef.current = false;
            setLast(null);
            bgOpacity.setValue(1);
            emoOpacity.setValue(1);
            nextLine();
          });
          return;
        case 'backgroundOnly':
          setTimeout(nextLine, 1000);
          return;
        case 'endEvent':
          setBg(null);
          bgRef.current = null;
          setEmo(null);
          emoRef.current = null;
          setLast(null);
          setShowTitle(false);
          stop();
          return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, transitioning]);

  return (
    <EventFrame>
      <View style={styles.stage}>
        <TitleBanner title={title} visible={showTitle && !transitioning} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: sceneOpacity }]}>
        <EventBackground bgKey={bg} fadeAnim={bgOpacity} onReady={(key) => { if (key === bgRef.current) backgroundReady.current?.(); }} />
        <CharacterSprite
          current={emo ?? last?.emotion ?? line?.emotion ?? null}
          fadeAnim={emoOpacity}
          expression={expression}
          animation={animation}
        />
        </Animated.View>
        <Pressable style={styles.tap} onPress={onAdvance} accessibilityLabel={t('nextLine')} />
        {!transitioning && line?.type === 'selection' && <View style={styles.selectionDim} pointerEvents="none" />}
        {!transitioning && <TextBox ref={dialogueRef} currentLine={line} lastSpoken={last} onPress={onAdvance} />}
        <EventHud auto={auto} onToggleAuto={() => setAuto((v) => !v)} onMenu={() => setMenuOpen(true)} />

        {!transitioning && line?.type === 'selection' && (
          <View pointerEvents="box-none" style={styles.selection}>
            <EventSelection options={line.options ?? []} onSelect={chooseOption} />
          </View>
        )}
        {menuOpen && (
          <EventVolumeModal
            volume={volume}
            muted={muted}
            onChange={setVolume}
            onToggleMute={() => setMuted(!muted)}
            onClose={() => setMenuOpen(false)}
            onExit={() => router.replace('/')}
          />
        )}
      </View>
    </EventFrame>
  );
};

export default EventPlayer;

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  selection: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 16,
  },
  selectionDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 13, 36, 0.24)',
    zIndex: 4,
  },
  tap: {
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as ViewStyle['outlineStyle'], outlineWidth: 0, outlineColor: 'transparent' } : {}),
    ...StyleSheet.absoluteFill,
    zIndex: 7,
  },
});
