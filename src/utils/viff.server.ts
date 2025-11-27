import { CalendarInstance } from "./types";
import { formatDateKey, getPstDateComponents } from "./date-helpers";

function formatDateForViff(date: Date): string {
  const months = [
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
  const pst = getPstDateComponents(date);
  const month = months[pst.month - 1];
  const day = pst.day;
  const year = pst.year;
  return `${month}+${day}+${year}`;
}

export async function fetchViffEvents(
  date: Date = new Date(),
  targetKey?: string
): Promise<CalendarInstance[]> {
  const dateStr = formatDateForViff(date);
  const response = await fetch(
    `https://viff.org/wp-json/v1/attendable/calendar/instances?dates=${dateStr}`,
    {
      headers: {
        accept: "application/json",
      },
    }
  );

  const events: CalendarInstance[] = [];
  if (!response.ok) {
    return events;
  }

  const json = await response.json();
  const array = Array.isArray(json) ? json : [json];
  const targetDateKey = targetKey ?? formatDateKey(date);

  for (const raw of array) {
    // Try to extract PST time from HTML title if available
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    const titleHtml = raw.title?.rendered ?? raw.title ?? "";
    const timeMatch = titleHtml.match(/<time[^>]*datetime="([^"]+)"/);

    if (timeMatch && timeMatch[1]) {
      // Parse the datetime attribute which should be in PST/PDT format
      const pstTimeStr = timeMatch[1];
      startDate = new Date(pstTimeStr);
    } else {
      // Fallback to ISO timestamp
      const startIso =
        raw.start ??
        raw.start_time ??
        raw.startDate ??
        raw.start_date ??
        raw.meta?.start ??
        null;
      if (!startIso) {
        continue;
      }
      startDate = new Date(startIso);
    }

    if (!startDate || isNaN(startDate.getTime())) {
      continue;
    }

    if (formatDateKey(startDate) !== targetDateKey) {
      continue;
    }

    // For end time, try to calculate from duration or use provided end time
    const durationMatch = titleHtml.match(/(\d+)\s*min/);
    if (durationMatch) {
      const durationMinutes = parseInt(durationMatch[1], 10);
      if (!isNaN(durationMinutes)) {
        endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
      }
    }

    if (!endDate) {
      const endIso =
        raw.end ??
        raw.end_time ??
        raw.endDate ??
        raw.end_date ??
        raw.meta?.end ??
        null;
      if (endIso) {
        endDate = new Date(endIso);
      } else {
        // Default to 2 hours if no end time
        endDate = new Date(startDate.getTime() + 120 * 60 * 1000);
      }
    }

    events.push({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      resourceId:
        raw.resourceId ?? raw.venue ?? raw.location ?? "viff-centre-theatre",
      title:
        raw.title?.rendered ??
        raw.title ??
        raw.post_title ??
        raw.event_title ??
        "Untitled",
      moreInfo:
        raw.moreInfo ?? raw.excerpt ?? raw.description ?? raw.summary ?? "",
      eventType: raw.eventType ?? raw.event_type ?? "Film",
      theatre: "viff",
      moreInfoUrl:
        raw.link ?? raw.permalink ?? raw.url ?? raw.moreInfoUrl ?? undefined,
    });
  }

  return events;
}
