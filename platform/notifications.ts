import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

type NotificationBridge = {
  enabled(): Promise<boolean>;
  openSettings(): Promise<void>;
  clear(): Promise<void>;
  show(kind: string, channel: string, title: string, body: string, preview: boolean): Promise<boolean>;
  showChat?(channel: string, title: string, body: string, preview: boolean, character: string): Promise<boolean>;
};
const bridge = (): NotificationBridge | undefined => Platform.OS === 'android' ? NativeModules.MomoNotifications : undefined;
export const notificationsSupported = () => !!bridge();
export const notificationsAllowed = async () => bridge()?.enabled() ?? false;
export async function requestNotifications() {
  if (!bridge()) return false;
  if (Number(Platform.Version) >= 33) {
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (!(await PermissionsAndroid.check(permission))) {
      const result = await PermissionsAndroid.request(permission);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }
  }
  return notificationsAllowed();
}
export const openNotificationSettings = async () => { await bridge()?.openSettings(); };
export const clearNotifications = async () => { await bridge()?.clear(); };
export async function showNotification(kind: 'chat' | 'story' | 'export' | 'test', channel: string, title: string, body: string, preview = false, character?: string) {
  const native = bridge();
  if (kind === 'chat' && character && native?.showChat) {
    return native.showChat(channel, title, body, preview, character);
  }
  return await native?.show(kind, channel, title, body, preview) ?? false;
}
