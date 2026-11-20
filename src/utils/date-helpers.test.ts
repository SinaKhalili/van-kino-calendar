import { describe, expect, it } from "vitest";
import {
  addDaysInPst,
  formatDateKey,
  getWeekdayLabel,
  pacificWallTimeToDate,
  parseDateKey,
} from "./date-helpers";
import { formatTime } from "./parsers";

describe("Vancouver time after BC's move to permanent daylight time", () => {
  it("shows venue times as listed, with no fall-back in November", () => {
    expect(formatTime("2026-11-20T18:00:00-07:00")).toBe("6:00 PM");
    expect(formatTime("2026-11-21T01:15:00Z")).toBe("6:15 PM");
    expect(formatTime("2027-01-15T19:30:00-07:00")).toBe("7:30 PM");
  });

  it("keeps late shows on the right day", () => {
    // 11:30pm Nov 20 and 12:30am Nov 21; the old PST rule filed the second under Nov 20
    expect(formatDateKey(new Date("2026-11-21T06:30:00Z"))).toBe("2026-11-20");
    expect(formatDateKey(new Date("2026-11-21T07:30:00Z"))).toBe("2026-11-21");
  });

  it("anchors date keys at noon Vancouver time", () => {
    expect(parseDateKey("2026-11-20")?.toISOString()).toBe("2026-11-20T19:00:00.000Z");
    expect(parseDateKey("2026-02-31")).toBeNull();
    expect(getWeekdayLabel(parseDateKey("2026-11-20")!)).toBe("FRI");
    expect(formatDateKey(addDaysInPst(parseDateKey("2026-10-31")!, 2))).toBe("2026-11-02");
  });

  it("converts listed wall-clock times to UTC-7", () => {
    expect(pacificWallTimeToDate(2026, 11, 20, 18, 30).toISOString()).toBe("2026-11-21T01:30:00.000Z");
  });

  it("still applies the old rules before March 8, 2026", () => {
    expect(formatTime("2025-12-01T03:00:00Z")).toBe("7:00 PM");
    expect(formatTime("2025-07-01T02:00:00Z")).toBe("7:00 PM");
    expect(pacificWallTimeToDate(2026, 1, 10, 19).toISOString()).toBe("2026-01-11T03:00:00.000Z");
    expect(pacificWallTimeToDate(2026, 3, 8, 19).toISOString()).toBe("2026-03-09T02:00:00.000Z");
  });
});
