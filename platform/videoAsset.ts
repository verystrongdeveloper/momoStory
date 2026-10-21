import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

export async function readableVideoAsset(asset: Asset): Promise<File> {
  // Release APK images can be drawable resource names, not filesystem URIs.
  // fromModule marks these as downloaded, so its downloadAsync is a no-op.
  // A separate Asset forces Expo's native resource-to-cache copy without
  // changing the shared Asset used by React Native's Image component.
  // Preserve the content hash: Android resource names stay the same across APK
  // upgrades, and a hashless download would reuse the old renderer/image cache.
  const readable = !asset.uri.includes(':')
    ? new Asset({ name: asset.name, type: asset.type, uri: asset.uri, hash: asset.hash })
    : asset;
  await readable.downloadAsync();
  return new File(readable.localUri ?? readable.uri);
}

export async function videoAssetUrl(source: Parameters<typeof Asset.fromModule>[0], mime: string): Promise<string> {
  const asset = Asset.fromModule(source);
  const file = await readableVideoAsset(asset);
  const assetMime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp3: 'audio/mpeg', wav: 'audio/wav', ttf: 'font/ttf' };
  return `data:${assetMime[asset.type.toLowerCase()] ?? mime};base64,${await file.base64()}`;
}
