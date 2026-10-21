export function buildEventPromptPro(
  mainChar: string,
  dialogHistory: { user: string; ai: string }[],
  allCharsWithEmotions: { name: string; emotions: string[] }[],
  direction: string,
  senseiMode?: import('../senseiMode').SenseiMode,
): string;
