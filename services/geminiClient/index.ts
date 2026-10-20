import { Platform } from 'react-native';
import { directClient } from './directClient';
import { expressTransport } from './expressTransport';

export { geminiFailureText } from './errors';

export type GeminiTransport = 'direct' | 'express';

/**
 * 웹 개발은 Express를 유지한다.
 * Android와 iOS는 기기의 localhost에 서버가 없으므로 사용자 키로 직접 호출한다.
 * EXPO_PUBLIC_GEMINI_TRANSPORT 가 direct 또는 express 이면 그 값을 따른다.
 * 키는 호출 시점의 사용자 입력이며, 빌드에 개발자 키를 넣지 않는다.
 */
export function geminiTransport(): GeminiTransport {
  const chosen = process.env.EXPO_PUBLIC_GEMINI_TRANSPORT;
  if (chosen === 'direct' || chosen === 'express') return chosen;
  return Platform.OS === 'web' ? 'express' : 'direct';
}

function current() {
  return geminiTransport() === 'direct' ? directClient : expressTransport;
}

const pending = new Map<string, Set<Promise<unknown>>>();
function track<T>(character: string, operation: () => Promise<T>): Promise<T> {
  const requests = pending.get(character) ?? new Set<Promise<unknown>>();
  pending.set(character, requests);
  const request = operation();
  requests.add(request);
  const clean = () => { requests.delete(request); if (!requests.size && pending.get(character) === requests) pending.delete(character); };
  void request.then(clean, clean);
  return request;
}
export const geminiClient = {
  reset: (character: string) => {
    const transport = current();
    const previous = [...pending.get(character) ?? []];
    // Drain old replies before resetting AI memory so they cannot restore an old session.
    return track(character, async () => { await Promise.allSettled(previous); return transport.reset(character); });
  },
  trigger: (character: string) => track(character, () => current().trigger(character)),
  chat: (character: string, message: string) => track(character, () => current().chat(character, message)),
  createEvent: (character: string) => track(character, () => current().createEvent(character)),
};
