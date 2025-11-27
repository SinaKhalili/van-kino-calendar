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
    const startDate = new Date(startIso);
    if (formatDateKey(startDate) !== targetDateKey) {
      continue;
    }
    const endIso =
      raw.end ??
      raw.end_time ??
      raw.endDate ??
      raw.end_date ??
      raw.meta?.end ??
      startIso;
    const endDate = new Date(endIso);

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
