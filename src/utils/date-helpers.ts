export const PST_TIME_ZONE = "America/Vancouver";
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function getNthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number,
  nth: number
) {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const firstWeekday = firstDay.getUTCDay();
  const offset = (7 + weekday - firstWeekday) % 7;
  return 1 + offset + (nth - 1) * 7;
}

// BC adopted permanent daylight time (UTC-7, now just "Pacific Time") under
// Regulation 20/2026: clocks sprang forward on 2026-03-08 and did not fall back
// on 2026-11-01. Bundled IANA tzdata (e.g. 2026a) still predicts PST, so we
// can't defer to Intl here.
const BC_PERMANENT_DAYLIGHT_START_UTC = Date.UTC(2026, 2, 8, 10, 0, 0); // 2am PST

function getPacificOffsetMinutes(date: Date): number {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return -7 * 60;
  }

  if (date.getTime() >= BC_PERMANENT_DAYLIGHT_START_UTC) {
    return -7 * 60;
  }

  // Historical North American DST rules for dates before the switch.
  const year = date.getUTCFullYear();
  const dstStartDay = getNthWeekdayOfMonth(year, 2, 0, 2); // Second Sunday in March
  const dstEndDay = getNthWeekdayOfMonth(year, 10, 0, 1); // First Sunday in November
  const dstStartUtc = Date.UTC(year, 2, dstStartDay, 10, 0, 0); // 2am PST -> 10am UTC
  const dstEndUtc = Date.UTC(year, 10, dstEndDay, 9, 0, 0); // 2am PDT -> 9am UTC
  const timestamp = date.getTime();

  if (timestamp >= dstStartUtc && timestamp < dstEndUtc) {
    return -7 * 60;
  }

  return -8 * 60;
}

function convertToPacificDate(date: Date): Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return new Date(NaN);
  }
  const offsetMinutes = getPacificOffsetMinutes(date);
  return new Date(date.getTime() + offsetMinutes * 60 * 1000);
}

export function isValidDateKey(value?: string): value is string {
  return typeof value === "string" && DATE_KEY_REGEX.test(value);
}

export function formatDateKey(date: Date): string {
  const { year, month, day } = getPstDateComponents(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseDateKey(dateKey: string): Date | null {
  if (!isValidDateKey(dateKey)) {
    return null;
  }
  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return null;
  }

  // Anchor at noon Vancouver time to stay clear of day boundaries
  const noon = pacificWallTimeToDate(year, month, day, 12);
  // Reject impossible dates like 2026-02-31 that Date.UTC would roll over
  return formatDateKey(noon) === dateKey ? noon : null;
}

// Convert a Vancouver wall-clock time (as printed on a venue's site) to an instant
export function pacificWallTimeToDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0
): Date {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // The offset only changes at a few instants a year, so the offset in effect
  // near the wall-clock time is the one that applies to it.
  const offsetMinutes = getPacificOffsetMinutes(
    new Date(wallClockAsUtc + 8 * 60 * 60 * 1000)
  );
  return new Date(wallClockAsUtc - offsetMinutes * 60 * 1000);
}

// Helper to get PST date components from any date
export function getPstDateComponents(date: Date) {
  const pstDate = convertToPacificDate(date);
  return {
    year: pstDate.getUTCFullYear(),
    month: pstDate.getUTCMonth() + 1,
    day: pstDate.getUTCDate(),
    hour: pstDate.getUTCHours(),
    minute: pstDate.getUTCMinutes(),
    second: pstDate.getUTCSeconds(),
  };
}

export function addDaysInPst(date: Date, days: number): Date {
  const parsed = parseDateKey(formatDateKey(date));
  if (!parsed) {
    return date;
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed;
}

export function formatPstDisplay(date: Date): string {
  const { year, month, day } = getPstDateComponents(date);
  const monthName = MONTH_NAMES[month - 1] ?? "";
  return `${monthName} ${day}, ${year}`;
}

export function getWeekdayLabel(date: Date): string {
  const pstDate = convertToPacificDate(date);
  return WEEKDAY_LABELS[pstDate.getUTCDay()] ?? "";
}

export function getTodayDateKey(): string {
  return formatDateKey(new Date());
}
