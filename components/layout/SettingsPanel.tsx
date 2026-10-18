import React, { useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GeminiKeyField from './GeminiKeyField';
import ChatSoundPicker from './ChatSoundPicker';
import Constants from 'expo-constants';
import appConfig from '../../app.json';
import { checkAppUpdate, type UpdateResult } from '@/services/appUpdate';
import { getBgmVolume, setBgmVolume, subscribeBgmVolume } from '@/services/bgmVolume';
import { getSfxVolume, setSfxVolume, subscribeSfxVolume } from '@/services/sfxVolume';
import { APP_LANGUAGES, setAppLanguage } from '@/services/appLanguage';
import { useI18n } from '@/i18n';
import { setChatSize, useChatSize } from '@/services/chatSize';
import { MAX_CHAT_SIZE, MIN_CHAT_SIZE } from '@/storage/types';
import { makeChatSizeStyles } from '@/components/chat/chatSizeStyles';

const clamp = (value: number) => {
  if (!Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
};

function VolumeControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const valueRef = useRef(value);
  const trackRef = useRef<View>(null);
  valueRef.current = value;

  const setFromPress = (e: GestureResponderEvent) => {
    const pageX = e.nativeEvent.pageX;
    const node = trackRef.current as (View & { getBoundingClientRect?: () => { left: number; width: number } }) | null;
    if (!node || !Number.isFinite(pageX)) return;

    if (typeof node.getBoundingClientRect === 'function') {
      const rect = node.getBoundingClientRect();
      const scrollX = typeof window === 'undefined' ? 0 : window.scrollX;
      const next = clamp((pageX - (rect.left + scrollX)) / rect.width);
      if (next != null) onChange(next);
      return;
    }

    node.measureInWindow((left, _top, width) => {
      const next = clamp((pageX - left) / width);
      if (next != null) onChange(next);
    });
  };

  return (
    <View style={styles.control}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{Math.round(value * 100)}%</Text>
      <Pressable ref={trackRef} style={styles.track} onPress={setFromPress}>
        <View pointerEvents="none" style={[styles.fill, { width: `${value * 100}%` }]} />
      </Pressable>
      <View style={styles.stepRow}>
        <TouchableOpacity style={styles.step} onPress={() => onChange(valueRef.current - 0.1)}>
          <Text style={styles.stepText}>-</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.step} onPress={() => onChange(valueRef.current + 0.1)}>
          <Text style={styles.stepText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SettingsPanel({
  onOpenTutorial,
  onOpenTerms,
}: {
  onOpenTutorial: () => void;
  onOpenTerms: () => void;
}) {
  const { language, t } = useI18n();
  const chatSize = useChatSize();
  const chatStyles = makeChatSizeStyles(chatSize);
  const [volume, setVolume] = useState(getBgmVolume);
  const [sfx, setSfx] = useState(getSfxVolume);
  const scrollRef = useRef<ScrollView>(null);
  const [keyOffset, setKeyOffset] = useState(0);
  // Web's Expo manifest is captured when Metro starts and can lag behind
  // hot-reloaded source. Read the bundled config on web so the displayed
  // version and update comparison describe the code currently being served.
  const appVersion = Platform.OS === 'web'
    ? appConfig.expo.version
    : Constants.expoConfig?.version ?? appConfig.expo.version;
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'done' | 'error'>('idle');
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [linkError, setLinkError] = useState(false);
  const updateRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { updateRequest.current?.abort(); }, []);

  const checkUpdate = async () => {
    if (updateRequest.current) return;
    const request = new AbortController();
    updateRequest.current = request;
    setUpdateStatus('checking'); setUpdateResult(null); setLinkError(false);
    try {
      const result = await checkAppUpdate(appVersion, request.signal);
      if (!request.signal.aborted) { setUpdateResult(result); setUpdateStatus('done'); }
    } catch {
      if (!request.signal.aborted) setUpdateStatus('error');
    } finally {
      if (updateRequest.current === request) updateRequest.current = null;
    }
  };

  const openUpdate = async () => {
    if (!updateResult?.available) return;
    setLinkError(false);
    try { await Linking.openURL(updateResult.url); }
    catch { setLinkError(true); }
  };

  useEffect(() => subscribeBgmVolume(setVolume), []);
  useEffect(() => subscribeSfxVolume(setSfx), []);

  const revealApiKey = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, keyOffset - 16), animated: true });
    }, 250);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <Text style={styles.title}>{t('settings')}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>{t('language')}</Text>
        <View style={styles.languageRow}>
          {APP_LANGUAGES.map((option) => (
            <TouchableOpacity
              key={option.code}
              style={[styles.languageButton, language === option.code && styles.languageButtonActive]}
              onPress={() => setAppLanguage(option.code)}
            >
              <Text style={[styles.languageButtonText, language === option.code && styles.languageButtonTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('chatSize')}</Text>
        <Text style={styles.value} accessibilityLiveRegion="polite">{Math.round(chatSize * 100)}%</Text>
        <View style={styles.sizeActions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('decreaseChatSize')}
            disabled={chatSize <= MIN_CHAT_SIZE}
            style={[styles.step, chatSize <= MIN_CHAT_SIZE && styles.disabled]}
            onPress={() => setChatSize(chatSize - 0.1)}
          >
            <Text style={styles.stepText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('increaseChatSize')}
            disabled={chatSize >= MAX_CHAT_SIZE}
            style={[styles.step, chatSize >= MAX_CHAT_SIZE && styles.disabled]}
            onPress={() => setChatSize(chatSize + 0.1)}
          >
            <Text style={styles.stepText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetSize} accessibilityRole="button" onPress={() => setChatSize(1)}>
            <Text style={styles.guideText}>{t('resetChatSize')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>{t('chatSizeHint')}</Text>
        <View style={styles.chatPreview}>
          <Text style={[styles.previewCharacter, chatStyles.bubble]}>{t('chatPreviewCharacter')}</Text>
          <Text style={[styles.previewUser, chatStyles.bubble]}>{t('chatPreviewUser')}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('sound')}</Text>
        <VolumeControl label={t('bgm')} value={volume} onChange={(next) => setVolume(setBgmVolume(next))} />
        <VolumeControl label={t('sfx')} value={sfx} onChange={(next) => setSfx(setSfxVolume(next))} />
        <Text style={styles.hint}>{t('volumeHint')}</Text>
        <ChatSoundPicker />
      </View>

      <View style={styles.keyWrap} onLayout={(event) => setKeyOffset(event.nativeEvent.layout.y)}>
        <GeminiKeyField onFocus={revealApiKey} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('guide')}</Text>
        <View style={styles.guideRow}>
          <TouchableOpacity style={styles.guideBtn} onPress={onOpenTutorial}>
            <Text style={styles.guideText}>{t('howToUse')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.guideBtn} onPress={onOpenTerms}>
            <Text style={styles.guideText}>{t('terms')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>{t('appVersion')}</Text>
        <Text selectable style={styles.value}>{appVersion}</Text>
        <View style={styles.languageRow}>
          <TouchableOpacity accessibilityRole="button" disabled={updateStatus === 'checking'}
            style={[styles.guideBtn, updateStatus === 'checking' && styles.disabled]} onPress={() => void checkUpdate()}>
            <Text style={styles.guideText}>{t(updateStatus === 'checking' ? 'updateChecking' : 'checkUpdate')}</Text>
          </TouchableOpacity>
          {updateResult?.available && (
            <TouchableOpacity accessibilityRole="link" style={styles.guideBtn} onPress={() => void openUpdate()}>
              <Text style={styles.guideText}>{t('openUpdateDownload')}</Text>
            </TouchableOpacity>
          )}
        </View>
        {updateStatus === 'done' && updateResult && (
          <Text style={styles.hint} accessibilityLiveRegion="polite">
            {t(updateResult.available ? 'updateAvailable' : 'updateCurrent', { version: updateResult.version })}
          </Text>
        )}
        {updateStatus === 'error' && <Text style={styles.hint} accessibilityLiveRegion="polite">{t('updateCheckFailed')}</Text>}
        {linkError && <Text selectable style={styles.hint}>{t('updateOpenFailed')} {updateResult?.url}</Text>}
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#f7f4f5',
    padding: 28,
    paddingBottom: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 18,
  },
  card: {
    alignSelf: 'flex-start',
    width: 420,
    maxWidth: '100%',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eceff3',
    marginBottom: 16,
  },
  keyWrap: {
    alignSelf: 'flex-start',
    width: 420,
    maxWidth: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  control: {
    marginBottom: 8,
  },
  sizeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  disabled: { opacity: 0.35 },
  resetSize: {
    backgroundColor: '#f6eef1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chatPreview: {
    marginTop: 14,
    padding: 12,
    gap: 10,
    borderRadius: 12,
    backgroundColor: '#f7f8fa',
  },
  previewCharacter: {
    alignSelf: 'flex-start',
    maxWidth: '95%',
    color: '#fff',
    backgroundColor: '#44546A',
  },
  previewUser: {
    alignSelf: 'flex-end',
    maxWidth: '95%',
    backgroundColor: '#DCF8C6',
    color: '#222',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#243e5c',
  },
  value: {
    marginTop: 8,
    marginBottom: 14,
    fontSize: 16,
    color: '#3d6288',
  },
  track: {
    width: '100%',
    height: 14,
    borderRadius: 7,
    backgroundColor: '#d5e4f2',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#4d8ec9',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  step: {
    width: 48,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e7f1fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2d6ea8',
  },
  hint: {
    marginTop: 14,
    fontSize: 13,
    color: '#6a8298',
  },
  guideRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  guideBtn: {
    borderRadius: 12,
    backgroundColor: '#f6eef1',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  guideText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6d5360',
  },
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  languageButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d6e0e8',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  languageButtonActive: {
    borderColor: '#4d8ec9',
    backgroundColor: '#e7f1fa',
  },
  languageButtonText: {
    color: '#56708b',
    fontSize: 14,
    fontWeight: '700',
  },
  languageButtonTextActive: {
    color: '#2d6ea8',
  },
});
