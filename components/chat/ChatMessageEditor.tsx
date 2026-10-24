import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { SavedChatMessage } from '@/storage/types';
import { useI18n } from '@/i18n';

interface Props {
  value: SavedChatMessage[];
  onChange: (messages: SavedChatMessage[]) => void;
  onDeleteMessage?: (index: number) => void;
  storyBreaks?: { id: string; label: string; afterMessageCount: number }[];
  onStoryPress?: (id: string) => void;
}

export default function ChatMessageEditor({ value, onChange, onDeleteMessage, storyBreaks = [], onStoryPress }: Props) {
  const { t } = useI18n();
  const scroll = useRef<ScrollView>(null);
  // Stable row IDs keep focus and IME input on the same message after reordering.
  const nextId = useRef(value.length);
  const ids = useRef(value.map((_, index) => index));
  const change = (index: number, patch: Partial<SavedChatMessage>) => onChange(value.map((message, i) => i === index ? { ...message, ...patch } : message));
  const move = (index: number, offset: number) => {
    const destination = index + offset;
    if (destination < 0 || destination >= value.length) return;
    const messages = [...value];
    [messages[index], messages[destination]] = [messages[destination], messages[index]];
    [ids.current[index], ids.current[destination]] = [ids.current[destination], ids.current[index]];
    onChange(messages);
  };
  const add = (sender: SavedChatMessage['sender']) => {
    ids.current.push(nextId.current++);
    onChange([...value, { sender, text: '', ...(sender === 'character' ? { showImage: true } : {}) }]);
    scroll.current?.scrollToEnd({ animated: true });
  };
  const renderStories = (after: number) => storyBreaks.filter(story => Math.min(value.length, story.afterMessageCount) === after).map(story => (
    <TouchableOpacity key={story.id} accessibilityRole="button" style={styles.storyBreak} onPress={() => onStoryPress?.(story.id)}><Text style={styles.buttonText}>{story.label}</Text></TouchableOpacity>
  ));
  return <View style={styles.root}>
    <Text style={styles.hint}>{t('chatEditorHint')}</Text>
    <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled">
      {!value.length && <Text style={styles.hint}>{t('chatEditorEmpty')}</Text>}
      {renderStories(0)}
      {value.map((message, index) => <View key={ids.current[index]}><View style={styles.card}>
        <View style={styles.toolbar}>
          <Text style={styles.order}>{index + 1}</Text>
          {(['user', 'character'] as const).map(sender => <TouchableOpacity key={sender} accessibilityRole="button" accessibilityState={{ selected: message.sender === sender }} style={[styles.button, message.sender === sender && styles.active]} onPress={() => change(index, { sender })}>
            <Text style={styles.buttonText}>{t(sender === 'user' ? 'chatEditorUser' : 'chatEditorCharacter')}</Text>
          </TouchableOpacity>)}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('chatEditorMoveUp', { index: index + 1 })} disabled={index === 0} style={[styles.button, index === 0 && styles.disabled]} onPress={() => move(index, -1)}><Text style={styles.buttonText}>↑</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('chatEditorMoveDown', { index: index + 1 })} disabled={index === value.length - 1} style={[styles.button, index === value.length - 1 && styles.disabled]} onPress={() => move(index, 1)}><Text style={styles.buttonText}>↓</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('chatEditorDelete', { index: index + 1 })} style={styles.button} onPress={() => {
            ids.current.splice(index, 1);
            onDeleteMessage?.(index);
            onChange(value.filter((_, i) => i !== index));
          }}><Text style={styles.deleteText}>{t('delete')}</Text></TouchableOpacity>
        </View>
        <TextInput accessibilityLabel={t('chatEditorMessage', { index: index + 1 })} value={message.text} onChangeText={text => change(index, { text })} multiline textAlignVertical="top" style={styles.input} />
        {message.sender === 'character' && <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: !!message.showImage }} style={styles.avatarToggle} onPress={() => change(index, { showImage: !message.showImage })}>
          <Text style={styles.buttonText}>{message.showImage ? '☑' : '☐'} {t('chatEditorShowAvatar')}</Text>
        </TouchableOpacity>}
      </View>{renderStories(index + 1)}</View>)}
    </ScrollView>
    <View style={styles.addActions}>
      <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => add('user')}><Text style={styles.buttonText}>{t('chatEditorAddUser')}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => add('character')}><Text style={styles.buttonText}>{t('chatEditorAddCharacter')}</Text></TouchableOpacity>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, minHeight: 0 },
  hint: { color: '#748094', fontSize: 13, lineHeight: 20, paddingBottom: 12 },
  scroll: { flex: 1 }, messages: { gap: 12, paddingBottom: 24 },
  card: { padding: 12, gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e6ea', borderRadius: 12 },
  storyBreak: { alignSelf: 'center', padding: 14, marginVertical: 12, borderRadius: 8, backgroundColor: '#f8d6e3' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  order: { color: '#748094', fontWeight: '600', paddingHorizontal: 6 },
  button: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8, backgroundColor: '#eceff3' },
  buttonText: { color: '#6a5361', fontSize: 13, fontWeight: '600' },
  active: { backgroundColor: '#f8d6e3' }, disabled: { opacity: 0.35 }, deleteText: { color: '#a33a54', fontSize: 13 },
  input: { minHeight: 80, padding: 12, borderWidth: 1, borderColor: '#e2e6ea', borderRadius: 8, fontSize: 15, lineHeight: 22, color: '#222' },
  avatarToggle: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
  addActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 12 },
});
