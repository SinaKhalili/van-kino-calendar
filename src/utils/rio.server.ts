import { CalendarInstance } from "./types";

export async function fetchRioEvents(
  date: Date = new Date()
): Promise<CalendarInstance[]> {
  // Rio API needs a date range, so we'll fetch a week around the target date
  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - 7);
  startDate.setHours(7, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 7);
  endDate.setHours(7, 59, 59, 999);

  const startStr = startDate.toISOString().replace(/:/g, "%3A");
  const endStr = endDate.toISOString().replace(/:/g, "%3A");

  const response = await fetch(
    `https://riotheatre.ca/wp-json/barker/v1/listings?_embed=true&end_date=${endStr}&page=1&per_page=500&start_date=${startStr}&status=publish`
  );

  const events: CalendarInstance[] = [];
  if (response.ok) {
    const json = await response.json();
    const array = Array.isArray(json) ? json : [];

    // Parse Rio events - each listing is already a showtime
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    array.forEach((listing: any) => {
      const startDate = new Date(listing.start_time);
      const endDate = listing.end_time
        ? new Date(listing.end_time)
        : new Date(startDate.getTime() + 120 * 60000); // Default 2 hours if no end time

      // Only include events on the target date (check if start is within the day)
      if (startDate >= targetDate && startDate < nextDay) {
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
