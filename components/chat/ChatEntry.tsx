import React, { useMemo, useSyncExternalStore } from 'react';
import { ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getGeminiKey, subscribeGeminiKey } from '@/services/geminiKey';
import { getTemporaryChat } from '@/store/temporaryChats';
import { useI18n } from '@/i18n';
import CharacterAvatar from '@/components/CharacterAvatar';

interface Props {
  image: ImageSourcePropType;
  name: string;
  characterName: string;
  status: string;
  selected?: boolean;
  onSelect: () => void;
}

const ChatEntry: React.FC<Props> = ({ image, name, characterName, status, selected, onSelect }) => {
  const { t } = useI18n();
  const apiKey = useSyncExternalStore(subscribeGeminiKey, getGeminiKey, () => '');
  const session = useMemo(() => getTemporaryChat(characterName, apiKey), [characterName, apiKey]);
  const unreadCount = useSyncExternalStore(session.subscribe, () => session.getSnapshot().unreadCount, () => 0);
  return (
    <TouchableOpacity onPress={onSelect} style={[styles.entry, selected && styles.entrySelected]}>
      <CharacterAvatar characterName={characterName} source={image} style={styles.avatar} />
      <View style={styles.texts}>
        <Text style={styles.name}>{name}</Text>
        {!!status && (
          <Text style={styles.status} numberOfLines={1}>
            {status}
          </Text>
        )}
      </View>
      {unreadCount > 0 && <View style={styles.unreadBadge}>
        <Text style={styles.unreadText} accessibilityLabel={t('unreadMessages', { count: unreadCount })}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
      </View>}
    </TouchableOpacity>
  );
};

export default ChatEntry;

const styles = StyleSheet.create({
  entry: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderRadius: 6,
  },
  entrySelected: {
    backgroundColor: '#e6ecf0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 5,
  },
  texts: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: 'bold',
  },
  unreadBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, marginRight: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d64868' },
  unreadText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  status: {
    fontSize: 14,
    color: '#666',
  },
});
