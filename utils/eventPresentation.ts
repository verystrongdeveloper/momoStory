import type { EventLine } from '@/types/EventLine';
import { characterAffiliation } from '../shared/prompts/speakerNames';

export const EVENT_TIMING = {
  titleReveal: 0.5, titleShow: 3, titleFade: 0.3, titleGap: 1,
  expressionReveal: 0.3, expressionShow: 2, expressionFade: 0.5,
  deleteFade: 0.3, typewriter: 0.03, autoRead: 2.1,
  backgroundFade: 0.4,
  selectionFeedback: 0.6,
  motionStep: 0.08, motionDistance: 15, motionIterations: 3,
};

// Animated.timing's default: Easing.inOut(Easing.bezier(0.42, 0, 1, 1)).
export function eventEase(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  if (t === 0 || t === 0.5 || t === 1) return t;
  const input = t < 0.5 ? t * 2 : (1 - t) * 2;
  let low = 0, high = 1;
  for (let i = 0; i < 32; i++) {
    const u = (low + high) / 2;
    const x = 3 * (1 - u) * (1 - u) * u * 0.42 + 3 * (1 - u) * u * u + u * u * u;
    if (x < input) low = u; else high = u;
  }
  const u = (low + high) / 2;
  const eased = 3 * (1 - u) * u * u + u * u * u;
  return t < 0.5 ? eased / 2 : 1 - eased / 2;
}

export function expressionOpacityAt(seconds: number) {
  if (seconds < 0) return 0;
  if (seconds < EVENT_TIMING.expressionReveal) return eventEase(seconds / EVENT_TIMING.expressionReveal);
  return seconds < EVENT_TIMING.expressionShow ? 1
    : 1 - eventEase((seconds - EVENT_TIMING.expressionShow) / EVENT_TIMING.expressionFade);
}

/** Expression box relative to the sprite, shared by playback and MP4 export. */
export function expressionLayoutAt(W: number, H: number, spriteWidth: number, spriteHeight: number) {
  if (W >= H) {
    const size = 80 * (W / 1280);
    return { left: spriteWidth - Math.min(W * 0.02, spriteWidth * 0.08) - size, top: H * 0.04, size };
  }
  // In portrait the full-body sprite can be wider than the viewport. Anchoring
  // to its far edge puts the icon offscreen; use the upper-right head area and
  // keep the complete icon inside the frame instead.
  const size = Math.min(spriteHeight * 0.09, W * 0.18);
  const spriteLeft = (W - spriteWidth) / 2;
  const margin = Math.max(W * 0.025, EVENT_TIMING.motionDistance + W * 0.01);
  const desiredLeft = spriteLeft + spriteWidth * 0.9 - size / 2;
  const screenLeft = Math.max(margin, Math.min(W - size - margin, desiredLeft));
  return { left: screenLeft - spriteLeft, top: Math.max(0, spriteHeight * 0.13 - size / 2), size };
}

export function spriteMotionAt(type: string | undefined, seconds: number) {
  if (!type || seconds < 0) return { x: 0, y: 0 };
  const raw = type.toLowerCase();
  const targets = raw.includes('slide') ? [EVENT_TIMING.motionDistance]
    : Array.from({ length: EVENT_TIMING.motionIterations * 2 }, (_, index) => index % 2 ? -EVENT_TIMING.motionDistance : EVENT_TIMING.motionDistance);
  targets.push(0);
  const segment = Math.floor(seconds / EVENT_TIMING.motionStep);
  if (segment >= targets.length) return { x: 0, y: 0 };
  const previous = segment ? targets[segment - 1] : 0;
  const offset = previous + (targets[segment] - previous) * eventEase((seconds - segment * EVENT_TIMING.motionStep) / EVENT_TIMING.motionStep);
  return raw.includes('x') ? { x: offset, y: 0 } : { x: 0, y: offset };
}

export function shownEventDialogue(current: EventLine | null | undefined, last: EventLine | null | undefined) {
  if (current?.type === 'narration' || (current?.type === 'selection' && current.text)) return current;
  return current && ['dialogue', 'selection'].includes(current.type) ? last : null;
}

export function parseEventSpeaker(character: string) {
  const match = character.trim().match(/^(.*?)[（(](.*?)[）)]$/);
  const name = (match?.[1] ?? character).trim();
  return { name, affiliation: characterAffiliation(name) || match?.[2]?.trim() || '' };
}

export function eventStoryFont(width: number, height: number, fraction: number, floor: number) {
  const scale = width < height && height > 0 ? Math.sqrt(width / height) : 1;
  return Math.max(Math.round(floor * scale), Math.round(height * fraction * scale));
}
