import { parseEventTitle } from "./parsers";
import type { CalendarInstance } from "./types";

/** Prefer VIFF's ticket link and festival metadata when another feed lists the
 * same film at the same venue and time. Separate showtimes remain separate. */
export function mergeEvents(viffEvents: CalendarInstance[], otherEvents: CalendarInstance[]): CalendarInstance[] {
  const screeningKey = (event: CalendarInstance) => {
    const title = parseEventTitle(event.title, event).title
      .replace(/\s*\((?:Regular|2D|3D|70mm|IMAX|UltraAVX)(?:,\s*(?:Regular|2D|3D|70mm|IMAX|UltraAVX))*\)\s*$/i, "")
      .normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    return `${event.theatre}|${new Date(event.start).getTime()}|${title}`;
  };
  const viffKeys = new Set(viffEvents.map(screeningKey));
  return [...viffEvents, ...otherEvents.filter(event => !viffKeys.has(screeningKey(event)))]
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
