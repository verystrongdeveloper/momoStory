export type GeminiModel = { id: string; label: string };
export function normalizeModel(value: unknown): string;
export function listGeminiModels(apiKey: string, force?: boolean): Promise<GeminiModel[]>;
export function modelOrder(apiKey: string, selection?: string, force?: boolean): Promise<string[]>;
export function rememberModel(apiKey: string, model: string): void;
export function canFallback(status: number): boolean;
