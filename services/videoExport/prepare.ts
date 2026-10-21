import { bgMap, emotionMap, expressionMap, musicMap, sfxMap } from '@/constants/eventAssets';
import { avatarOf, displayCharacterName } from '@/constants/characters';
import { getSpriteAspectRatio } from '@/constants/spriteLayout';
import { videoAssetUrl } from '@/platform/videoAsset';
import { getSetting } from '@/storage';
import type { AppLanguage, StoryRecord } from '@/storage/types';
import { buildVideoTimeline, type VideoRatio } from './timeline';
import { checkAborted, type ExportOptions, type VideoPayload } from './types';
import { normalizeChatSound } from '../../utils/chatPresentation';
import { chatSoundSources } from '@/constants/chatSounds';
import { MAX_VIDEO_SECONDS } from './limits';

export async function prepareVideo(
  story: StoryRecord, ratio: VideoRatio, language: AppLanguage,
  labels: VideoPayload['labels'], options: ExportOptions,
): Promise<VideoPayload> {
  const timeline = buildVideoTimeline(story, getSetting('bgmVolume'), getSetting('sfxVolume'), normalizeChatSound(getSetting('chatSound')), options.includeChat !== false);
  if (timeline.duration > MAX_VIDEO_SECONDS) throw new Error('VIDEO_TOO_LONG');
  const images: Record<string, string> = {};
  const sounds: Record<string, string> = {};
  const spriteAspects: Record<string, number> = {};
  const tasks = new Map<string, { source: Parameters<typeof videoAssetUrl>[0]; mime: string; target: Record<string, string> }>();
  const image = (kind: string, key: string | undefined, map: Record<string, number>) => {
    if (key && map[key]) tasks.set(`${kind}:${key}`, { source: map[key], mime: /\.jpe?g$/i.test(key) || kind === 'bg' || key.startsWith('hina_') ? 'image/jpeg' : 'image/png', target: images });
  };
  for (const scene of timeline.scenes) {
    image('bg', scene.background, bgMap);
    image('emotion', scene.emotion, emotionMap);
    image('expression', scene.expression?.key ?? scene.line?.expression, expressionMap);
    if (scene.emotion && emotionMap[scene.emotion]) spriteAspects[scene.emotion] = getSpriteAspectRatio(scene.emotion, emotionMap[scene.emotion]);
  }
  const avatar = timeline.messages.length ? avatarOf(story.character) : undefined;
  if (typeof avatar === 'number' || (avatar && !Array.isArray(avatar) && 'uri' in avatar && typeof avatar.uri === 'string')) {
    tasks.set('avatar', { source: avatar as Parameters<typeof videoAssetUrl>[0], mime: 'image/jpeg', target: images });
  }
  for (const cue of timeline.audio) {
    if (chatSoundSources[cue.key]) {
      tasks.set(`sfx:${cue.key}`, { source: chatSoundSources[cue.key], mime: 'audio/wav', target: sounds });
      continue;
    }
    const map = cue.loop ? musicMap : sfxMap;
    if (map[cue.key]) tasks.set(`${cue.loop ? 'music' : 'sfx'}:${cue.key}`, { source: map[cue.key], mime: /\.wav$/i.test(cue.key) ? 'audio/wav' : 'audio/mpeg', target: sounds });
  }
  let done = 0;
  // Sequential loading bounds native bridge memory and avoids downloading unused artwork.
  for (const [key, task] of tasks) {
    checkAborted(options.signal);
    task.target[key] = await videoAssetUrl(task.source, task.mime);
    options.onProgress({ phase: 'preparing', progress: (++done / (tasks.size + 1)) * 0.1 });
  }
  const font = await videoAssetUrl(require('../../assets/fonts/Pretendard-SemiBold.ttf'), 'font/ttf');
  checkAborted(options.signal);
  return { title: story.title, name: displayCharacterName(story.character, language), ratio, quality: options.quality ?? '720p', chatSize: getSetting('chatSize'), timeline, images, spriteAspects, sounds, font, labels };
}
