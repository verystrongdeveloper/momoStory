import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { registerAppShell } from '@/platform/pwa';
import { hydrateStorage } from '@/storage';
import { I18nProvider } from '@/i18n';
import StartupUpdatePrompt from '@/components/layout/StartupUpdatePrompt';

export default function RootLayout() {
  useEffect(() => {
    void hydrateStorage();
    registerAppShell();
  }, []);

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="event" />
          <Stack.Screen name="+not-found" options={{ headerShown: true }} />
        </Stack>
        <StartupUpdatePrompt />
        <StatusBar style="auto" />
      </I18nProvider>
    </SafeAreaProvider>
  );
}
