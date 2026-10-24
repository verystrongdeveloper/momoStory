import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GreetModeToggle from './GreetModeToggle';
import StoryHeader from './StoryHeader';
import StorySidebar from './StorySidebar';
import ChatEntry from '@/components/chat/ChatEntry';
import CharacterChat, { type ChatRefreshAction } from '@/components/chat/CharacterChat';
import StoryLibraryList from '@/components/chat/StoryLibraryList';
import ConversationRoom from '@/components/chat/ConversationRoom';
import SettingsPanel from './SettingsPanel';
import CommunityPanel from '@/components/community/CommunityPanel';
import AppGuide, { GuideMode } from '@/components/guide/AppGuide';
import { CHARACTERS, Character, displayCharacterName } from '@/constants/characters';
import type { SavedStory } from '@/store/storyLibrary';
import { useLayout } from '@/hooks/useLayout';
import { useI18n } from '@/i18n';
import type { ChatRoom } from '@/shared/chatRoom';

/** characters: 1:1 캐릭터 목록  |  library: 저장된 스토리  |  settings: 설정 */
type ListPanel = 'characters' | 'library' | 'community' | 'settings';

const StoryContainer: React.FC = () => {
  const { language, t } = useI18n();
  const { isCompact } = useLayout();
  const [listPanel, setListPanel] = useState<ListPanel>('characters');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [pendingCharacter, setPendingCharacter] = useState<Character | null>(null);
  const [room, setRoom] = useState<ChatRoom>('chat');
  const [savedStory, setSavedStory] = useState<SavedStory | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [guide, setGuide] = useState<GuideMode | null>(null);
  const [chatRefresh, setChatRefresh] = useState<ChatRefreshAction | null>(null);

  const hasDetail = selectedCharacter !== null;
  const detailTitle = selectedCharacter ? `${selectedCharacter.displayName[language]} · ${t(room === 'chat' ? 'conversationChatOnly' : 'conversationWithStory')}` : undefined;

  const closeDetail = () => {
    setSelectedCharacter(null);
  };

  const openCharacter = (char: Character) => {
    setPendingCharacter(char);
  };

  const sidebar = (
    <StorySidebar
      horizontal={isCompact}
      active={listPanel}
      onOpenCharacterList={() => {
        setSavedStory(null);
        setListPanel('characters');
        if (isCompact) closeDetail();
      }}
      onOpenLibrary={() => {
        setSavedStory(null);
        setListPanel('library');
        if (isCompact) closeDetail();
      }}
      onOpenSettings={() => {
        setSavedStory(null);
        setListPanel('settings');
        if (isCompact) closeDetail();
      }}
      onOpenCommunity={() => {
        setSavedStory(null);
        setListPanel('community');
        if (isCompact) closeDetail();
      }}
    />
  );

  const libraryOpen = listPanel === 'library';
  const settingsOpen = listPanel === 'settings';
  const communityOpen = listPanel === 'community';
  const fullPane = libraryOpen || settingsOpen || communityOpen;
  const fullPaneView = communityOpen ? <CommunityPanel /> : settingsOpen ? (
    <SettingsPanel onOpenTutorial={() => setGuide('tutorial')} onOpenTerms={() => setGuide('terms')} />
  ) : savedStory ? (
    <ConversationRoom key={savedStory.id} story={savedStory} />
  ) : (
    <StoryLibraryList onOpenStory={setSavedStory} />
  );

  const list = (
    <View style={[styles.list, isCompact && styles.listCompact]}>
      <GreetModeToggle />
      <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
      {listPanel === 'characters' &&
        CHARACTERS.map((char) => (
          <ChatEntry
            key={char.name}
            image={char.image}
            name={char.displayName[language]}
            characterName={char.name}
            status={char.displayStatus[language]}
            selected={selectedCharacter?.name === char.name}
            onSelect={() => openCharacter(char)}
          />
        ))}
      </ScrollView>
    </View>
  );

  const detail = fullPane ? (
    fullPaneView
  ) : (
    <View style={styles.detail}>
      {selectedCharacter && (
        <CharacterChat
          key={`${selectedCharacter.name}:${room}`}
          characterName={selectedCharacter.name}
          room={room}
          displayName={selectedCharacter.displayName[language]}
          characterImage={selectedCharacter.image}
          setGlobalLoading={setGlobalLoading}
          onRefreshActionChange={isCompact ? setChatRefresh : undefined}
        />
      )}
      {!hasDetail && (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{t('selectCharacter')}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StoryHeader
        title={libraryOpen && savedStory ? displayCharacterName(savedStory.character, language) : !fullPane ? detailTitle : undefined}
        onBack={libraryOpen && savedStory ? () => setSavedStory(null) : isCompact && hasDetail ? closeDetail : undefined}
        rightAction={isCompact && !fullPane && hasDetail && chatRefresh ? (
          <View style={styles.headerActions}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('refreshChat')} accessibilityState={{ disabled: chatRefresh.disabled }} disabled={chatRefresh.disabled} onPress={chatRefresh.onPress} style={[styles.headerRefresh, chatRefresh.disabled && styles.headerRefreshDisabled]}>
            <Ionicons name="refresh-outline" size={22} color="#fff" />
          </TouchableOpacity>
          </View>
        ) : undefined}
      />

      {isCompact ? (
        <View style={styles.bodyColumn}>
          {fullPane ? fullPaneView : hasDetail ? detail : list}
          {!savedStory && (fullPane || !hasDetail) && sidebar}
        </View>
      ) : (
        <View style={styles.bodyRow}>
          {sidebar}
          {!fullPane && list}
          {detail}
        </View>
      )}

      <AppGuide manual={guide} onManualClose={() => setGuide(null)} />

      {pendingCharacter && <Modal transparent visible animationType="fade" onRequestClose={() => setPendingCharacter(null)}>
        <View style={styles.roomOverlay}>
          <View style={styles.roomCard} accessibilityViewIsModal>
            <Text style={styles.roomTitle}>{t('chooseChatRoom', { name: pendingCharacter.displayName[language] })}</Text>
            {(['chat', 'bond'] as const).map(value => (
              <TouchableOpacity key={value} accessibilityRole="button" style={styles.roomOption} onPress={() => {
                setSelectedCharacter(pendingCharacter);
                setRoom(value);
                setPendingCharacter(null);
              }}>
                <Text style={styles.roomOptionTitle}>{t(value === 'chat' ? 'conversationChatOnly' : 'conversationWithStory')}</Text>
                <Text style={styles.roomHint}>{t(value === 'chat' ? 'conversationChatOnlyHint' : 'conversationWithStoryHint')}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity accessibilityRole="button" style={styles.roomCancel} onPress={() => setPendingCharacter(null)}><Text style={styles.roomHint}>{t('cancel')}</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>}

      <Modal
        visible={globalLoading}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => undefined}
      >
        <View style={styles.loadingOverlay} accessibilityViewIsModal>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      </Modal>
    </View>
  );
};

export default StoryContainer;

const styles = StyleSheet.create({
  roomOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(36,32,40,0.45)' },
  roomCard: { width: '100%', maxWidth: 420, padding: 24, gap: 14, borderRadius: 18, backgroundColor: '#fff' },
  roomTitle: { fontSize: 20, fontWeight: '700', color: '#243044', marginBottom: 4 },
  roomOption: { padding: 18, gap: 8, borderRadius: 12, backgroundColor: '#f9edf1', borderWidth: 1, borderColor: '#f1dce4' },
  roomOptionTitle: { fontSize: 17, fontWeight: '700', color: '#704759' },
  roomHint: { fontSize: 14, lineHeight: 21, color: '#758297' },
  roomCancel: { alignSelf: 'flex-end', padding: 10 },
  headerRefresh: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 2 },
  headerRefreshDisabled: { opacity: 0.4 },
  container: {
    flex: 1,
    backgroundColor: '#FB94A7',
    overflow: 'hidden',
  },
  bodyRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'white',
  },
  bodyColumn: {
    flex: 1,
    backgroundColor: 'white',
  },
  list: {
    width: '32%',
    minWidth: 220,
    maxWidth: 360,
    backgroundColor: '#f4f7f8',
  },
  listCompact: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    padding: 10,
    flexGrow: 1,
  },
  detail: {
    flex: 1,
    backgroundColor: 'white',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 16,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
