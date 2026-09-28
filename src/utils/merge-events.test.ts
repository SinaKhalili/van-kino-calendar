import { expect, it } from "vitest";
import { mergeEvents } from "./merge-events";
import type { CalendarInstance } from "./types";

it("keeps VIFF metadata on duplicate screenings without merging other times or venues", () => {
  const festival: CalendarInstance = {
    title: "<h3>A Film &amp; Us</h3>", theatre: "rio", resourceId: "the-rio-theatre",
    start: "2026-10-02T01:00:00.000Z", end: "2026-10-02T03:00:00.000Z",
    moreInfo: "", eventType: "Film", isViffFestival: true, moreInfoUrl: "https://viff.org/whats-on/a-film/",
  };
  const duplicate = { ...festival, title: "A Film & Us (Regular)", isViffFestival: undefined,
    resourceId: "rio", start: "2026-10-01T18:00:00-07:00" };
  const later = { ...duplicate, start: "2026-10-02T04:00:00Z" };
  const elsewhere = { ...duplicate, theatre: "park" as const };
  expect(mergeEvents([festival], [duplicate, later, elsewhere])).toEqual([festival, elsewhere, later]);
});
