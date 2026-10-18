import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSetting, isStorageSynced, saveSetting, subscribeStorage } from '@/storage';
import { useI18n } from '@/i18n';
import type { AppLanguage } from '@/storage/types';
import { getTutorialContent } from './tutorialContent';

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

export type GuideMode = 'terms' | 'tutorial';

type Step = {
  id: string;
  title: string;
  body: React.ReactNode;
};

const openAiStudio = () => {
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    const opened = window.open(AI_STUDIO_URL, '_blank', 'noopener,noreferrer');
    if (opened) return;
  }
  void Linking.openURL(AI_STUDIO_URL);
};

function IconLine({ name, label, text }: { name: keyof typeof Ionicons.glyphMap; label: string; text: string }) {
  return (
    <View style={styles.iconLine}>
      <View style={styles.iconBadge}>
        <Ionicons name={name} size={18} color="#ffffff" />
      </View>
      <Text style={[styles.body, styles.iconText]}>
        <Text style={styles.strong}>{label}</Text>
        {text}
      </Text>
    </View>
  );
}

const tutorialIcons: Partial<Record<string, keyof typeof Ionicons.glyphMap>> = {
  key: 'settings-outline', chat: 'person-outline', library: 'library-outline', community: 'people-outline',
};

function tutorialSteps(language: AppLanguage, aiStudioLabel: string): Step[] {
  return getTutorialContent(language).map(page => ({
    id: page.id,
    title: page.title,
    body: <>
      {page.paragraphs.map((paragraph, index) => index === 0 && tutorialIcons[page.id]
        ? <IconLine key={index} name={tutorialIcons[page.id]!} label="" text={paragraph} />
        : <Text key={index} style={styles.body}>{paragraph}</Text>)}
      {page.aiStudio && <>
        <TouchableOpacity style={styles.linkBtn} onPress={openAiStudio}>
          <Text style={styles.linkText}>{aiStudioLabel}</Text>
        </TouchableOpacity>
        <Text selectable style={styles.url}>{AI_STUDIO_URL}</Text>
      </>}
    </>,
  }));
}

export default function AppGuide({
  manual,
  onManualClose,
}: {
  manual: GuideMode | null;
  onManualClose: () => void;
}) {
  const { language, t } = useI18n();
  const synced = useSyncExternalStore(subscribeStorage, isStorageSynced, () => false);
  const termsAccepted = useSyncExternalStore(subscribeStorage, () => getSetting('termsAccepted'), () => false);
  const tutorialSeen = useSyncExternalStore(subscribeStorage, () => getSetting('tutorialSeen'), () => false);
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);

  const mode: GuideMode | null = manual ?? (!synced ? null : !termsAccepted ? 'terms' : !tutorialSeen ? 'tutorial' : null);

  useEffect(() => {
    if (mode !== 'tutorial') return;
    setStep(0);
  }, [mode]);

  if (!mode) return null;

  const acceptTerms = () => {
    saveSetting('termsAccepted', true);
    setAgreed(false);
    if (manual === 'terms') onManualClose();
  };

  const finishTutorial = () => {
    if (!tutorialSeen) saveSetting('tutorialSeen', true);
    if (manual) onManualClose();
  };

  const steps = tutorialSteps(language, t('openAiStudio'));
  const last = step >= steps.length - 1;
  const current = steps[step];

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{mode === 'terms' ? t('termsTitle') : t('tutorialTitle')}</Text>
          {mode === 'tutorial' ? (
            <Text style={styles.headerCount}>
              {step + 1} / {steps.length}
            </Text>
          ) : null}
        </View>

        {mode === 'terms' ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.lead}>
              MomoStory는 넥슨게임즈의 「블루 아카이브」를 바탕으로 한 비공식 2차 창작물입니다. 계속하려면 아래 내용을 확인하고 동의해 주세요.
            </Text>
            <Text style={styles.section}>2차 창작</Text>
            <Text style={styles.body}>
              이 프로그램은 팬이 만든 비상업적 2차 창작이며, 넥슨 또는 넥슨게임즈의 공식 서비스가 아닙니다. 개발사·배급사와 관련이 없습니다.
            </Text>
            <Text style={styles.section}>권리</Text>
            <Text style={styles.body}>
              블루 아카이브의 명칭, 캐릭터, 이미지, 음악, 설정에 대한 권리는 넥슨게임즈와 해당 권리자에게 있습니다.
            </Text>
            <Text style={styles.section}>이용</Text>
            <Text style={styles.body}>
              개인적인 감상과 팬 활동으로만 이용합니다. 판매하거나, 공식 자료인 것처럼 안내하거나, 상업적으로 이용하지 않습니다.
            </Text>
            <Text style={styles.section}>삭제</Text>
            <Text style={styles.body}>
              권리자의 요청이 있거나 문제가 될 경우, 이 프로그램과 관련 자료는 예고 없이 배포가 중단되고 삭제될 수 있습니다.
            </Text>
            <Text style={styles.section}>API 키와 대화</Text>
            <Text style={styles.body}>
              Gemini API 키는 이용자가 직접 발급해 입력합니다. 키 기억하기를 켜면 이 기기에만 저장됩니다. 대화와 스토리 생성 내용은 그 키를 통해 Google Gemini로 전달됩니다.
            </Text>
            <Text style={styles.section}>생성된 내용</Text>
            <Text style={styles.body}>AI가 만든 대사와 스토리는 공식 설정과 다를 수 있습니다.</Text>
          </ScrollView>
        ) : (
          <ScrollView key={current.id} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.section}>{current.title}</Text>
            {current.body}
          </ScrollView>
        )}

        {mode === 'terms' ? (
          <View style={styles.footer}>
            {!termsAccepted ? (
              <>
                <Pressable style={styles.checkRow} onPress={() => setAgreed((value) => !value)}>
                  <View style={[styles.check, agreed && styles.checkOn]}>
                    {agreed ? <Ionicons name="checkmark" size={16} color="#ffffff" /> : null}
                  </View>
                  <Text style={styles.checkText}>{t('agreeTerms')}</Text>
                </Pressable>
                <TouchableOpacity
                  style={[styles.primary, !agreed && styles.primaryOff]}
                  disabled={!agreed}
                  onPress={acceptTerms}
                >
                  <Text style={styles.primaryText}>{t('agreeStart')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.primary} onPress={onManualClose}>
                <Text style={styles.primaryText}>{t('close')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.footer}>
            <View style={styles.dots}>
              {steps.map((item, index) => (
                <View key={item.id} style={[styles.dot, index === step && styles.dotOn]} />
              ))}
            </View>
            <View style={styles.row}>
              <TouchableOpacity onPress={finishTutorial} style={styles.ghost}>
                <Text style={styles.ghostText}>{t('skip')}</Text>
              </TouchableOpacity>
              <View style={styles.rowRight}>
                {step > 0 ? (
                  <TouchableOpacity onPress={() => setStep((value) => value - 1)} style={styles.secondary}>
                    <Text style={styles.secondaryText}>{t('previous')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => (last ? finishTutorial() : setStep((value) => value + 1))}
                  style={styles.primaryInline}
                >
                  <Text style={styles.primaryText}>{last ? t('start') : t('next')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    backgroundColor: 'rgba(36, 32, 40, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '88%',
    flexShrink: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FB94A7',
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerCount: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    maxHeight: 460,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 8,
  },
  lead: {
    fontSize: 15,
    lineHeight: 23,
    color: '#243044',
    marginBottom: 8,
  },
  section: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 15,
    fontWeight: '700',
    color: '#243e5c',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: '#3c4654',
    flexShrink: 1,
  },
  strong: {
    fontWeight: '700',
    color: '#243044',
  },
  stepLine: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 22,
    color: '#3c4654',
  },
  note: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: '#6a5a62',
  },
  linkBtn: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: '#4C5B70',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  linkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  url: {
    marginTop: 8,
    fontSize: 12,
    color: '#6a8298',
  },
  iconLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#4C5B70',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0e4e8',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#c9b4bc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkOn: {
    backgroundColor: '#FB94A7',
    borderColor: '#FB94A7',
  },
  checkText: {
    flex: 1,
    fontSize: 14,
    color: '#243044',
  },
  primary: {
    backgroundColor: '#FB94A7',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryOff: {
    opacity: 0.45,
  },
  primaryInline: {
    backgroundColor: '#FB94A7',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#eadfe3',
  },
  dotOn: {
    backgroundColor: '#FB94A7',
    width: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ghost: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  ghostText: {
    color: '#8a7580',
    fontSize: 14,
  },
  secondary: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f6eef1',
  },
  secondaryText: {
    color: '#6d5360',
    fontSize: 15,
    fontWeight: '700',
  },
});
