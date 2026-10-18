import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { useI18n } from '@/i18n';
import { useChatSound, setChatSound } from '@/services/chatSound';
import { getSfxVolume } from '@/services/sfxVolume';
import { chatSoundSources } from '@/constants/chatSounds';
import { CHAT_SOUND_IDS, chatSoundKey } from '@/utils/chatPresentation';

export default function ChatSoundPicker() {
  const { t } = useI18n();
  const selected = useChatSound();
  const [open, setOpen] = useState(false);
  const player = useAudioPlayer(selected === 'none' ? null : chatSoundSources[chatSoundKey(selected)], { updateInterval: 50, keepAudioSessionActive: true });
  const { isLoaded } = useAudioPlayerStatus(player);
  const current = useRef<AudioPlayer | null>(null);
  const request = useRef(0);
  const [error, setError] = useState(false);
  useEffect(() => { request.current++; try { current.current?.pause(); } catch { /* released */ } }, [selected]);
  useEffect(() => () => { request.current++; try { current.current?.pause(); } catch { /* released */ } }, []);
  const preview = async (player: AudioPlayer) => {
    const token = ++request.current;
    setError(false);
    try {
      current.current?.pause();
      current.current = player;
      const volume = getSfxVolume();
      player.volume = volume > 0 ? volume : 0.5;
      await player.seekTo(0);
      if (request.current === token) player.play();
    } catch { if (request.current === token) setError(true); }
  };
  return (
    <View>
      <Text style={styles.heading}>{t('chatSound')}</Text>
      <Text style={styles.hint}>{t('chatSoundHint')}</Text>
      <View style={styles.row}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('chatSound')} accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)} style={styles.choice}>
          <Text numberOfLines={1} style={[styles.label, styles.choiceLabel]}>{t(`chatSound_${selected}`)}</Text>
          <Text style={styles.label}>▾</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('previewChatSound', { name: t(`chatSound_${selected}`) })}
          disabled={selected === 'none' || !isLoaded} onPress={() => void preview(player)}
          style={[styles.preview, (selected === 'none' || !isLoaded) && styles.disabled]}>
          <Text style={styles.label}>▶ {t('previewSound')}</Text>
        </TouchableOpacity>
      </View>
      {open && <Modal transparent visible animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop} accessibilityViewIsModal>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel={t('close')} />
          <View style={styles.menu}>
            <Text style={styles.menuHeading}>{t('chatSound')}</Text>
            <ScrollView accessibilityRole="radiogroup" accessibilityLabel={t('chatSound')}>
              {CHAT_SOUND_IDS.map(id => <TouchableOpacity key={id} accessibilityRole="radio" accessibilityLabel={t(`chatSound_${id}`)}
                accessibilityState={{ checked: id === selected }} onPress={() => { setChatSound(id); setOpen(false); }}
                style={[styles.option, id === selected && styles.selected]}>
                <Text style={styles.label}>{t(`chatSound_${id}`)}</Text>
                {id === selected && <Text style={styles.label}>✓</Text>}
              </TouchableOpacity>)}
            </ScrollView>
            <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}>
              <Text style={styles.label}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>}
      {error && <Text accessibilityLiveRegion="polite" style={styles.hint}>{t('soundPreviewFailed')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 15, fontWeight: '700', color: '#243e5c', marginTop: 18 },
  hint: { fontSize: 12, lineHeight: 18, color: '#6a8298', marginTop: 8, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  choice: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#d6e0e8', padding: 10, borderRadius: 10, backgroundColor: '#f8fafc' },
  choiceLabel: { flex: 1 },
  selected: { borderColor: '#4d8ec9', backgroundColor: '#e7f1fa' },
  preview: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, backgroundColor: '#f6eef1' },
  label: { fontSize: 13, fontWeight: '600', color: '#3d6288' },
  disabled: { opacity: 0.4 },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#18202b66' },
  menu: { width: 340, maxWidth: '100%', maxHeight: '80%', padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  menuHeading: { fontSize: 16, fontWeight: '700', color: '#243e5c', marginBottom: 12 },
  option: { minHeight: 44, padding: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { alignSelf: 'flex-end', padding: 10, marginTop: 8 },
});
