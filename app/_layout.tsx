import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSelectionFont } from '@/hooks/useSelectionFont';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { registerAppShell } from '@/platform/pwa';
import { hydrateStorage } from '@/storage';
import { I18nProvider } from '@/i18n';
import StartupUpdatePrompt from '@/components/layout/StartupUpdatePrompt';
import VideoExportHost from '@/components/layout/VideoExportHost';
import NotificationHost from '@/components/layout/NotificationHost';
import { useScreenOrientation } from '@/services/screenOrientation';

export default function RootLayout() {
  useSelectionFont();
  const orientation = useScreenOrientation();

  useEffect(() => {
    void hydrateStorage();
    registerAppShell();
  }, []);

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <Stack screenOptions={{ headerShown: false, orientation: 'portrait_up' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="event" options={{ orientation: orientation === 'landscape' ? 'landscape' : 'portrait_up' }} />
          <Stack.Screen name="+not-found" options={{ headerShown: true }} />
        </Stack>
        <VideoExportHost />
        <NotificationHost />
        <StartupUpdatePrompt />
        <StatusBar style="auto" />
      </I18nProvider>
    </SafeAreaProvider>
  );
}
