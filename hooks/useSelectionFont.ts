import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';

type FontStatus = 'loading' | 'ready' | 'fallback';
let browserStatus: FontStatus = 'loading';
let browserLoad: Promise<FontStatus> | undefined;

function loadBrowserFont() {
  if (!browserLoad) {
    browserLoad = new Promise<FontStatus>(resolve => {
      // Expo's web isLoaded checks for an @font-face rule, which can exist before
      // its font data has downloaded (including during static-page hydration).
      if (typeof document === 'undefined' || !document.fonts?.load) { resolve('fallback'); return; }
      const timer = setTimeout(() => resolve('fallback'), 12000);
      void Promise.resolve().then(() => document.fonts.load('400 16px "PretendardSemiBold"', '선택지 ABC 123')).then(
        faces => { clearTimeout(timer); resolve(faces.length > 0 && faces.every(face => face.status === 'loaded') ? 'ready' : 'fallback'); },
        () => { clearTimeout(timer); resolve('fallback'); },
      );
    }).then(status => {
      // Keep failure stable so a late download cannot swap visible fallback text.
      browserStatus = status;
      return status;
    });
  }
  return browserLoad;
}

/** Shared by startup preloading and every selection, including desktop WebView. */
export function useSelectionFont(): FontStatus {
  const [loaded, error] = useFonts({
    PretendardSemiBold: require('../assets/fonts/Pretendard-SemiBold.ttf'),
  });
  const [webStatus, setWebStatus] = useState<FontStatus>(browserStatus);
  useEffect(() => {
    if (Platform.OS !== 'web' || !loaded || error) return;
    let active = true;
    void loadBrowserFont().then(status => { if (active) setWebStatus(status); });
    return () => { active = false; };
  }, [loaded, error]);
  if (error) return 'fallback';
  if (!loaded) return 'loading';
  return Platform.OS === 'web' ? webStatus : 'ready';
}
