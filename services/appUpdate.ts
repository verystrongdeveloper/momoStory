const RELEASES = 'https://github.com/verystrongdeveloper/momoAI/releases';
const LATEST_API = 'https://api.github.com/repos/verystrongdeveloper/momoAI/releases/latest';

function parseVersion(value: string) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (!match) throw new Error('UPDATE_INVALID_VERSION');
  const parts = match.slice(1, 4).map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error('UPDATE_INVALID_VERSION');
  return { parts, prerelease: !!match[4] };
}

export function isNewerRelease(current: string, latest: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(latest);
  if (b.prerelease) throw new Error('UPDATE_INVALID_RELEASE');
  for (let i = 0; i < 3; i++) {
    if (a.parts[i] !== b.parts[i]) return b.parts[i] > a.parts[i];
  }
  return a.prerelease;
}

export type UpdateResult = { available: boolean; version: string; url: string };

export async function checkAppUpdate(currentVersion: string, signal?: AbortSignal): Promise<UpdateResult> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 10000);
  try {
    const response = await fetch(LATEST_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`UPDATE_HTTP_${response.status}`);
    const release = await response.json();
    if (release.draft !== false || release.prerelease !== false || typeof release.tag_name !== 'string') {
      throw new Error('UPDATE_INVALID_RELEASE');
    }
    return {
      available: isNewerRelease(currentVersion, release.tag_name),
      version: release.tag_name.replace(/^v/, ''),
      // Construct the URL ourselves; never open arbitrary URLs from a response.
      url: `${RELEASES}/tag/${encodeURIComponent(release.tag_name)}`,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
