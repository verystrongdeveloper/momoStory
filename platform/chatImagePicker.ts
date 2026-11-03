import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, validImage, type ChatImage } from '../shared/chatImages';
export async function pickChatImage(): Promise<ChatImage | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: IMAGE_MIME_TYPES, copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  if ((asset.size ?? file.size) > MAX_IMAGE_BYTES) throw new Error('INVALID_CHAT_IMAGES');
  const mimeType = asset.mimeType || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string, string>)[asset.name.split('.').pop()?.toLowerCase() ?? ''];
  const image = { mimeType, data: await file.base64() };
  if (!validImage(image)) throw new Error('INVALID_CHAT_IMAGES');
  return image;
}

/** Clipboard image pasting is handled by the browser/desktop webview. */
export function bindChatImagePaste(_target: unknown, _attach: (load: () => Promise<ChatImage[]>) => void): () => void {
  return () => {};
}
