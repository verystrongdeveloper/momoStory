import { Linking } from 'react-native';

/** Desktop WebViews must ask the OS to open links in the default browser. */
export async function openExternalUrl(url: string): Promise<void> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }
  await Linking.openURL(url);
}
