import { createServerFn } from "@tanstack/react-start";
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
};

export const getEventsForDate = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data?: EventRequestPayload }) => {
  const requestedKey = isValidDateKey(data?.date)
    ? data!.date!
    : getTodayDateKey();

  const targetDate = parseDateKey(requestedKey) ?? new Date();

  const [viffEvents, rioEvents, cinemathequeEvents, parkEvents, cineplexEvents] =
    await Promise.all([
      fetchViffEvents(targetDate, requestedKey),
      fetchRioEvents(targetDate, requestedKey),
      fetchCinemathequeEvents(targetDate, requestedKey),
      fetchParkEvents(targetDate, requestedKey),
      fetchCineplexEvents(targetDate, requestedKey),
    ]);

  const events = [
    ...viffEvents,
    ...rioEvents,
    ...cinemathequeEvents,
    ...parkEvents,
    ...cineplexEvents,
  ].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const payload = {
    events,
    dateIso: targetDate.toISOString(),
    dateKey: requestedKey,
  } satisfies EventResponsePayload;

  return payload;
});
