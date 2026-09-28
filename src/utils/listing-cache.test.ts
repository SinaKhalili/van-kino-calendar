import { afterEach, expect, it, vi } from "vitest";
import { readThroughCache, LISTING_FRESH_MS, LISTING_RETAIN_MS, type CacheRuntime } from "./listing-cache";

const key = "https://kino.test/__listing-cache/v1/2026-10-01/rio";
function setup() {
  let time = Date.parse("2026-10-01T12:00:00Z");
  const entries = new Map<string, Response>();
  const pending: Promise<unknown>[] = [];
  const runtime: CacheRuntime = {
    cache: {
      match: vi.fn(async request => entries.get((request as Request).url)?.clone()),
      put: vi.fn(async (request, response) => { entries.set((request as Request).url, response.clone()); }),
    },
    waitUntil: promise => { pending.push(promise); },
    now: () => time,
  };
  return { runtime, entries, pending, advance: (ms: number) => { time += ms; } };
}
afterEach(() => vi.restoreAllMocks());

it("fetches once on a miss and reuses fresh results for the same date/source", async () => {
  const { runtime } = setup();
  const load = vi.fn(async () => ["screening"]);
  const first = await readThroughCache(key, load, runtime);
  expect(await readThroughCache(key, load, runtime)).toEqual(first);
  expect(load).toHaveBeenCalledTimes(1);
  expect(first.stale).toBe(false);
  await readThroughCache(key.replace("10-01", "10-02"), load, runtime);
  expect(load).toHaveBeenCalledTimes(2);
});

it("returns stale data before the background refresh finishes, then serves the new result", async () => {
  const { runtime, advance, pending } = setup();
  await readThroughCache(key, async () => ["old"], runtime);
  advance(LISTING_FRESH_MS);
  let finish!: (value: string[]) => void;
  const load = () => new Promise<string[]>(resolve => { finish = resolve; });
  expect(await readThroughCache(key, load, runtime)).toMatchObject({ value: ["old"], stale: true });
  expect(pending).toHaveLength(1);
  finish(["new"]);
  await Promise.all(pending);
  expect(await readThroughCache(key, load, runtime)).toMatchObject({ value: ["new"], stale: false });
});

it("preserves data and its timestamp on failure and backs off retries", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { runtime, advance, pending } = setup();
  const first = await readThroughCache(key, async () => ["old"], runtime);
  advance(LISTING_FRESH_MS);
  const fail = vi.fn(async () => { throw new Error("upstream down"); });
  await readThroughCache(key, fail, runtime);
  await Promise.all(pending);
  expect(await readThroughCache(key, fail, runtime)).toEqual({ ...first, stale: true });
  expect(fail).toHaveBeenCalledTimes(1);
  advance(60_000);
  await readThroughCache(key, fail, runtime);
  await Promise.all(pending);
  expect(fail).toHaveBeenCalledTimes(2);
});

it("does not cache cold failures or serve data older than the retention limit", async () => {
  const { runtime, entries, advance } = setup();
  const fail = async () => { throw new Error("upstream down"); };
  await expect(readThroughCache(key, fail, runtime)).rejects.toThrow("upstream down");
  expect(entries.size).toBe(0);
  await readThroughCache(key, async () => ["old"], runtime);
  advance(LISTING_RETAIN_MS);
  await expect(readThroughCache(key, fail, runtime)).rejects.toThrow("upstream down");
});

it("caches legitimate empty schedules", async () => {
  const { runtime } = setup();
  const load = vi.fn(async () => []);
  await readThroughCache(key, load, runtime);
  expect((await readThroughCache(key, load, runtime)).value).toEqual([]);
  expect(load).toHaveBeenCalledTimes(1);
});

it("still returns live listings when cache storage fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { runtime } = setup();
  runtime.cache.match = async () => { throw new Error("cache down"); };
  runtime.cache.put = async () => { throw new Error("cache down"); };
  expect(await readThroughCache(key, async () => ["live"], runtime)).toMatchObject({ value: ["live"], stale: false });
});
