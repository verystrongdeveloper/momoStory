import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useI18n } from '@/i18n';
import { getSetting } from '@/storage';
import { displayCharacterName } from '@/constants/characters';
import { subscribeChatArrivals, subscribeStoryCompletions } from '@/store/temporaryChats';
import { getVideoExportQueue, subscribeVideoExportJob } from '@/store/videoExportJob';
import { showNotification } from '@/platform/notifications';

export default function NotificationHost() {
  const { language, t } = useI18n();
  const queue = useSyncExternalStore(subscribeVideoExportJob, getVideoExportQueue, getVideoExportQueue);
  const announced = useRef(new Set<number>());
  useEffect(() => subscribeStoryCompletions(character => {
    if (!getSetting('notificationsEnabled') || !getSetting('storyNotifications')) return;
    const preview = getSetting('notificationPreview');
    void showNotification('story', t('storyNotifications'), t('notificationStoryDone'),
      preview ? displayCharacterName(character, language) : 'MomoStory', preview).catch(() => {});
  }), [language, t]);
  useEffect(() => subscribeChatArrivals(arrival => {
    if (!getSetting('notificationsEnabled') || !getSetting('chatNotifications')) return;
    if (arrival.reading && AppState.currentState === 'active') return;
    const preview = getSetting('notificationPreview');
    void showNotification('chat', t('chatNotifications'), displayCharacterName(arrival.character, language),
      preview ? arrival.message.slice(0, 240) : t('notificationNewChat'), preview).catch(() => {});
  }), [language, t]);
  useEffect(() => {
    const ids = new Set(queue.map(item => item.id));
    for (const id of announced.current) if (!ids.has(id)) announced.current.delete(id);
    for (const job of queue) {
      if ((job.status !== 'done' && job.status !== 'error') || announced.current.has(job.id)) continue;
      announced.current.add(job.id);
      if (!getSetting('notificationsEnabled') || !getSetting('exportNotifications')) continue;
      const preview = getSetting('notificationPreview');
      void showNotification('export', t('exportNotifications'), t(job.status === 'done' ? 'notificationVideoDone' : 'notificationVideoError'),
        preview ? job.title.slice(0, 240) : 'MomoStory', preview).catch(() => {});
    }
  }, [queue, t]);
  return null;
}
