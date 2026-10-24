import { Asset } from 'expo-asset';

const FALLBACK_ASPECT_RATIO = 717 / 1280;

/**
 * The dialogue art was exported from several source packs. The pack canvas is
 * part of the visual language, so these ratios are kept stable instead of
 * relying on a platform-specific Image resolver at render time.
 */
const ASPECT_RULES: Array<[RegExp, number]> = [
  [/^hoshino_swimsuit_/, 800 / 1002],
  [/^hoshino_/, 373 / 668],
  [/^hina_/, 572 / 1024],
  [/^mari_/, 572 / 1024],
  [/^koyuki_/, 371 / 673],
  [/^fubuki_/, 371 / 673],
  [/^aris_/, 800 / 904],
  [/^ako_/, 320 / 957],
  [/^ibuki_/, 798 / 1280],
  [/^nonomi_/, 750 / 1280],
  [/^yuuka_/, 548 / 1280],
  [/^shiroko_/, 635 / 1280],
  [/^serika_/, 566 / 1280],
  [/^koharu_/, 864 / 1280],
  [/^tsurugi_/, 800 / 994],
  [/^gehenna_student_/, 171 / 600],
  [/^gehenna_prefect_team_/, 318 / 1280],
  [/^genryumon_student_/, 471 / 1280],
  [/^hyakkiyako_student_/, 443 / 1280],
  [/^valkyrie_student_/, 610 / 1280],
  [/^trinity_justice_/, 335 / 1280],
  [/^robot_/, 164 / 600],
];

// Blue Archive-style staging: enlarge the portrait while keeping its head in
// the upper scene. The lower body deliberately extends beneath the dialogue UI.
export const SPRITE_HEIGHT_RATIO = 0.98;
export const SPRITE_BASELINE_RATIO = -0.11;

export function getSpriteAspectRatio(key: string, source: any) {
  const known = ASPECT_RULES.find(([rule]) => rule.test(key));
  if (known) return known[1];

  try {
    const asset = Asset.fromModule(source);
    if (asset.width && asset.height) return asset.width / asset.height;
  } catch {
    // Fall back to the standard full-body portrait ratio for unknown NPC art.
  }

  return FALLBACK_ASPECT_RATIO;
}
