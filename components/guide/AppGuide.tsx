import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSetting, isStorageSynced, saveSetting, subscribeStorage } from '@/storage';
import { useI18n } from '@/i18n';
import type { AppLanguage } from '@/storage/types';
import { getTutorialContent } from './tutorialContent';
import { APP_LANGUAGES, setAppLanguage } from '@/services/appLanguage';
import { onboardingContent } from './onboardingContent';

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
  settings: 'settings-outline', display: 'phone-portrait-outline', sound: 'volume-medium-outline',
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
  const [languageConfirmed, setLanguageConfirmed] = useState(false);
  const onboarding = onboardingContent[language];

  const mode: GuideMode | 'language' | null = manual ?? (!synced ? null : !termsAccepted ? (languageConfirmed ? 'terms' : 'language') : !tutorialSeen ? 'tutorial' : null);

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
          <Text style={styles.headerTitle}>{mode === 'language' ? onboarding.languageTitle : mode === 'terms' ? t('termsTitle') : t('tutorialTitle')}</Text>
          {mode === 'tutorial' ? (
            <Text style={styles.headerCount}>
              {step + 1} / {steps.length}
            </Text>
          ) : null}
        </View>

        {mode === 'language' ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.lead}>{onboarding.languageHint}</Text>
            {APP_LANGUAGES.map(option => (
              <TouchableOpacity
                key={option.code}
                accessibilityRole="radio"
                accessibilityState={{ selected: language === option.code }}
                style={[styles.languageOption, language === option.code && styles.languageOptionActive]}
                onPress={() => setAppLanguage(option.code)}
              >
                <Text style={styles.languageLabel}>{option.label}</Text>
                {language === option.code && <Ionicons name="checkmark-circle" size={22} color="#b84063" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : mode === 'terms' ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.lead}>{onboarding.termsLead}</Text>
            {onboarding.terms.map(section => (
              <React.Fragment key={section.title}>
                <Text style={styles.section}>{section.title}</Text>
                <Text style={styles.body}>{section.body}</Text>
              </React.Fragment>
            ))}
          </ScrollView>
        ) : (
          <ScrollView key={current.id} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.section}>{current.title}</Text>
            {current.body}
          </ScrollView>
        )}

        {mode === 'language' ? (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.primary} onPress={() => setLanguageConfirmed(true)}>
              <Text style={styles.primaryText}>{onboarding.continueLabel}</Text>
            </TouchableOpacity>
          </View>
        ) : mode === 'terms' ? (
          <View style={styles.footer}>
            {!termsAccepted ? (
              <>
                {!manual && (
                  <TouchableOpacity style={styles.ghost} onPress={() => { setAgreed(false); setLanguageConfirmed(false); }}>
                    <Text style={styles.ghostText}>{onboarding.changeLanguage}</Text>
                  </TouchableOpacity>
                )}
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
  languageOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#eadfe3', borderRadius: 12,
    padding: 16, marginBottom: 10, minHeight: 56,
  },
  languageOptionActive: { borderColor: '#b84063', backgroundColor: '#fff0f4' },
  languageLabel: { fontSize: 16, color: '#243044', fontWeight: '600' },
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
