export const PST_TIME_ZONE = "America/Vancouver";
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const displayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PST_TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PST_TIME_ZONE,
  weekday: "short",
});

function getPart(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function isValidDateKey(value?: string): value is string {
  return typeof value === "string" && DATE_KEY_REGEX.test(value);
}

export function formatDateKey(date: Date): string {
  const parts = dateKeyFormatter.formatToParts(date);
  return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(
    parts,
    "day"
  )}`;
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

  return new Date(Date.UTC(year, month - 1, day, 12));
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
  return displayFormatter.format(date);
}

export function getWeekdayLabel(date: Date): string {
  return weekdayFormatter.format(date).slice(0, 3).toUpperCase();
}

export function getTodayDateKey(): string {
  return formatDateKey(new Date());
}
