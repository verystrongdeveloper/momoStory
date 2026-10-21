export function getAvailableCharacters(): string[];
export function hasStoryAssets(name: string): boolean;
export function keepAssetSpeakers(script: string, allowedNames?: string[], language?: string): string;
export function parseStorySelection(mainCharacter: string, text: string): { characters: { name: string }[]; direction: string };
