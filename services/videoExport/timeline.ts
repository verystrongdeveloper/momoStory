import type { EventLine } from '@/types/EventLine';
import type { SavedChatMessage, StoryRecord } from '@/storage/types';
import parseEventScript from '@/utils/parseEventScript';
import { EVENT_TIMING } from '../../utils/eventPresentation';
import { CHAT_POP_DURATION, chatSoundKey, type ChatSoundId } from '../../utils/chatPresentation';

export type VideoRatio = '16:9' | '9:16';
export type VideoScene = {
  start: number;
  duration: number;
  kind: 'chat' | 'story';
  chatCount?: number;
  showStoryButton?: boolean;
  line?: EventLine;
  background?: string;
  emotion?: string;
  previous?: EventLine;
  expression?: { key: string; start: number };
  animation?: { type: string; start: number };
  backgroundTransition?: 'out' | 'in';
};
export type AudioCue = { key: string; start: number; end: number; loop: boolean; volume: number };
export type VideoTimeline = {
  scenes: VideoScene[];
  audio: AudioCue[];
  duration: number;
  messages: SavedChatMessage[];
};

export function buildVideoTimeline(story: StoryRecord, bgmVolume: number, sfxVolume: number, chatSound: ChatSoundId = 'pop', includeChat = true): VideoTimeline {
  const messages = includeChat ? story.chatMessages ?? [] : [];
  const scenes: VideoScene[] = [];
  const audio: AudioCue[] = [];
  let time = 0;
  let background: string | undefined;
  let emotion: string | undefined;
  let previous: EventLine | undefined;
  let music: AudioCue | undefined;
  let expression: VideoScene['expression'];
  let animation: VideoScene['animation'];
  const append = (scene: Omit<VideoScene, 'start'>) => {
    scenes.push({ ...scene, start: time });
    time += scene.duration;
  };
  const stopMusic = () => {
    if (music) music.end = time;
    music = undefined;
  };
  for (let index = 0; index < messages.length; index++) {
    if (chatSound !== 'none') audio.push({ key: chatSoundKey(chatSound), start: time, end: time + CHAT_POP_DURATION, loop: false, volume: sfxVolume });
    append({ kind: 'chat', chatCount: index + 1, duration: Math.max(1.5, messages[index].text.length * 0.03 + 1) });
  }
  if (messages.length) append({ kind: 'chat', chatCount: messages.length, showStoryButton: true, duration: 1.5 });
  const lines = parseEventScript(story.script);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.bg && background && line.bg !== background) {
      const transition = { kind: 'story' as const, duration: EVENT_TIMING.backgroundFade, line: { type: 'command' as const }, previous, expression, animation };
      append({ ...transition, background, emotion, backgroundTransition: 'out' });
      append({ ...transition, background: line.bg, emotion: line.emotion ?? emotion, backgroundTransition: 'in' });
    }
    if (line.bg) background = line.bg;
    if (line.emotion) emotion = line.emotion;
    if (line.music !== undefined && line.music !== music?.key) {
      stopMusic();
      if (line.music !== 'none') {
        music = { key: line.music, start: time, end: Infinity, loop: true, volume: bgmVolume };
        audio.push(music);
      }
    }
    if (line.commandType === 'endEvent') { stopMusic(); break; }
    let duration = (line.text?.length ?? 0) * EVENT_TIMING.typewriter + EVENT_TIMING.autoRead;
    if (line.type === '타이틀') duration = EVENT_TIMING.titleShow + EVENT_TIMING.titleGap;
    if (line.type === 'selection') duration = Math.max(duration, 3) + 0.6;
    if (line.type === 'command') {
      duration = line.commandType === 'waitSecond' ? Math.max(0.1, line.waitSecond ?? 1)
        : line.commandType === 'backgroundOnly' ? 1 : EVENT_TIMING.deleteFade;
    }
    if (line.type === 'narration' && lines[index + 1]?.commandType === 'endEvent') stopMusic();
    if (line.soundFile) audio.push({ key: line.soundFile, start: time, end: Infinity, loop: false, volume: sfxVolume });
    if (line.expression) expression = { key: line.expression, start: time };
    if (line.type === 'animation' || (line.type === 'dialogue' && line.animationType)) animation = { type: line.animationType ?? '', start: time };
    append({ kind: 'story', duration, line, background, emotion, previous, expression, animation });
    if (line.type === 'dialogue' || line.type === 'narration') previous = line;
    if (line.commandType === 'deleteEmotion' || line.commandType === 'deleteAll') emotion = undefined;
    if (line.commandType === 'deleteAll') { background = undefined; previous = undefined; }
  }
  stopMusic();
  if (!scenes.length) throw new Error('EMPTY_VIDEO');
  return { scenes, audio: audio.map((cue) => ({ ...cue, end: Math.min(cue.end, time) })), duration: time, messages };
}

export function videoDimensions(ratio: VideoRatio) {
  return ratio === '16:9' ? { width: 1280, height: 720 } : { width: 720, height: 1280 };
}
