import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

const HYPE_TABLE = "event_hype";

type HypeCountsRequest = {
  eventIds?: string[];
};

type HypeCountsResponse = {
  counts: Record<string, number>;
};

type IncrementHypeRequest = {
  eventId?: string;
  title?: string;
  theatre?: string;
};

type IncrementHypeResponse = {
  eventId: string;
  hypeCount: number;
};

type MemoryStore = Map<string, number>;

function getDb(): D1Database | undefined {
  try {
    return (env as Env).HYPE_DB;
  } catch (e) {
    console.log("[HYPE_DB] env access failed:", e);
    return undefined;
  }
}

function getMemoryStore(): MemoryStore {
  const globalAny = globalThis as typeof globalThis & {
    __HYPE_STORE__?: MemoryStore;
  };
  if (!globalAny.__HYPE_STORE__) {
    globalAny.__HYPE_STORE__ = new Map();
  }
  return globalAny.__HYPE_STORE__;
}

function normalizeEventIds(source?: string[]) {
  if (!Array.isArray(source)) {
    return [] as string[];
  }
  const deduped = new Set<string>();
  for (const raw of source) {
    if (typeof raw === "string" && raw.trim().length > 0) {
      deduped.add(raw.trim());
    }
  }
  return Array.from(deduped);
}

async function fetchCountsFromDb(db: D1Database, eventIds: string[]) {
  if (eventIds.length === 0) {
    return {} as Record<string, number>;
  }
  const placeholders = eventIds.map(() => "?").join(",");
  const statement = db
    .prepare(
      `SELECT event_id, hype_count FROM ${HYPE_TABLE} WHERE event_id IN (${placeholders})`
    )
    .bind(...eventIds);
  const result = await statement.all<{
    event_id: string;
    hype_count: number;
  }>();
  const counts = Object.fromEntries(eventIds.map((id) => [id, 0]));
  for (const row of result.results ?? []) {
    counts[row.event_id] = row.hype_count ?? 0;
  }
  return counts;
}

function fetchCountsFromMemory(store: MemoryStore, eventIds: string[]) {
  return eventIds.reduce<Record<string, number>>((acc, id) => {
    acc[id] = store.get(id) ?? 0;
    return acc;
  }, {});
}

export const getHypeCounts = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<HypeCountsResponse> => {
  const eventIds = normalizeEventIds(
    (data as HypeCountsRequest | undefined)?.eventIds
  );
  if (eventIds.length === 0) {
    return { counts: {} };
  }
  const db = getDb();
  if (!db) {
    const store = getMemoryStore();
    return { counts: fetchCountsFromMemory(store, eventIds) };
  }
  const counts = await fetchCountsFromDb(db, eventIds);
  return { counts };
});

export const incrementHype = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<IncrementHypeResponse> => {
  const payload = data as IncrementHypeRequest | undefined;
  const eventId = payload?.eventId?.trim();
  if (!eventId) {
    throw new Error("Missing eventId");
  }
  const db = getDb();
  if (!db) {
    const store = getMemoryStore();
    const nextCount = (store.get(eventId) ?? 0) + 1;
    store.set(eventId, nextCount);
    return { eventId, hypeCount: nextCount };
  }

  await db
    .prepare(
      `INSERT INTO ${HYPE_TABLE} (event_id, hype_count, last_title, last_theatre, updated_at)
      VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(event_id) DO UPDATE SET
        hype_count = hype_count + 1,
        last_title = excluded.last_title,
        last_theatre = excluded.last_theatre,
        updated_at = CURRENT_TIMESTAMP`
    )
    .bind(eventId, payload?.title ?? null, payload?.theatre ?? null)
    .run();

  const row = await db
    .prepare(`SELECT hype_count FROM ${HYPE_TABLE} WHERE event_id = ?`)
    .bind(eventId)
    .first<{ hype_count: number }>();
  return { eventId, hypeCount: row?.hype_count ?? 0 };
});

export const decrementHype = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<IncrementHypeResponse> => {
  const payload = data as IncrementHypeRequest | undefined;
  const eventId = payload?.eventId?.trim();
  if (!eventId) {
    throw new Error("Missing eventId");
  }
  const db = getDb();
  if (!db) {
    const store = getMemoryStore();
    const current = store.get(eventId) ?? 0;
    const nextCount = Math.max(0, current - 1);
    store.set(eventId, nextCount);
    return { eventId, hypeCount: nextCount };
  }

  await db
    .prepare(
      `UPDATE ${HYPE_TABLE} SET
        hype_count = MAX(0, hype_count - 1),
        updated_at = CURRENT_TIMESTAMP
      WHERE event_id = ?`
    )
    .bind(eventId)
    .run();

  const row = await db
    .prepare(`SELECT hype_count FROM ${HYPE_TABLE} WHERE event_id = ?`)
    .bind(eventId)
    .first<{ hype_count: number }>();
  return { eventId, hypeCount: row?.hype_count ?? 0 };
});
