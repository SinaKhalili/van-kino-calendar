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

function getPacificOffsetMinutes(date: Date): number {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return -8 * 60;
  }

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

  // Create date at noon PST (not UTC) to avoid timezone issues
  // Format: YYYY-MM-DDTHH:mm:ss-08:00 (PST) or -07:00 (PDT)
  const dateStr = `${yearStr}-${pad(month)}-${pad(day)}T12:00:00`;
  const candidates = ["-08:00", "-07:00"].map((offset) =>
    new Date(`${dateStr}${offset}`)
  );

  for (const candidate of candidates) {
    if (formatDateKey(candidate) === dateKey) {
      return candidate;
    }
  }

  // Fallback to PST (shouldn't happen, but just in case)
  return candidates[0];
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
