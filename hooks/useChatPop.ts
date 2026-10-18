import { useEffect, useRef } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { getSfxVolume } from '@/services/sfxVolume';
import { useChatSound } from '@/services/chatSound';
import { chatSoundSources } from '@/constants/chatSounds';
import { chatSoundKey } from '@/utils/chatPresentation';

/** One sound per newly visible bubble, never for typing dots or rerenders. */
export default function useChatPop(messages: ReadonlyArray<{ sender: string }>) {
  const selected = useChatSound();
  const player = useAudioPlayer(selected === 'none' ? null : chatSoundSources[chatSoundKey(selected)], { updateInterval: 50, keepAudioSessionActive: true });
  const status = useAudioPlayerStatus(player);
  const count = messages.filter(message => message.sender !== 'typing').length;
  const previous = useRef(0);
  useEffect(() => {
    if (count <= previous.current) { previous.current = count; return; }
    if (selected === 'none') { previous.current = count; return; }
    if (!status.isLoaded) return;
    const previousCount = previous.current;
    previous.current = count;
    const volume = getSfxVolume();
    if (volume <= 0) return;
    let active = true;
    let played = false;
    player.volume = volume;
    void player.seekTo(0).then(() => { if (active) { played = true; player.play(); } }).catch(() => { /* audio must not interrupt chat */ });
    return () => {
      active = false;
      // React Strict Mode replays effects during development. Do not consume
      // a bubble before its canceled seek actually gets a chance to play.
      if (!played && previous.current === count) previous.current = previousCount;
    };
  }, [count, status.isLoaded, player, selected]);
}
