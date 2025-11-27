import { createServerFn } from "@tanstack/react-start";
import { CalendarInstance } from "../utils/types";
import { fetchViffEvents } from "../utils/viff.server";
import { fetchRioEvents } from "../utils/rio.server";
import { fetchCinemathequeEvents } from "../utils/cinematheque.server";
import {
  getTodayDateKey,
  isValidDateKey,
  parseDateKey,
} from "../utils/date-helpers";

export type EventRequestPayload = {
  date?: string;
};

export type EventResponsePayload = {
  events: CalendarInstance[];
  dateIso: string;
  dateKey: string;
};

export const getEventsForDate = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data?: EventRequestPayload }) => {
  const requestedKey = isValidDateKey(data?.date)
    ? data!.date!
    : getTodayDateKey();

  const targetDate = parseDateKey(requestedKey) ?? new Date();

  const cache = typeof caches !== "undefined" ? caches.default : undefined;
  const cacheKey = cache
    ? new Request(`https://vankino.calendar/cache/${requestedKey}`)
    : undefined;

  if (cache && cacheKey) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      try {
        return (await cached.clone().json()) as EventResponsePayload;
      } catch (
        error
      ) {
        await cache.delete(cacheKey);
      }
    }
  }

  const [viffEvents, rioEvents, cinemathequeEvents] = await Promise.all([
    fetchViffEvents(targetDate, requestedKey),
    fetchRioEvents(targetDate, requestedKey),
    fetchCinemathequeEvents(targetDate, requestedKey),
  ]);

  const events = [...viffEvents, ...rioEvents, ...cinemathequeEvents].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const payload = {
    events,
    dateIso: targetDate.toISOString(),
    dateKey: requestedKey,
  } satisfies EventResponsePayload;

  if (cache && cacheKey) {
    await cache.put(
      cacheKey,
      new Response(JSON.stringify(payload), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=900",
        },
      })
    );
  }

  return payload;
});
