import { CalendarInstance } from "./types";
import * as cheerio from "cheerio";
import { getPstDateComponents } from "./date-helpers";

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

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export async function fetchCinemathequeEvents(
  date: Date = new Date(),
  _targetKey?: string
): Promise<CalendarInstance[]> {
  const response = await fetch("https://thecinematheque.ca/films/calendar");
  const events: CalendarInstance[] = [];

  if (!response.ok) {
    return events;
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const pst = getPstDateComponents(date);
  const targetYear = pst.year;
  const targetMonth = pst.month;
  const targetDay = pst.day;
  // Get weekday in PST - create a date at noon PST and get its weekday
  const pstDateStr = `${targetYear}-${String(targetMonth).padStart(
    2,
    "0"
  )}-${String(targetDay).padStart(2, "0")}T12:00:00`;
  let pstDate = new Date(`${pstDateStr}-08:00`);
  const verifyPst = getPstDateComponents(pstDate);
  if (
    verifyPst.year !== targetYear ||
    verifyPst.month !== targetMonth ||
    verifyPst.day !== targetDay
  ) {
    pstDate = new Date(`${pstDateStr}-07:00`);
  }
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Vancouver",
    weekday: "long",
  });
  const weekdayName = weekdayFormatter.format(pstDate).toLowerCase();
  const targetDow = DAY_NAMES.findIndex((d) => d === weekdayName);
  const targetMonthName = MONTH_NAMES[targetMonth - 1];

  // Find the <li> for the target day
  const $dayLi = $(
    `#eventCalendar > li[data-dom="${targetDay}"][data-dow="${targetDow}"]`
  );

  if ($dayLi.length === 0) {
    return events;
  }

  // Sanity check month and year, use the spans under .day
  const monthText = $dayLi.find(".day .mon").first().text().trim();
  const yearText = $dayLi.find(".day .year").first().text().trim();

  if (monthText !== targetMonthName || yearText !== String(targetYear)) {
    return events;
  }

  // Each screening is <li class="programScreening"> inside <ol class="programs">
  $dayLi.find("ol.programs > li.programScreening").each((_i, el) => {
    const $screening = $(el);

    const $timeSpan = $screening.find("span.time").first();
    const timeText = $timeSpan.text().trim(); // "6:30"
    if (!timeText) {
      return;
    }

    const classAttr = $timeSpan.attr("class") || "";
    const isPm = classAttr.split(/\s+/).includes("pm");
    const isAm = classAttr.split(/\s+/).includes("am");

    const [hourStr, minuteStr] = timeText.split(":");
    if (!hourStr || !minuteStr) {
      return;
    }

    let hours = parseInt(hourStr, 10);
    const minutes = parseInt(minuteStr, 10);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return;
    }

    if (isPm && hours !== 12) {
      hours += 12;
    } else if (isAm && hours === 12) {
      hours = 0;
    }

    const $titleLink = $screening.find("a.programTitle").first();
    const title = $titleLink.text().trim();
    const link = $titleLink.attr("href") || "";

    if (!title || !link) {
      return;
    }

    // Construct a Date for the target date in Pacific time
    const monthStr = String(targetMonth).padStart(2, "0");
    const dayStr = String(targetDay).padStart(2, "0");
    // Try PST first, then PDT if needed
    const dateStr = `${targetYear}-${monthStr}-${dayStr}T${String(
      hours
    ).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
    let startDate = new Date(`${dateStr}-08:00`);
    // Verify it's the correct date in PST
    const verifyPst = getPstDateComponents(startDate);
    if (
      verifyPst.year !== targetYear ||
      verifyPst.month !== targetMonth ||
      verifyPst.day !== targetDay
    ) {
      // Try PDT
      startDate = new Date(`${dateStr}-07:00`);
    }
    const endDate = new Date(startDate.getTime() + 120 * 60 * 1000); // +2 hours

    events.push({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      resourceId: "cinematheque",
      title,
      moreInfo: "",
      eventType: "Film",
      theatre: "cinematheque",
      moreInfoUrl: link,
    });
  });

  return events;
}
