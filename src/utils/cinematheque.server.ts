import { CalendarInstance } from "./types";
import * as cheerio from "cheerio";
import { getPstDateComponents, pacificWallTimeToDate } from "./date-helpers";

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
  const events: CalendarInstance[] = [];

  try {
    const response = await fetch("https://thecinematheque.ca/films/calendar", { signal: AbortSignal.timeout(8_000) });

    if (!response.ok) {
      console.error(
        "Cinematheque calendar request failed",
        response.status,
        response.statusText
      );
      throw new Error("Cinematheque returned " + response.status);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    if (!$("#eventCalendar").length) throw new Error("Cinematheque calendar missing");

    const pst = getPstDateComponents(date);
    const targetYear = pst.year;
    const targetMonth = pst.month;
    const targetDay = pst.day;
    // Weekday of a calendar date doesn't depend on the UTC offset
    const targetDowAttr =
      DAY_NAMES[new Date(Date.UTC(targetYear, targetMonth - 1, targetDay)).getUTCDay()];
    const targetMonthName = MONTH_NAMES[targetMonth - 1];

    // Find the <li> for the target day
    const $dayLi = $(
      `#eventCalendar > li[data-dom="${targetDay}"][data-dow="${targetDowAttr}"]`
    );

    if ($dayLi.length === 0) {
      console.warn("Cinematheque day element missing", {
        targetYear,
        targetMonth,
        targetDay,
        targetDowAttr,
      });
      return events;
    }

    // Sanity check month and year, use the spans under .day
    const monthText = $dayLi.find(".day .mon").first().text().trim();
    const yearText = $dayLi.find(".day .year").first().text().trim();

    if (monthText !== targetMonthName || yearText !== String(targetYear)) {
      console.warn("Cinematheque calendar mismatch", {
        expectedMonth: targetMonthName,
        expectedYear: targetYear,
        receivedMonth: monthText,
        receivedYear: yearText,
      });
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

      const startDate = pacificWallTimeToDate(
        targetYear,
        targetMonth,
        targetDay,
        hours,
        minutes
      );
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
  } catch (error) {
    throw error;
  }
}
