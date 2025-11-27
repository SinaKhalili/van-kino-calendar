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

  // Create date at noon PST (not UTC) to avoid timezone issues
  // Format: YYYY-MM-DDTHH:mm:ss-08:00 (PST) or -07:00 (PDT)
  const dateStr = `${yearStr}-${monthStr.padStart(2, "0")}-${dayStr.padStart(
    2,
    "0"
  )}T12:00:00`;
  // Try PST first (UTC-8)
  let testDate = new Date(`${dateStr}-08:00`);
  const testParts = dateKeyFormatter.formatToParts(testDate);
  const testYear = parseInt(getPart(testParts, "year"));
  const testMonth = parseInt(getPart(testParts, "month"));
  const testDay = parseInt(getPart(testParts, "day"));

  // If PST gives us the correct date, use it
  if (testYear === year && testMonth === month && testDay === day) {
    return testDate;
  }

  // Otherwise try PDT (UTC-7)
  testDate = new Date(`${dateStr}-07:00`);
  const testPartsPDT = dateKeyFormatter.formatToParts(testDate);
  const testYearPDT = parseInt(getPart(testPartsPDT, "year"));
  const testMonthPDT = parseInt(getPart(testPartsPDT, "month"));
  const testDayPDT = parseInt(getPart(testPartsPDT, "day"));

  // If PDT gives us the correct date, use it
  if (testYearPDT === year && testMonthPDT === month && testDayPDT === day) {
    return testDate;
  }

  // Fallback to PST (shouldn't happen, but just in case)
  return new Date(`${dateStr}-08:00`);
}

// Helper to get PST date components from any date
export function getPstDateComponents(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PST_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(getPart(parts, "year")),
    month: parseInt(getPart(parts, "month")),
    day: parseInt(getPart(parts, "day")),
    hour: parseInt(getPart(parts, "hour")),
    minute: parseInt(getPart(parts, "minute")),
    second: parseInt(getPart(parts, "second")),
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
  return displayFormatter.format(date);
}

export function getWeekdayLabel(date: Date): string {
  return weekdayFormatter.format(date).slice(0, 3).toUpperCase();
}

export function getTodayDateKey(): string {
  return formatDateKey(new Date());
}
