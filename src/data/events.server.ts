import { createServerFn } from "@tanstack/react-start";
import { cachedListings } from "../utils/listing-cache.server";
import { mergeEvents } from "../utils/merge-events";
import { CalendarInstance } from "../utils/types";
import { fetchViffEvents } from "../utils/viff.server";
import { fetchRioEvents } from "../utils/rio.server";
import { fetchCinemathequeEvents } from "../utils/cinematheque.server";
import { fetchParkEvents } from "../utils/park.server";
import { fetchCineplexEvents } from "../utils/cineplex.server";
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
  updatedAt: string | null;
  stale: boolean;
  unavailableSources: string[];
};

export const getEventsForDate = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data?: EventRequestPayload }) => {
  const requestedKey = isValidDateKey(data?.date)
    ? data!.date!
    : getTodayDateKey();

  const targetDate = parseDateKey(requestedKey) ?? new Date();

  const sources = [
    ["VIFF", fetchViffEvents],
    ["Rio", fetchRioEvents],
    ["Cinematheque", fetchCinemathequeEvents],
    ["Park", fetchParkEvents],
    ["Cineplex", fetchCineplexEvents],
  ] as const;
  const results = await Promise.allSettled(sources.map(([name, fetchEvents]) =>
    cachedListings(`${requestedKey}/${name.toLowerCase()}`, () => fetchEvents(targetDate, requestedKey))
  ));
  const unavailableSources: string[] = [];
  const timestamps: number[] = [];
  let stale = false;
  const listings = results.map((result, index) => {
    if (result.status === "fulfilled") {
      timestamps.push(result.value.updatedAt);
      stale ||= result.value.stale;
      return result.value.value;
    }
    unavailableSources.push(sources[index][0]);
    console.error("Listing source unavailable", sources[index][0], result.reason);
    return [];
  });
  const events = mergeEvents(listings[0], listings.slice(1).flat());

  const payload = {
    events,
    dateIso: targetDate.toISOString(),
    dateKey: requestedKey,
    updatedAt: timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null,
    stale,
    unavailableSources,
  } satisfies EventResponsePayload;

  return payload;
});
