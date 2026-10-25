import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Button,
  AppState,
  FlatList,
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
import { saveStory, appendRoomStory, updateRoom, listStories, episodesOf, subscribeStories, type SavedStory } from '@/store/storyLibrary';
import type { SavedChatMessage, StoryEpisode } from '@/storage/types';
import { getTemporaryChat, linkTemporaryRoom, activateTemporaryRoom, unlinkTemporaryRoom, type TemporaryMessage } from '@/store/temporaryChats';
import { dialogPairs, type ConversationContext } from '../../shared/conversation';
import { useChatSize } from '@/services/chatSize';
import { makeChatSizeStyles } from './chatSizeStyles';
import { useI18n } from '@/i18n';
import CharacterAvatar from '@/components/CharacterAvatar';
import { splitChatReply } from '@/utils/splitChatReply';
import useChatPop from '@/hooks/useChatPop';
import type { ChatRoom } from '@/shared/chatRoom';

export type ChatRefreshAction = { onPress: () => void; disabled: boolean; generate?: { onPress: () => void; disabled: boolean } };

interface Props {
  characterName: string;
  room?: ChatRoom;
  displayName?: string;
  characterImage?: ImageSourcePropType;
  setGlobalLoading?: (value: boolean) => void;
  savedStory?: SavedStory;
  conversation?: SavedStory;
  onStoryActions?: (storyId: string) => void;
  onRefreshActionChange?: (action: ChatRefreshAction | null) => void;
}

type Chat = TemporaryMessage;

const TYPING_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CharacterChat: React.FC<Props> = ({ characterName, room = 'bond', displayName, characterImage, setGlobalLoading, savedStory, conversation, onStoryActions, onRefreshActionChange }) => {
  const { t } = useI18n();
  const visibleName = displayName ?? characterName;
  const router = useRouter();
  const chatSize = useChatSize();
  const includeBondStory = room === 'bond';
  const sizeStyles = useMemo(() => makeChatSizeStyles(chatSize), [chatSize]);

  const apiKey = useSyncExternalStore(subscribeGeminiKey, getGeminiKey, () => '');
  const hasKey = apiKey.trim().length > 0;
  const session = useMemo(() => {
    const chat = getTemporaryChat(characterName, apiKey, room, conversation?.id);
    if (conversation && !chat.getSnapshot().roomId) {
      const history = conversation.chatMessages ?? [];
      const latestStory = episodesOf(conversation).at(-1);
      const afterStory = Math.max(0, latestStory?.afterMessageCount ?? latestStory?.chatMessages.length ?? 0);
      chat.update({
        roomId: conversation.id, messages: history,
        completedPairs: dialogPairs(history.slice(afterStory)).length, greetingStarted: true,
      });
    }
    if (conversation) activateTemporaryRoom(characterName, apiKey, conversation.id);
    return chat;
  // A room is hydrated once; subsequent changes come from the shared session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterName, apiKey, room, conversation?.id]);
  const draft = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { messages, input, isWaiting, completedPairs } = draft;
  const [, refreshLibrary] = useState(0);
  useEffect(() => subscribeStories(() => refreshLibrary(value => value + 1)), []);
  const storedRoom = draft.roomId ? listStories().find(story => story.id === draft.roomId) : conversation;
  const messageOffsets = useMemo(() => {
    let count = 0;
    return messages.map(message => { if (message.sender !== 'typing') count++; return count; });
  }, [messages]);
  const messageCount = messageOffsets.at(-1) ?? 0;
  const storyPoints = !savedStory && includeBondStory && storedRoom ? episodesOf(storedRoom).map(story => ({
    story, after: Math.min(messageCount, Math.max(0, story.afterMessageCount ?? story.chatMessages.length)),
  })) : [];
  const showQuickGenerate = !savedStory && includeBondStory && completedPairs >= 1;
  const eventStartRef = useRef<() => void>(() => {});
  const setMessages = (change: Chat[] | ((previous: Chat[]) => Chat[]), arrival?: string) => {
    session.update(previous => ({ messages: typeof change === 'function' ? change(previous.messages) : change }), arrival);
    const current = session.getSnapshot();
    if (current.roomId) updateRoom(current.roomId, { chatMessages: current.messages.filter((message): message is SavedChatMessage => message.sender !== 'typing') });
  };
  const setInput = (value: string) => session.update({ input: value });
  const setEventReady = (value: boolean) => session.update({ eventReady: value });
  const contextFor = (history: Chat[]): ConversationContext | undefined => {
    const id = session.getSnapshot().roomId;
    const stored = id ? listStories().find(story => story.id === id) : undefined;
    const contextId = stored?.id ?? session.getSnapshot().recoveryContextId;
    return contextId ? { id: contextId, messages: history.filter((message): message is SavedChatMessage => message.sender !== 'typing'), scripts: stored ? episodesOf(stored).map(episode => episode.script) : [] } : undefined;
  };
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
    await geminiClient.reset(characterName, room);
    if (session.getSnapshot().generation === generation) session.update({ needsReset: false });
  };

  const requestReset = useCallback(() => {
    if (savedStory || conversation || !hasKey || session.getSnapshot().isWaiting) return;
    setResetError(false);
    setResetConfirm(true);
  }, [savedStory, conversation, hasKey, session]);

  useEffect(() => {
    if (!onRefreshActionChange || savedStory) return;
    onRefreshActionChange({ onPress: requestReset, disabled: isWaiting || !hasKey, generate: showQuickGenerate ? { onPress: () => eventStartRef.current(), disabled: isWaiting || !hasKey } : undefined });
    return () => onRefreshActionChange(null);
  }, [onRefreshActionChange, savedStory, requestReset, isWaiting, hasKey, showQuickGenerate]);

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

    setMessages((prev) => removeTyping(prev).concat({ sender: 'character', text: sentences[0], showImage: true }), text);

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
    const controller = new AbortController();
    session.update({ greetingStarted: true, isWaiting: true, replyController: controller });
    const generation = current.generation;
    // Finish and store the reply even when the user switches to another screen.
    (async () => {
      setMessages((prev) => [...prev, { sender: 'typing', text: '···', showImage: true }]);
      try {
        await ensureFreshConversation(generation);
        if (session.getSnapshot().generation !== generation) return;
        const { triggerLine } = await geminiClient.trigger(characterName, room, controller.signal);
        if (session.getSnapshot().generation !== generation) return;
        session.update({ replyController: undefined });
        await sleep(TYPING_DELAY_MS);
        await playReply(triggerLine ?? '', generation);
      } catch (e) {
        if (session.getSnapshot().generation !== generation) return;
        console.error('[CharacterChat] trigger 실패:', e);
        setMessages((prev) => removeTyping(prev).concat({ sender: 'character', text: geminiFailureText(e), showImage: true }));
      } finally {
        if (session.getSnapshot().generation === generation) session.update({ isWaiting: false, replyController: undefined });
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, characterName, room, hasKey, savedStory, draft.generation]));

  const handleReset = async () => {
    if (savedStory || !hasKey || session.getSnapshot().isWaiting) return;
    const generation = session.getSnapshot().generation;
    setWaiting(true);
    setResetError(false);
    try {
      await geminiClient.reset(characterName, room);
      if (session.getSnapshot().generation !== generation) return;
      const roomId = session.getSnapshot().roomId;
      if (roomId) unlinkTemporaryRoom(characterName, apiKey, roomId);
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
    if (savedStory || !hasKey || !text || session.getSnapshot().isWaiting) return;
    const generation = session.getSnapshot().generation;

    const controller = new AbortController();
    session.update({ isWaiting: true, replyController: controller });
    setMessages((prev) => [
      ...prev,
      { sender: 'user', text },
      { sender: 'typing', text: '···', showImage: true },
    ]);
    setInput('');

    try {
      await ensureFreshConversation(generation);
      if (session.getSnapshot().generation !== generation) return;
      const { reply, eventReady: ready } = await geminiClient.chat(characterName, text, room, contextFor(messages), controller.signal);
      if (session.getSnapshot().generation !== generation) return;
      session.update({ replyController: undefined });
      setEventReady(includeBondStory && ready);
      await playReply(reply, generation);
      if (session.getSnapshot().generation !== generation) return;
      if (reply.trim()) session.update(previous => ({ completedPairs: previous.completedPairs + 1 }));
      if (room === 'bond' && reply.trim() && session.getSnapshot().generation === generation && !session.getSnapshot().roomId) {
        const history = session.getSnapshot().messages.filter((message): message is SavedChatMessage => message.sender !== 'typing');
        const stored = saveStory(characterName, '', history);
        updateRoom(stored.id, { title: t('newConversation', { name: visibleName }), episodes: [] });
        linkTemporaryRoom(characterName, apiKey, stored.id, session);
      }
      if (session.getSnapshot().generation === generation) session.update({ isWaiting: false, replyController: undefined });
    } catch (err) {
      if (session.getSnapshot().generation !== generation) return;
      console.error('[CharacterChat] chat 실패:', err);
      session.update({ isWaiting: false, replyController: undefined });
      setMessages((prev) =>
        removeTyping(prev).concat({ sender: 'character', text: geminiFailureText(err), showImage: true }),
      );
    }
  };

  const cancelMessage = () => {
    if (!session.cancelReply()) return;
    const current = session.getSnapshot();
    if (current.roomId) updateRoom(current.roomId, { chatMessages: current.messages.filter((message): message is SavedChatMessage => message.sender !== 'typing') });
  };

  const handleEventStart = async () => {
    if (savedStory) {
      setPendingEvent(savedStory.script);
      router.push('/event');
      return;
    }
    const current = session.getSnapshot();
    if (!includeBondStory || !hasKey || current.isWaiting || current.completedPairs < 1) return;
    const openStory = (script: string) => {
      setPendingEvent(script);
      router.push('/event');
    };
    setWaiting(true);
    const generation = session.getSnapshot().generation;
    const chatSnapshot = messages.filter((message): message is SavedChatMessage => message.sender !== 'typing');
    setGlobalLoading?.(true);
    try {
      const { eventScript } = await geminiClient.createEvent(characterName, contextFor(messages));
      if (session.getSnapshot().generation !== generation) return;
      const roomId = session.getSnapshot().roomId;
      if (roomId) {
        if (!appendRoomStory(roomId, eventScript, chatSnapshot)) throw new Error('채팅방을 찾을 수 없습니다.');
      } else {
        const stored = saveStory(characterName, eventScript, chatSnapshot);
        linkTemporaryRoom(characterName, apiKey, stored.id, session);
      }
      session.update({ storyScript: eventScript, eventReady: true, completedPairs: 0 });
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

  eventStartRef.current = handleEventStart;

  const renderStory = (story: StoryEpisode) => (
    <View key={story.id} style={styles.eventContainer}>
      <Text style={[styles.eventLabel, sizeStyles.eventLabel]}>| {t('bondEvent')} |</Text>
      <View style={styles.storyActions}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('bondStory', { name: visibleName })} style={styles.eventButton} onPress={() => {
          setPendingEvent(story.script); router.push('/event');
        }}>
          <Text style={[styles.eventButtonText, sizeStyles.eventButtonText]}>{t('bondStory', { name: visibleName })}</Text>
        </TouchableOpacity>
        {onStoryActions && <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('storyMenu')} style={styles.storyMenu} onPress={() => onStoryActions(story.id)}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#87616e" />
        </TouchableOpacity>}
      </View>
    </View>
  );
  const renderItem = ({ item, index }: { item: Chat; index: number }) => {
    const isUser = item.sender === 'user';
    const isTyping = item.sender === 'typing';

    return (
      <View><View style={[styles.messageRow, sizeStyles.messageRow, isUser && styles.messageRowRight]}>
        {!isUser && (
          <View style={[styles.avatarWrapper, sizeStyles.avatarWrapper]}>
            {item.showImage && characterImage && <CharacterAvatar characterName={characterName} source={characterImage} style={[styles.avatar, sizeStyles.avatar]} />}
          </View>
        )}
        <View style={styles.messageColumn}>
          {!isUser && item.showImage && <Text style={[styles.charName, sizeStyles.charName]}>{visibleName}</Text>}
          <Text style={[styles.bubble, isUser ? styles.userBubble : styles.charBubble, isTyping && styles.typingBubble, sizeStyles.bubble]}>
            {item.text}
          </Text>
        </View>
      </View>
      {!isTyping && storyPoints.filter(point => point.after === messageOffsets[index]).map(point => renderStory(point.story))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {!savedStory && !conversation && !onRefreshActionChange && <View style={styles.refreshBar}>
        {!conversation && <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('refreshChat')} accessibilityState={{ disabled: isWaiting || !hasKey }} disabled={isWaiting || !hasKey} style={[styles.refreshButton, (isWaiting || !hasKey) && styles.refreshDisabled]} onPress={requestReset}>
          <Ionicons name="refresh-outline" size={22} color="#87616e" />
        </TouchableOpacity>}
      </View>}
      <FlatList
        ref={listRef}
        data={shownMessages}
        extraData={chatSize}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderItem}
        ListHeaderComponent={storyPoints.some(point => point.after === 0) ? <View>{storyPoints.filter(point => point.after === 0).map(point => renderStory(point.story))}</View> : undefined}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={savedStory ? <Text style={styles.archiveNotice}>{t('noSavedChat')}</Text> : undefined}
        onContentSizeChange={() => {
          if (!savedStory || replaying) listRef.current?.scrollToEnd({ animated: true });
        }}
      />

      {savedStory && !replaying && (
        <View style={styles.eventContainer}>
          <Text style={[styles.eventLabel, sizeStyles.eventLabel]}>| {t('bondEvent')} |</Text>
          <TouchableOpacity accessibilityRole="button" disabled={!savedStory && !hasKey} style={[styles.eventButton, !savedStory && !hasKey && styles.refreshDisabled]} onPress={handleEventStart}>
            <Text style={[styles.eventButtonText, sizeStyles.eventButtonText]}>{t('bondStory', { name: visibleName })}</Text>
          </TouchableOpacity>
        </View>
      )}

      {savedStory && replaying && <Text style={styles.archiveNotice}>{t('chatReplayHint')}</Text>}
      {showQuickGenerate && <View style={styles.generateBar}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('generateStoryNow')} accessibilityState={{ disabled: isWaiting || !hasKey }} activeOpacity={0.7} disabled={isWaiting || !hasKey} onPress={handleEventStart} style={[styles.eventButton, styles.quickGenerate, (isWaiting || !hasKey) && styles.refreshDisabled]}>
          <Text style={[styles.eventButtonText, styles.quickGenerateText]}>{t('generateStoryNow')}</Text>
        </TouchableOpacity>
      </View>}
      {!savedStory && <View style={styles.inputArea}>
        <TextInput
          ref={inputRef}
          style={[styles.input, sizeStyles.input, (!hasKey || isWaiting) && styles.inputLocked]}
          placeholder={hasKey ? t('messagePlaceholder') : t('messageKeyRequired')}
          value={hasKey ? input : ''}
          editable={hasKey && !isWaiting}
          onChangeText={(value) => { if (hasKey && !session.getSnapshot().isWaiting) setInput(value); }}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Button title={t('send')} onPress={handleSend} disabled={!hasKey || isWaiting} />
        {!!draft.replyController && <Button title={t('cancelMessage')} onPress={cancelMessage} />}
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
  refreshBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  generateBar: { flexShrink: 0, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
  quickGenerate: { alignSelf: 'center', maxWidth: '100%', minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  quickGenerateText: { fontSize: 14, textAlign: 'center' },
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
    marginTop: 12,
  },
  storyActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  storyMenu: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
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
