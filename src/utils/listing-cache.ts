export const LISTING_FRESH_MS = 15 * 60 * 1000;
export const LISTING_RETAIN_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 60 * 1000;

interface CacheEntry<T> {
  value: T;
  updatedAt: number;
  retryAfter?: number;
}
export interface CachedResult<T> {
  value: T;
  updatedAt: number;
  stale: boolean;
}
export interface CacheRuntime {
  cache: Pick<Cache, "match" | "put">;
  waitUntil: (promise: Promise<unknown>) => void;
  now?: () => number;
}

/** Retain data longer than its freshness window so stale data can be returned
 * immediately while refresh runs under the current request's waitUntil. */
export async function readThroughCache<T>(
  key: string,
  load: () => Promise<T>,
  runtime: CacheRuntime,
): Promise<CachedResult<T>> {
  const now = runtime.now ?? Date.now;
  const request = new Request(key);
  let saved: CacheEntry<T> | undefined;
  try {
    const response = await runtime.cache.match(request);
    if (response) {
      const entry = await response.json() as CacheEntry<T>;
      if (Number.isFinite(entry.updatedAt) && now() - entry.updatedAt < LISTING_RETAIN_MS) saved = entry;
    }
  } catch (error) {
    console.error("Listing cache read failed", error);
  }

  const write = async (entry: CacheEntry<T>) => {
    const remaining = Math.floor((LISTING_RETAIN_MS - (now() - entry.updatedAt)) / 1000);
    if (remaining <= 0) return;
    try {
      await runtime.cache.put(request, Response.json(entry, {
        headers: { "Cache-Control": `public, max-age=${remaining}` },
      }));
    } catch (error) {
      console.error("Listing cache write failed", error);
    }
  };
  const refresh = async () => {
    const value = await load();
    const entry = { value, updatedAt: now() };
    await write(entry);
    return { ...entry, stale: false };
  };

  if (!saved) return refresh();
  const stale = now() - saved.updatedAt >= LISTING_FRESH_MS;
  if (stale && now() >= (saved.retryAfter ?? 0)) {
    const previous = saved;
    runtime.waitUntil(refresh().catch(async (error) => {
      console.error("Listing refresh failed; keeping previous result", error);
      // A failed refresh must never replace good data with an empty response or
      // make the old data look newly fetched. Back off repeated failures briefly.
      await write({ ...previous, retryAfter: now() + RETRY_MS });
    }));
  }
  return { value: saved.value, updatedAt: saved.updatedAt, stale };
}
