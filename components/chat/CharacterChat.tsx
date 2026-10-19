import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Button,
  FlatList,
  Image,
  ImageSourcePropType,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { geminiClient, geminiFailureText } from '@/services/geminiClient';
import { getGeminiKey, subscribeGeminiKey } from '@/services/geminiKey';
import { getGreetMode } from '@/services/greetMode';
import { setPendingEvent } from '@/store/eventStore';
import { saveStory, type SavedStory } from '@/store/storyLibrary';
import type { SavedChatMessage } from '@/storage/types';
import { useChatSize } from '@/services/chatSize';
import { makeChatSizeStyles } from './chatSizeStyles';
import { useI18n } from '@/i18n';
import { splitChatReply } from '@/utils/splitChatReply';
import useChatPop from '@/hooks/useChatPop';

interface Props {
  characterName: string;
  displayName?: string;
  characterImage?: ImageSourcePropType;
  setGlobalLoading?: (value: boolean) => void;
  savedStory?: SavedStory;
}

interface Chat {
  sender: 'user' | 'character' | 'typing';
  text: string;
  showImage?: boolean;
}

const TYPING_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CharacterChat: React.FC<Props> = ({ characterName, displayName, characterImage, setGlobalLoading, savedStory }) => {
  const { t } = useI18n();
  const visibleName = displayName ?? characterName;
  const router = useRouter();
  const chatSize = useChatSize();
  const sizeStyles = useMemo(() => makeChatSizeStyles(chatSize), [chatSize]);

  const apiKey = useSyncExternalStore(subscribeGeminiKey, getGeminiKey, () => '');
  const hasKey = apiKey.trim().length > 0;
  const [messages, setMessages] = useState<Chat[]>([]);
  const [input, setInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [eventReady, setEventReady] = useState(false);
  const [replayCount, setReplayCount] = useState(1);
  const savedMessages = savedStory?.chatMessages;
  const replaying = !!savedStory && replayCount < (savedMessages?.length ?? 0);
  const shownMessages = savedStory ? (savedMessages ?? []).slice(0, replayCount) : messages;
  useChatPop(shownMessages);

  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<Chat>>(null);
  const waitingRef = useRef(false);
  const setWaiting = (value: boolean) => {
    waitingRef.current = value;
    setIsWaiting(value);
  };

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
  const playReply = async (text: string) => {
    const sentences = splitChatReply(text);
    if (sentences.length === 0) {
      setMessages(removeTyping);
      return;
    }

    setMessages((prev) => removeTyping(prev).concat({ sender: 'character', text: sentences[0], showImage: true }));

    for (let i = 1; i < sentences.length; i++) {
      setMessages((prev) => [...prev, { sender: 'typing', text: '···' }]);
      await sleep(TYPING_DELAY_MS);
      setMessages((prev) => removeTyping(prev).concat({ sender: 'character', text: sentences[i] }));
    }
  };

  /* 먼저 말 걸기가 켜져 있으면 입장 시 캐릭터가 먼저 말을 건다 */
  useEffect(() => {
    if (savedStory || !getGreetMode() || !getGeminiKey().trim()) return;

    let cancelled = false;
    setWaiting(true);
    (async () => {
      setMessages((prev) => [...prev, { sender: 'typing', text: '···', showImage: true }]);
      try {
        const { triggerLine } = await geminiClient.trigger(characterName);
        await sleep(TYPING_DELAY_MS);
        if (!cancelled) await playReply(triggerLine ?? '');
        if (!cancelled) setWaiting(false);
      } catch (e) {
        console.error('[CharacterChat] trigger 실패:', e);
        if (!cancelled) {
          setWaiting(false);
          setMessages((prev) =>
            removeTyping(prev).concat({ sender: 'character', text: geminiFailureText(e), showImage: true }),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      setWaiting(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterName, hasKey, savedStory]);

  const handleSend = async () => {
    const text = input.trim();
    if (savedStory || !hasKey || !text || waitingRef.current) return;

    setWaiting(true);
    setMessages((prev) => [
      ...prev,
      { sender: 'user', text },
      { sender: 'typing', text: '···', showImage: true },
    ]);
    setInput('');

    try {
      const { reply, eventReady: ready } = await geminiClient.chat(characterName, text);
      await playReply(reply);
      setWaiting(false);
      setEventReady(ready);
    } catch (err) {
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
    if (waitingRef.current) return;
    setWaiting(true);
    const chatSnapshot = messages.filter((message): message is SavedChatMessage => message.sender !== 'typing');
    setGlobalLoading?.(true);
    try {
      const { eventScript } = await geminiClient.createEvent(characterName);
      saveStory(characterName, eventScript, chatSnapshot);
      setPendingEvent(eventScript);
      router.push('/event');
    } catch (e) {
      console.error('[CharacterChat] 이벤트 생성 실패:', e);
      setMessages((prev) => [...prev, { sender: 'character', text: geminiFailureText(e) }]);
    } finally {
      setWaiting(false);
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

      {(savedStory ? !replaying : eventReady) && (
        <View style={styles.eventContainer}>
          <Text style={[styles.eventLabel, sizeStyles.eventLabel]}>| {t('bondEvent')} |</Text>
          <TouchableOpacity style={styles.eventButton} onPress={handleEventStart}>
            <Text style={[styles.eventButtonText, sizeStyles.eventButtonText]}>{t('bondStory', { name: visibleName })}</Text>
          </TouchableOpacity>
        </View>
      )}

      {savedStory ? (
        <Text style={styles.archiveNotice}>{t(replaying ? 'chatReplayHint' : 'savedChatReadOnly')}</Text>
      ) : <View style={styles.inputArea}>
        <TextInput
          ref={inputRef}
          style={[styles.input, sizeStyles.input, (!hasKey || isWaiting) && styles.inputLocked]}
          placeholder={hasKey ? t('messagePlaceholder') : t('messageKeyRequired')}
          value={hasKey ? input : ''}
          editable={hasKey && !isWaiting}
          onChangeText={(value) => { if (hasKey && !waitingRef.current) setInput(value); }}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Button title={t('send')} onPress={handleSend} disabled={!hasKey || isWaiting} />
      </View>}
      {replaying && (
        <Pressable
          style={styles.replaySkip}
          accessibilityRole="button"
          accessibilityLabel={t('showAllChat')}
          onPress={() => setReplayCount(savedMessages?.length ?? 0)}
        />
      )}
    </View>
  );
};

export default CharacterChat;

const styles = StyleSheet.create({
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
