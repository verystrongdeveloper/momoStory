import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Button,
  AppState,
  FlatList,
  Image,
  ImageSourcePropType,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { geminiClient, geminiFailureText } from '@/services/geminiClient';
import { getGeminiKey, subscribeGeminiKey } from '@/services/geminiKey';
import { getGreetMode } from '@/services/greetMode';
import { setPendingEvent } from '@/store/eventStore';
import { saveStory, type SavedStory } from '@/store/storyLibrary';
import type { SavedChatMessage } from '@/storage/types';
import { getTemporaryChat, type TemporaryMessage } from '@/store/temporaryChats';
import { useChatSize } from '@/services/chatSize';
import { makeChatSizeStyles } from './chatSizeStyles';
import { useI18n } from '@/i18n';
import { splitChatReply } from '@/utils/splitChatReply';
import useChatPop from '@/hooks/useChatPop';
import { getIncludeBondStory, useIncludeBondStory } from '@/services/chatMode';

export type ChatRefreshAction = { onPress: () => void; disabled: boolean };

interface Props {
  characterName: string;
  displayName?: string;
  characterImage?: ImageSourcePropType;
  setGlobalLoading?: (value: boolean) => void;
  savedStory?: SavedStory;
  onRefreshActionChange?: (action: ChatRefreshAction | null) => void;
}

type Chat = TemporaryMessage;

const TYPING_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CharacterChat: React.FC<Props> = ({ characterName, displayName, characterImage, setGlobalLoading, savedStory, onRefreshActionChange }) => {
  const { t } = useI18n();
  const visibleName = displayName ?? characterName;
  const router = useRouter();
  const chatSize = useChatSize();
  const includeBondStory = useIncludeBondStory();
  const sizeStyles = useMemo(() => makeChatSizeStyles(chatSize), [chatSize]);

  const apiKey = useSyncExternalStore(subscribeGeminiKey, getGeminiKey, () => '');
  const hasKey = apiKey.trim().length > 0;
  const session = useMemo(() => getTemporaryChat(characterName, apiKey), [characterName, apiKey]);
  const draft = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { messages, input, isWaiting, eventReady, storyScript } = draft;
  const setMessages = (change: Chat[] | ((previous: Chat[]) => Chat[])) => session.update(previous => ({ messages: typeof change === 'function' ? change(previous.messages) : change }));
  const setInput = (value: string) => session.update({ input: value });
  const setEventReady = (value: boolean) => session.update({ eventReady: value });
  useFocusEffect(useCallback(() => {
    if (savedStory) return;
    let closeReader: (() => void) | undefined;
    const updateVisibility = (state: string | null) => {
      closeReader?.();
      closeReader = state === 'active' || state === null ? session.openReader() : undefined;
    };
    updateVisibility(AppState.currentState);
    const subscription = AppState.addEventListener('change', updateVisibility);
    return () => { subscription.remove(); closeReader?.(); };
  }, [session, savedStory]));
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetError, setResetError] = useState(false);
  const [replayCount, setReplayCount] = useState(1);
  const savedMessages = savedStory?.chatMessages;
  const replaying = !!savedStory && replayCount < (savedMessages?.length ?? 0);
  const shownMessages = savedStory ? (savedMessages ?? []).slice(0, replayCount) : messages;
  useChatPop(shownMessages);

  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<Chat>>(null);
  const setWaiting = (value: boolean) => session.update({ isWaiting: value });
  const ensureFreshConversation = async (generation: number) => {
    if (!session.getSnapshot().needsReset) return;
    await geminiClient.reset(characterName);
    if (session.getSnapshot().generation === generation) session.update({ needsReset: false });
  };

  const requestReset = useCallback(() => {
    if (savedStory || !hasKey || session.getSnapshot().isWaiting) return;
    setResetError(false);
    setResetConfirm(true);
  }, [savedStory, hasKey, session]);

  useEffect(() => {
    if (!onRefreshActionChange || savedStory) return;
    onRefreshActionChange({ onPress: requestReset, disabled: isWaiting || !hasKey });
    return () => onRefreshActionChange(null);
  }, [onRefreshActionChange, savedStory, requestReset, isWaiting, hasKey]);

  useEffect(() => {
    if (!replaying) return;
    const timer = setTimeout(() => setReplayCount((count) => count + 1), TYPING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [replaying, replayCount, savedStory]);

  useEffect(() => {
    // 아이템 렌더 → 레이아웃 계산이 끝난 뒤 스크롤해야 끝까지 내려간다.
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages, replayCount]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return () => show.remove();
  }, []);

  const removeTyping = (prev: Chat[]) => prev.filter((m) => m.sender !== 'typing');

  /** 캐릭터 응답을 타이핑 표시와 함께 문장별로 출력 */
  const playReply = async (text: string, generation: number) => {
    if (session.getSnapshot().generation !== generation) return;
    const sentences = splitChatReply(text);
    if (sentences.length === 0) {
      setMessages(removeTyping);
      return;
    }

    setMessages((prev) => removeTyping(prev).concat({ sender: 'character', text: sentences[0], showImage: true }));

    for (let i = 1; i < sentences.length; i++) {
      setMessages((prev) => [...prev, { sender: 'typing', text: '···' }]);
      await sleep(TYPING_DELAY_MS);
      if (session.getSnapshot().generation !== generation) return;
      setMessages((prev) => removeTyping(prev).concat({ sender: 'character', text: sentences[i] }));
    }
  };

  /* 먼저 말 걸기가 켜져 있으면 입장 시 캐릭터가 먼저 말을 건다 */
  useFocusEffect(useCallback(() => {
    if (savedStory || !getGreetMode() || !getGeminiKey().trim()) return;

    const current = session.getSnapshot();
    if (current.eventReady || current.greetingStarted || current.messages.length || current.isWaiting) return;
    session.update({ greetingStarted: true, isWaiting: true });
    const generation = current.generation;
    // Finish and store the reply even when the user switches to another screen.
    (async () => {
      setMessages((prev) => [...prev, { sender: 'typing', text: '···', showImage: true }]);
      try {
        await ensureFreshConversation(generation);
        if (session.getSnapshot().generation !== generation) return;
        const { triggerLine } = await geminiClient.trigger(characterName);
        await sleep(TYPING_DELAY_MS);
        await playReply(triggerLine ?? '', generation);
      } catch (e) {
        if (session.getSnapshot().generation !== generation) return;
        console.error('[CharacterChat] trigger 실패:', e);
        setMessages((prev) => removeTyping(prev).concat({ sender: 'character', text: geminiFailureText(e), showImage: true }));
      } finally {
        if (session.getSnapshot().generation === generation) setWaiting(false);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, characterName, hasKey, savedStory, draft.generation]));

  const handleReset = async () => {
    if (savedStory || !hasKey || session.getSnapshot().isWaiting) return;
    const generation = session.getSnapshot().generation;
    setWaiting(true);
    setResetError(false);
    try {
      await geminiClient.reset(characterName);
      if (session.getSnapshot().generation !== generation) return;
      session.clear();
      setResetConfirm(false);
    } catch {
      if (session.getSnapshot().generation === generation) setResetError(true);
    } finally {
      if (session.getSnapshot().generation === generation) setWaiting(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (savedStory || !hasKey || !text || session.getSnapshot().isWaiting || session.getSnapshot().eventReady) return;
    const generation = session.getSnapshot().generation;

    setWaiting(true);
    setMessages((prev) => [
      ...prev,
      { sender: 'user', text },
      { sender: 'typing', text: '···', showImage: true },
    ]);
    setInput('');

    try {
      await ensureFreshConversation(generation);
      if (session.getSnapshot().generation !== generation) return;
      const { reply, eventReady: ready } = await geminiClient.chat(characterName, text);
      if (session.getSnapshot().generation !== generation) return;
      setEventReady(getIncludeBondStory() && ready);
      await playReply(reply, generation);
      if (session.getSnapshot().generation === generation) setWaiting(false);
    } catch (err) {
      if (session.getSnapshot().generation !== generation) return;
      console.error('[CharacterChat] chat 실패:', err);
      setWaiting(false);
      setMessages((prev) =>
        removeTyping(prev).concat({ sender: 'character', text: geminiFailureText(err), showImage: true }),
      );
    }
  };

  const handleEventStart = async () => {
    if (savedStory) {
      setPendingEvent(savedStory.script);
      router.push('/event');
      return;
    }
    if (!getIncludeBondStory() || session.getSnapshot().isWaiting || !session.getSnapshot().eventReady) return;
    const openStory = (script: string) => {
      const generation = session.getSnapshot().generation;
      setPendingEvent(script, () => {
        if (session.getSnapshot().generation !== generation || session.getSnapshot().storyScript !== script) return;
        session.clear({ needsReset: true });
      });
      router.push('/event');
    };
    if (session.getSnapshot().storyScript) { openStory(session.getSnapshot().storyScript!); return; }
    setWaiting(true);
    const generation = session.getSnapshot().generation;
    const chatSnapshot = messages.filter((message): message is SavedChatMessage => message.sender !== 'typing');
    setGlobalLoading?.(true);
    try {
      const { eventScript } = await geminiClient.createEvent(characterName);
      if (session.getSnapshot().generation !== generation) return;
      saveStory(characterName, eventScript, chatSnapshot);
      session.update({ storyScript: eventScript });
      openStory(eventScript);
    } catch (e) {
      if (session.getSnapshot().generation !== generation) return;
      console.error('[CharacterChat] 이벤트 생성 실패:', e);
      setMessages((prev) => [...prev, { sender: 'character', text: geminiFailureText(e) }]);
    } finally {
      if (session.getSnapshot().generation === generation) setWaiting(false);
      setGlobalLoading?.(false);
    }
  };

  const renderItem = ({ item }: { item: Chat }) => {
    const isUser = item.sender === 'user';
    const isTyping = item.sender === 'typing';

    return (
      <View style={[styles.messageRow, sizeStyles.messageRow, isUser && styles.messageRowRight]}>
        {!isUser && (
          <View style={[styles.avatarWrapper, sizeStyles.avatarWrapper]}>
            {item.showImage && characterImage && <Image source={characterImage} style={[styles.avatar, sizeStyles.avatar]} />}
          </View>
        )}
        <View style={styles.messageColumn}>
          {!isUser && item.showImage && <Text style={[styles.charName, sizeStyles.charName]}>{visibleName}</Text>}
          <Text style={[styles.bubble, isUser ? styles.userBubble : styles.charBubble, isTyping && styles.typingBubble, sizeStyles.bubble]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {!savedStory && !onRefreshActionChange && <View style={styles.refreshBar}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('refreshChat')} accessibilityState={{ disabled: isWaiting || !hasKey }} disabled={isWaiting || !hasKey} style={[styles.refreshButton, (isWaiting || !hasKey) && styles.refreshDisabled]} onPress={requestReset}>
          <Ionicons name="refresh-outline" size={22} color="#87616e" />
        </TouchableOpacity>
      </View>}
      <FlatList
        ref={listRef}
        data={shownMessages}
        extraData={chatSize}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={savedStory ? <Text style={styles.archiveNotice}>{t('noSavedChat')}</Text> : undefined}
        onContentSizeChange={() => {
          if (!savedStory || replaying) listRef.current?.scrollToEnd({ animated: true });
        }}
      />

      {(savedStory ? !replaying : includeBondStory && eventReady) && (
        <View style={styles.eventContainer}>
          <Text style={[styles.eventLabel, sizeStyles.eventLabel]}>| {t('bondEvent')} |</Text>
          <TouchableOpacity style={styles.eventButton} onPress={handleEventStart}>
            <Text style={[styles.eventButtonText, sizeStyles.eventButtonText]}>{t('bondStory', { name: visibleName })}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!savedStory && eventReady && <Text style={styles.archiveNotice}>{t(storyScript ? 'storyChatAwaitingEnd' : 'storyChatLocked')}</Text>}
      {savedStory && replaying && <Text style={styles.archiveNotice}>{t('chatReplayHint')}</Text>}
      {!savedStory && <View style={styles.inputArea}>
        <TextInput
          ref={inputRef}
          style={[styles.input, sizeStyles.input, (!hasKey || isWaiting || eventReady) && styles.inputLocked]}
          placeholder={hasKey ? t('messagePlaceholder') : t('messageKeyRequired')}
          value={hasKey ? input : ''}
          editable={hasKey && !isWaiting && !eventReady}
          onChangeText={(value) => { if (hasKey && !session.getSnapshot().isWaiting && !session.getSnapshot().eventReady) setInput(value); }}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Button title={t('send')} onPress={handleSend} disabled={!hasKey || isWaiting || eventReady} />
      </View>}
      {replaying && (
        <Pressable
          style={styles.replaySkip}
          accessibilityRole="button"
          accessibilityLabel={t('showAllChat')}
          onPress={() => setReplayCount(savedMessages?.length ?? 0)}
        />
      )}
      {!savedStory && resetConfirm && <Modal transparent visible animationType="fade" onRequestClose={() => { if (!session.getSnapshot().isWaiting) setResetConfirm(false); }}>
        <View style={styles.resetOverlay}><View style={styles.resetCard} accessibilityViewIsModal>
          <Text style={styles.resetTitle}>{t('resetChatTitle')}</Text>
          <Text style={styles.resetBody}>{t('resetChatNotice')}</Text>
          {resetError && <Text accessibilityRole="alert" style={styles.resetError}>{t('resetChatFailed')}</Text>}
          <View style={styles.resetActions}>
            <Button title={t('cancel')} disabled={isWaiting} onPress={() => setResetConfirm(false)} />
            <Button title={t('refreshChat')} disabled={isWaiting} onPress={() => void handleReset()} />
          </View>
        </View></View>
      </Modal>}
    </View>
  );
};

export default CharacterChat;

const styles = StyleSheet.create({
  refreshBar: { alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 6 },
  refreshButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  refreshDisabled: { opacity: 0.4 },
  resetOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(36,32,40,0.45)' },
  resetCard: { width: '100%', maxWidth: 440, borderRadius: 18, padding: 24, gap: 16, backgroundColor: '#fff' },
  resetTitle: { fontSize: 20, fontWeight: '700', color: '#243044' },
  resetBody: { fontSize: 15, lineHeight: 23, color: '#3c4654' },
  resetError: { color: '#a33a54', lineHeight: 22 },
  resetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14 },
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  listContent: {
    padding: 10,
  },
  replaySkip: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  archiveNotice: {
    padding: 12,
    textAlign: 'center',
    color: '#888',
    fontSize: 13,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-start',
  },
  messageRowRight: {
    flexDirection: 'row-reverse',
  },
  messageColumn: {
    flexShrink: 1,
    maxWidth: '85%',
  },
  avatarWrapper: {
    width: 50,
    marginRight: 6,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
  },
  charName: {
    color: '#333',
    fontWeight: 'bold',
    marginBottom: 2,
    fontSize: 15,
  },
  bubble: {
    padding: 10,
    borderRadius: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  userBubble: {
    backgroundColor: '#DCF8C6',
  },
  charBubble: {
    backgroundColor: '#44546A',
    color: 'white',
  },
  typingBubble: {
    letterSpacing: 2,
    fontSize: 16,
  },
  inputArea: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    fontSize: 16,
  },
  inputLocked: {
    backgroundColor: '#f3f3f3',
    color: '#888',
  },
  eventContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  eventLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 4,
  },
  eventButton: {
    backgroundColor: '#F48FB1',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  eventButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
