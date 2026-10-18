import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import GreetModeToggle from './GreetModeToggle';
import StoryHeader from './StoryHeader';
import StorySidebar from './StorySidebar';
import ChatEntry from '@/components/chat/ChatEntry';
import CharacterChat from '@/components/chat/CharacterChat';
import StoryLibraryList from '@/components/chat/StoryLibraryList';
import SettingsPanel from './SettingsPanel';
import CommunityPanel from '@/components/community/CommunityPanel';
import AppGuide, { GuideMode } from '@/components/guide/AppGuide';
import { avatarOf, CHARACTERS, Character, displayCharacterName } from '@/constants/characters';
import type { SavedStory } from '@/store/storyLibrary';
import { useLayout } from '@/hooks/useLayout';
import { useI18n } from '@/i18n';

/** characters: 1:1 캐릭터 목록  |  library: 저장된 스토리  |  settings: 설정 */
type ListPanel = 'characters' | 'library' | 'community' | 'settings';

const StoryContainer: React.FC = () => {
  const { language, t } = useI18n();
  const { isCompact } = useLayout();
  const [listPanel, setListPanel] = useState<ListPanel>('characters');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [savedStory, setSavedStory] = useState<SavedStory | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [guide, setGuide] = useState<GuideMode | null>(null);

  const hasDetail = selectedCharacter !== null;
  const detailTitle = selectedCharacter?.displayName[language];

  const closeDetail = () => {
    setSelectedCharacter(null);
  };

  const openCharacter = (char: Character) => {
    setSelectedCharacter(char);
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
    <CharacterChat
      key={savedStory.id}
      characterName={savedStory.character}
      displayName={displayCharacterName(savedStory.character, language)}
      characterImage={avatarOf(savedStory.character)}
      savedStory={savedStory}
    />
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
          key={selectedCharacter.name}
          characterName={selectedCharacter.name}
          displayName={selectedCharacter.displayName[language]}
          characterImage={selectedCharacter.image}
          setGlobalLoading={setGlobalLoading}
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
        title={libraryOpen && savedStory ? displayCharacterName(savedStory.character, language) : isCompact ? detailTitle : undefined}
        onBack={libraryOpen && savedStory ? () => setSavedStory(null) : isCompact && hasDetail ? closeDetail : undefined}
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
