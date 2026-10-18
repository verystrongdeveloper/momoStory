import type { EventLine } from '@/types/EventLine';

export const EVENT_TIMING = {
  titleReveal: 0.5, titleShow: 3, titleFade: 0.3, titleGap: 1,
  expressionReveal: 0.3, expressionShow: 2, expressionFade: 0.5,
  deleteFade: 0.3, typewriter: 0.03, autoRead: 2.1,
  backgroundFade: 0.4,
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
  const match = character.match(/^(.*?)\((.*?)\)$/);
  return match ? { name: match[1], affiliation: match[2] } : { name: character, affiliation: '' };
}

export function eventStoryFont(width: number, height: number, fraction: number, floor: number) {
  const scale = width < height && height > 0 ? Math.sqrt(width / height) : 1;
  return Math.max(Math.round(floor * scale), Math.round(height * fraction * scale));
}
