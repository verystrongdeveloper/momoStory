import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { bgMap, emotionMap, expressionMap, musicMap, sfxMap } from '@/constants/eventAssets';
import { getSfxVolume } from '@/services/sfxVolume';
import { AssetKind } from '@/utils/insertStoryAsset';
import { useI18n } from '@/i18n';

type Category = AssetKind;

const CATEGORIES: { id: Category; label: 'background' | 'emotion' | 'music' | 'soundEffect' | 'effect' }[] = [
  { id: 'bg', label: 'background' },
  { id: 'emotion', label: 'emotion' },
  { id: 'music', label: 'music' },
  { id: 'sound', label: 'soundEffect' },
  { id: 'expression', label: 'effect' },
];

/** 긴 접두사를 먼저 맞춰 표정 파일을 묶는다. */
const EMOTION_GROUPS: { label: string; prefixes: string[] }[] = [
  { label: '호시노', prefixes: ['hoshino_'] },
  { label: '히나', prefixes: ['hina_'] },
  { label: '마리', prefixes: ['mari_'] },
  { label: '시로코', prefixes: ['shiroko_'] },
  { label: '세리카', prefixes: ['serika_'] },
  { label: '노노미', prefixes: ['nonomi_'] },
  { label: '아야네', prefixes: ['ayane_'] },
  { label: '이부키', prefixes: ['ibuki_'] },
  { label: '코하루', prefixes: ['koharu_'] },
  { label: '아리스', prefixes: ['aris_'] },
  { label: '유우카', prefixes: ['yuuka_'] },
  { label: '아코', prefixes: ['ako_'] },
  { label: '츠루기', prefixes: ['tsurugi_'] },
  { label: '로봇', prefixes: ['robot_'] },
  { label: '게헨나 학생', prefixes: ['gehenna_student_'] },
  { label: '선도부', prefixes: ['prefect_team_member_'] },
  { label: '발키리', prefixes: ['valkyrie_student_'] },
  { label: '백귀야행', prefixes: ['hyakkiyako_student_'] },
  { label: '현룡문', prefixes: ['genryumon_student_'] },
  { label: '정의실현부', prefixes: ['justice_task_force_member_'] },
  { label: '시민', prefixes: ['citizen_'] },
  { label: '적', prefixes: ['sukeban_', 'kaiser_', 'saint_', 'small_amas'] },
];

const fileName = (key: string, ext: string) => (key.endsWith(ext) ? key : `${key}${ext}`);

const BG_FILES = Object.keys(bgMap).map((key) => fileName(key, '.jpg'));
const MUSIC_FILES = ['none', ...Object.keys(musicMap)];
const SOUND_FILES = Object.keys(sfxMap);
const EXPRESSION_FILES = Object.keys(expressionMap);

const emotionExt = (key: string) => (key.startsWith('hina_') ? '.jpg' : '.png');

const imageOf = (category: Category, file: string) => {
  if (category === 'bg') return bgMap[file.replace(/\.jpg$/i, '')];
  if (category === 'emotion') return emotionMap[file.replace(/\.(png|jpe?g)$/i, '')];
  if (category === 'expression') return expressionMap[file];
  return undefined;
};

const emotionGroups = EMOTION_GROUPS.map((group) => ({
  label: group.label,
  files: Object.keys(emotionMap)
    .filter((key) => group.prefixes.some((prefix) => key.startsWith(prefix)))
    .map((key) => fileName(key, emotionExt(key))),
})).filter((group) => group.files.length > 0);

interface Props {
  character: string;
  onInsert: (kind: AssetKind, file: string) => void;
  fullWidth?: boolean;
}

export default function StoryAssetPanel({ character, onInsert, fullWidth = false }: Props) {
  const { t } = useI18n();
  const [category, setCategory] = useState<Category>('bg');
  const [owner, setOwner] = useState(() => emotionGroups.find((group) => group.label === character)?.label ?? emotionGroups[0]?.label ?? '');
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const [mobilePreviewFile, setMobilePreviewFile] = useState<string | null>(null);
  const preview = hovered ? imageOf(category, hovered) : undefined;
  const previewSound = useRef<AudioPlayer | null>(null);
  const suppressNextInsert = useRef(false);

  const closeMobilePreview = () => {
    setMobilePreviewFile(null);
    setHovered(null);
    suppressNextInsert.current = false;
  };

  const openMobilePreview = (file: string) => {
    suppressNextInsert.current = true;
    setHovered(file);
    setMobilePreviewFile(file);
  };

  const insertAsset = (file: string) => {
    if (suppressNextInsert.current) {
      suppressNextInsert.current = false;
      return;
    }
    onInsert(category, file);
  };

  useEffect(() => {
    const src =
      category === 'music' && hovered && hovered !== 'none'
        ? musicMap[hovered as keyof typeof musicMap]
        : category === 'sound' && hovered
          ? sfxMap[hovered as keyof typeof sfxMap]
          : undefined;

    const stop = (player: AudioPlayer | null) => {
      if (!player) return;
      try {
        player.pause();
        player.remove();
      } catch {
        /* 이미 정리된 소리 */
      }
    };

    if (!src) {
      const prev = previewSound.current;
      previewSound.current = null;
      stop(prev);
      return;
    }

    const player = createAudioPlayer(src);
    player.loop = category === 'music';
    player.volume = category === 'sound' ? getSfxVolume() : 1;
    previewSound.current = player;
    try {
      player.play();
    } catch {
      /* 브라우저가 재생을 막으면 미리듣기를 건너뛴다 */
    }

    return () => {
      if (previewSound.current === player) previewSound.current = null;
      stop(player);
    };
  }, [category, hovered]);

  const files = useMemo(() => {
    const source =
      category === 'bg'
        ? BG_FILES
        : category === 'music'
          ? MUSIC_FILES
          : category === 'sound'
            ? SOUND_FILES
            : category === 'expression'
              ? EXPRESSION_FILES
              : emotionGroups.find((group) => group.label === owner)?.files ?? [];
    const q = query.trim().toLowerCase();
    return q ? source.filter((file) => file.toLowerCase().includes(q)) : source;
  }, [category, owner, query]);

  return (
    <View style={[styles.panel, fullWidth && styles.panelFullWidth]}>
      <Text style={styles.heading}>{t('assets')}</Text>
      <Text style={styles.hint}>
        {t('assetHint')}
        {category === 'music' || category === 'sound' ? t('audioHint') : ''}
      </Text>
      <View style={styles.chips}>
        {CATEGORIES.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => {
              setCategory(item.id);
              setHovered(null);
              setMobilePreviewFile(null);
            }}
            style={[styles.chip, category === item.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, category === item.id && styles.chipTextOn]}>{t(item.label)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {category === 'emotion' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ownerScroll} contentContainerStyle={styles.ownerChips}>
          {emotionGroups.map((group) => (
            <TouchableOpacity
              key={group.label}
              onPress={() => setOwner(group.label)}
              style={[styles.chip, owner === group.label && styles.chipOn]}
            >
              <Text style={[styles.chipText, owner === group.label && styles.chipTextOn]}>{group.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('searchName')}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <ScrollView style={styles.list}>
        {files.map((file) => (
          <Pressable
            key={file}
            onPress={() => insertAsset(file)}
            onLongPress={fullWidth ? () => openMobilePreview(file) : undefined}
            delayLongPress={350}
            onHoverIn={() => setHovered(file)}
            onHoverOut={() => setHovered((current) => (current === file ? null : current))}
            style={styles.fileBtn}
          >
            <Text style={styles.fileText}>{file}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {preview && <Image source={preview} resizeMode="contain" pointerEvents="none" style={styles.preview} />}
      <Modal
        transparent
        visible={mobilePreviewFile != null}
        animationType="fade"
        onRequestClose={closeMobilePreview}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeMobilePreview}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('previewAsset')}</Text>
            <Text style={styles.modalFileName}>{mobilePreviewFile}</Text>
            {mobilePreviewFile && imageOf(category, mobilePreviewFile) ? (
              <Image source={imageOf(category, mobilePreviewFile)} resizeMode="contain" style={styles.modalImage} />
            ) : (
              <View style={styles.audioPreview}>
                <Text style={styles.audioPreviewText}>
                  {mobilePreviewFile === 'none' ? t('noBackgroundMusic') : t('playingPreview')}
                </Text>
              </View>
            )}
            <Text style={styles.modalHint}>{t('tapOutside')}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 300,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e6ea',
    backgroundColor: '#fff',
    padding: 12,
    overflow: 'visible',
    zIndex: 2,
  },
  panelFullWidth: {
    width: '100%',
    flex: 1,
  },
  preview: {
    position: 'fixed',
    left: '50%',
    top: '50%',
    width: 760,
    height: 480,
    marginLeft: -380,
    marginTop: -240,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e6ea',
    backgroundColor: '#1b1e24',
    zIndex: 20,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(20, 24, 32, 0.7)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  modalTitle: {
    color: '#222',
    fontSize: 18,
    fontWeight: '800',
  },
  modalFileName: {
    marginTop: 6,
    color: '#6d7681',
    fontSize: 13,
  },
  modalImage: {
    width: '100%',
    height: 360,
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#1b1e24',
  },
  audioPreview: {
    minHeight: 180,
    marginTop: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f3f5f7',
  },
  audioPreviewText: {
    color: '#59636f',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalHint: {
    marginTop: 14,
    color: '#8a929c',
    fontSize: 12,
    textAlign: 'center',
  },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },
  hint: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    color: '#888',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ownerScroll: {
    marginTop: 8,
    maxHeight: 36,
    flexGrow: 0,
  },
  ownerChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f4f7f8',
  },
  chipOn: {
    backgroundColor: '#FB94A7',
  },
  chipText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '700',
  },
  chipTextOn: {
    color: '#fff',
  },
  search: {
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e6ea',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  list: {
    flex: 1,
  },
  fileBtn: {
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f4',
  },
  fileText: {
    fontSize: 12,
    color: '#333',
  },
});
