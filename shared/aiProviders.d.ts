export type AIProvider = 'gemini' | 'openrouter' | 'venice';
export const providers: AIProvider[];
export const endpoints: Record<'openrouter' | 'venice', string>;
export function parseSelection(value: unknown): { provider: AIProvider; model: string };
export function qualifyModel(provider: AIProvider, model: string): string;
export function readProviderKeys(raw: string): Record<AIProvider, string>;
export function listProviderModels(provider: AIProvider, apiKey: string, signal?: AbortSignal): Promise<{ id: string; label: string; free: boolean }[]>;
