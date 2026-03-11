export type PackCacheNamespace = 'phrase' | 'verb';

const CACHE_VERSION = 1;

function buildKey(namespace: PackCacheNamespace, id: string): string {
  return `italian-trainer:${namespace}-pack:v${CACHE_VERSION}:${id}`;
}

export function cachePackPayload(namespace: PackCacheNamespace, id: string, payload: unknown): void {
  try {
    localStorage.setItem(buildKey(namespace, id), JSON.stringify(payload));
  } catch {
    // Ignore storage quota/security errors and continue without cache.
  }
}

export function getCachedPackPayload(namespace: PackCacheNamespace, id: string): unknown | undefined {
  try {
    const serialized = localStorage.getItem(buildKey(namespace, id));
    if (!serialized) {
      return undefined;
    }
    return JSON.parse(serialized) as unknown;
  } catch {
    return undefined;
  }
}
