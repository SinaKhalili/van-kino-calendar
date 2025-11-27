import { CalendarInstance } from "./types";

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
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month}+${day}+${year}`;
}

export async function fetchViffEvents(
  date: Date = new Date()
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
  if (response.ok) {
    const json = await response.json();
    const array = Array.isArray(json) ? json : [json];
    events.push(
      ...array.map((event: any) => ({
        ...event,
        theatre: "viff" as const,
      }))
    );
  }

  return events;
}
