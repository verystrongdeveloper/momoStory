export const GEMINI_OFFLINE_MESSAGE = '네트워크에 연결할 수 없어 Gemini를 호출하지 못했습니다.';

export function throwIfOffline() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(GEMINI_OFFLINE_MESSAGE);
  }
}

export function geminiFailureText(err: unknown): string {
  if (err instanceof Error && (('code' in err && err.code === 'STORY_FORMAT_INVALID') || err.message.includes('스토리 형식을 바로잡지 못했습니다'))) {
    return '스토리 형식을 바로잡지 못했습니다. 다시 생성해 주세요.';
  }
  if (err instanceof Error && err.message.includes('네트워크에 연결할 수 없어')) {
    return GEMINI_OFFLINE_MESSAGE;
  }
  return '에러가 발생했어요.';
}
