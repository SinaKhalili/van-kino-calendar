import { afterEach, expect, it, vi } from "vitest";
import { fetchCinemathequeEvents } from "./cinematheque.server";

// Trimmed from the live calendar page
const CALENDAR_HTML = `
<ol id="eventCalendar">
  <li data-dom="20" data-dow="friday" class="today">
    <span class="day"><span class="mon">November</span><span class="year">2026</span></span>
    <ol class="programs">
      <li class="programScreening">
        <span class="details"><a href="https://thecinematheque.ca/films/2026/stereo-girls"><span class="time pm">6:30</span></a></span>
        <a href="https://thecinematheque.ca/films/2026/stereo-girls" class="programTitle">Stereo Girls</a>
      </li>
      <li class="programScreening">
        <span class="details"><a href="https://thecinematheque.ca/films/2026/rose"><span class="time pm">8:30</span></a></span>
        <a href="https://thecinematheque.ca/films/2026/rose" class="programTitle">Rose</a>
      </li>
    </ol>
  </li>
</ol>`;

afterEach(() => vi.unstubAllGlobals());

it("reads listed showtimes as Vancouver time (UTC-7 year-round)", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(CALENDAR_HTML)));
  const events = await fetchCinemathequeEvents(new Date("2026-11-20T20:00:00Z"));
  expect(events.map((e) => [e.title, e.start])).toEqual([
    ["Stereo Girls", "2026-11-21T01:30:00.000Z"],
    ["Rose", "2026-11-21T03:30:00.000Z"],
  ]);
});
