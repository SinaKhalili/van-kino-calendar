import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  viff: vi.fn(), rio: vi.fn(), cinematheque: vi.fn(), park: vi.fn(), cineplex: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ handler: (fn: unknown) => fn }) }));
vi.mock("../utils/viff.server", () => ({ fetchViffEvents: mocks.viff }));
vi.mock("../utils/rio.server", () => ({ fetchRioEvents: mocks.rio }));
vi.mock("../utils/cinematheque.server", () => ({ fetchCinemathequeEvents: mocks.cinematheque }));
vi.mock("../utils/park.server", () => ({ fetchParkEvents: mocks.park }));
vi.mock("../utils/cineplex.server", () => ({ fetchCineplexEvents: mocks.cineplex }));
vi.mock("../utils/listing-cache.server", () => ({
  cachedListings: async (_key: string, load: () => Promise<unknown>) => ({
    value: await load(), updatedAt: Date.parse("2026-10-01T12:00:00Z"), stale: false,
  }),
}));
import { getEventsForDate } from "./events.server";

afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });

it("reports failed sources while keeping successful listings and their update time", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const mock of Object.values(mocks)) mock.mockResolvedValue([]);
  mocks.viff.mockRejectedValue(new Error("VIFF down"));
  mocks.rio.mockResolvedValue([{
    title: "A film", theatre: "rio", resourceId: "rio-theatre", moreInfo: "", eventType: "Film",
    start: "2026-10-02T01:00:00Z", end: "2026-10-02T03:00:00Z",
  }]);
  const result = await getEventsForDate({ data: { date: "2026-10-01" } } as never);
  expect(result.events).toHaveLength(1);
  expect(result.events[0].theatre).toBe("rio");
  expect(result.unavailableSources).toEqual(["VIFF"]);
  expect(result.updatedAt).toBe("2026-10-01T12:00:00.000Z");
});

it("does not label a complete outage as an up-to-date empty schedule", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const mock of Object.values(mocks)) mock.mockRejectedValue(new Error("offline"));
  const result = await getEventsForDate({ data: { date: "2026-10-01" } } as never);
  expect(result.updatedAt).toBeNull();
  expect(result.unavailableSources).toHaveLength(5);
  expect(result.events).toEqual([]);
});
