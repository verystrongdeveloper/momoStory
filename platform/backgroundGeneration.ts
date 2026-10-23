import { NativeModules, Platform } from 'react-native';

type GenerationService = {
  begin: () => Promise<string>;
  end: (token: string) => Promise<void>;
};

/** One lease covers discovery, model fallback and both stages of story generation. */
export async function withBackgroundGeneration<T>(operation: () => Promise<T>): Promise<T> {
  const service: GenerationService | undefined = Platform.OS === 'android'
    ? NativeModules?.MomoBackgroundGeneration : undefined;
  // Expo Go and builds without the module retain normal foreground generation.
  if (!service) return operation();
  const token = await service.begin();
  try {
    return await operation();
  } finally {
    // Cleanup failure must never discard a completed reply or hide its API error.
    try { await service.end(token); } catch { /* The service also has a native safety timeout. */ }
  }
}
