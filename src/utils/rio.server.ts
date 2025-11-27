import { CalendarInstance } from "./types";
import { formatDateKey, parseDateKey } from "./date-helpers";

export async function fetchRioEvents(
  date: Date = new Date(),
  targetKey?: string
): Promise<CalendarInstance[]> {
  // Rio API needs a date range, so we'll fetch a week around the target date
  // Use PST-aware date operations
  const dateKey = targetKey ?? formatDateKey(date);
  const baseDate = parseDateKey(dateKey);
  if (!baseDate) {
    return [];
  }

  // Create start date (7 days before) at 7:00 AM PST
  const startDate = new Date(baseDate);
  startDate.setUTCDate(startDate.getUTCDate() - 7);
  startDate.setUTCHours(15, 0, 0, 0); // 15:00 UTC = 7:00 PST (approx, DST handled by parseDateKey)

  // Create end date (7 days after) at 7:59 AM PST
  const endDate = new Date(baseDate);
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  endDate.setUTCHours(15, 59, 59, 999);

  const startStr = startDate.toISOString().replace(/:/g, "%3A");
  const endStr = endDate.toISOString().replace(/:/g, "%3A");

  const response = await fetch(
    `https://riotheatre.ca/wp-json/barker/v1/listings?_embed=true&end_date=${endStr}&page=1&per_page=500&start_date=${startStr}&status=publish`
  );

  const events: CalendarInstance[] = [];
  if (response.ok) {
    const json = await response.json();
    const array = Array.isArray(json) ? json : [];

    const targetDateKey = targetKey ?? formatDateKey(date);

    array.forEach((listing: any) => {
      const startDate = new Date(listing.start_time);
      const endDate = listing.end_time
        ? new Date(listing.end_time)
        : new Date(startDate.getTime() + 120 * 60000); // Default 2 hours if no end time

      if (formatDateKey(startDate) === targetDateKey) {
        events.push({
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          resourceId: "rio-theatre",
          title: listing.event?.title || "Untitled",
          moreInfo: listing.extra || "",
          eventType: "Film",
          theatre: "rio" as const,
          moreInfoUrl: listing.event?.link || listing.tickets_link,
        });
      }
    });
  }

  return events;
}
