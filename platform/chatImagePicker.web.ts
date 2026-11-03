import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, MAX_MESSAGE_IMAGES, validImage, type ChatImage } from '../shared/chatImages';

export function readChatImageFile(file: File): Promise<ChatImage> {
  if (file.size > MAX_IMAGE_BYTES || !IMAGE_MIME_TYPES.includes(file.type)) return Promise.reject(new Error('INVALID_CHAT_IMAGES'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('INVALID_CHAT_IMAGES'));
    reader.onload = () => {
      const image = { mimeType: file.type, data: String(reader.result).split(',')[1] };
      if (validImage(image)) resolve(image); else reject(new Error('INVALID_CHAT_IMAGES'));
    };
    reader.readAsDataURL(file);
  });
}

/** Listen only on the chat input; text-only pastes retain browser behavior. */
export function bindChatImagePaste(target: unknown, attach: (load: () => Promise<ChatImage[]>) => void): () => void {
  const input = target as HTMLElement | null;
  if (!input?.addEventListener) return () => {};
  const paste = (event: ClipboardEvent) => {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    let files = Array.from(clipboard.items ?? []).filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile()).filter((file): file is File => file !== null);
    if (!files.length) files = Array.from(clipboard.files ?? []).filter(file => file.type.startsWith('image/'));
    if (!files.length) return;
    // Mixed text/image clipboard content still inserts its text at the cursor.
    if (!clipboard.getData('text/plain')) event.preventDefault();
    attach(async () => {
      if (files.length > MAX_MESSAGE_IMAGES) throw new Error('INVALID_CHAT_IMAGES');
      return Promise.all(files.map(readChatImageFile));
    });
  };
  input.addEventListener('paste', paste);
  return () => input.removeEventListener('paste', paste);
}

export function pickChatImage(): Promise<ChatImage | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = IMAGE_MIME_TYPES.join(',');
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      void readChatImageFile(file).then(resolve, reject);
    }, { once: true });
    input.click();
  });
}
