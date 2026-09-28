import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEventTitle } from "./parsers";
import { getViffTheatre } from "./venues";

vi.mock("./listing-cache.server", () => ({
  cachedListings: async (_key: string, load: () => Promise<unknown>) => ({ value: await load() }),
}));

function instance(title: string, slug: string, venue: string, start = "2026-10-01T17:30:00-07:00") {
  return {
    start: start.slice(0, 19), end: "2026-10-01T19:30:00", resourceId: venue,
    title: `<h3>${title}</h3><time datetime="${start}">5:30 pm</time><span class="c-calendar-instance__duration">139 min</span><a href="https://viff.org/whats-on/${slug}/">More Info</a>`,
    eventType: "Film",
  };
}
const regular = instance("Regular &amp; Movie", "regular-movie", "viff-centre-viff-cinema");
const festival = instance("Festival Movie", "festival-movie", "lindsay-family-stage-at-granville-island");
const programCard = (slug: string) => `<h3 class="c-event-card__title"><a href="https://viff.org/whats-on/${slug}/">Movie</a></h3>`;

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function setup(programFails = false) {
  vi.resetModules();
  const mock = vi.fn(async (url: string) => {
    if (url.includes("calendar/instances")) return Response.json([regular, festival,
      instance("Tomorrow", "festival-movie", "the-rio-theatre", "2026-10-02T17:30:00-07:00")]);
    if (url.includes("whats-on-calendar")) return new Response('var wpApiSettings = {"nonce":"public-token"};');
    if (programFails) return new Response("Unavailable", { status: 503 });
    if (url.includes("/page/2/")) return new Response(programCard("festival-movie"));
    return new Response(programCard("another-movie") + '<a class="next page-numbers" href="https://viff.org/whats-on/page/2/?festival-only=true">Next</a>');
  });
  vi.stubGlobal("fetch", mock);
  const { fetchViffEvents } = await import("./viff.server");
  return { mock, fetchViffEvents };
}

describe("VIFF program integration", () => {
  it("marks program members across venues, follows pagination, and excludes regular films", async () => {
    const { mock, fetchViffEvents } = await setup();
    const events = await fetchViffEvents(new Date("2026-10-01T12:00:00-07:00"));
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ theatre: "viff", isViffFestival: false });
    expect(events[1]).toMatchObject({ theatre: "lindsay-family-stage", isViffFestival: true,
      start: "2026-10-02T00:30:00.000Z", end: "2026-10-02T02:49:00.000Z",
      moreInfoUrl: "https://viff.org/whats-on/festival-movie/" });
    expect(parseEventTitle(events[1].title, events[1]).title).toBe("Festival Movie");
    expect(mock).toHaveBeenCalledWith(expect.stringContaining("dates=October+01+2026"),
      expect.objectContaining({ headers: expect.objectContaining({ "X-WP-Nonce": "public-token" }) }));
    await fetchViffEvents(new Date("2026-10-01T12:00:00-07:00"));
    expect(mock.mock.calls.filter(([url]) => url.includes("festival-only"))).toHaveLength(2);
  });

  it("reports a program failure so the cache can preserve verified listings", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { fetchViffEvents } = await setup(true);
    await expect(fetchViffEvents(new Date("2026-10-01T12:00:00-07:00"))).rejects.toThrow("VIFF program returned 503");
  });

  it("does not break other listings when the public calendar is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { mock, fetchViffEvents } = await setup();
    mock.mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    await expect(fetchViffEvents(new Date("2026-10-01T12:00:00-07:00"))).rejects.toThrow("VIFF calendar returned 503");
  });

  it("refreshes an expired public nonce and retries the calendar", async () => {
    const { mock, fetchViffEvents } = await setup();
    mock.mockResolvedValueOnce(new Response('var wpApiSettings = {"nonce":"expired"};'))
      .mockResolvedValueOnce(new Response("Expired", { status: 403 }));
    await fetchViffEvents(new Date("2026-10-01T12:00:00-07:00"));
    expect(mock.mock.calls.filter(([url]) => url.includes("whats-on-calendar"))).toHaveLength(2);
  });
});

it.each([
  ["the-rio-theatre", "rio"], ["the-cinematheque", "cinematheque"],
  ["the-park-theatre", "park"], ["international-village-9", "international-village"],
  ["fifth-avenue-cinema-19-only", "fifth-avenue"], ["vancouver-playhouse", "vancouver-playhouse"],
  ["sfu-fei-and-milton-wong-experimental-theatre", "sfu-woodwards"],
  ["viff-centre-lochmaddy-studio-theatre", "viff"], ["alliance-francaise", "alliance-francaise"],
  ["annex", "annex"], ["the-pearl", "the-pearl"], ["new-venue", "other-viff-venue"],
])("maps %s to %s", (resource, theatre) => expect(getViffTheatre(resource)).toBe(theatre));
