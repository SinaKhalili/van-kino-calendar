import { waitUntil } from "cloudflare:workers";
import { getRequest } from "@tanstack/react-start/server";
import { readThroughCache } from "./listing-cache";

export async function cachedListings<T>(key: string, load: () => Promise<T>) {
  // Synthetic GET keys let both SSR and POST server functions share the data
  // cache without caching the page, votes, or any user-specific response.
  const url = new URL(`/__listing-cache/v1/${key}`, getRequest().url);
  let cache: Cache;
  try {
    cache = await caches.open("kino-listings-v1");
  } catch (error) {
    console.error("Listing cache unavailable", error);
    return { value: await load(), updatedAt: Date.now(), stale: false };
  }
  return readThroughCache(url.toString(), load, { cache, waitUntil });
}
