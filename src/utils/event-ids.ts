import type { CalendarInstance } from "./types";

export type EventIdentifierInput = Pick<
  CalendarInstance,
  "theatre" | "resourceId" | "start" | "title" | "moreInfoUrl"
>;

function sanitizeValue(value: string | undefined | null): string {
  if (!value) {
    return "";
  }
  return value.replace(/\s+/g, " ").replace(/[|]/g, "").trim();
}

export function getEventIdentifier(event: EventIdentifierInput): string {
  const identity = [
    sanitizeValue(event.theatre),
    sanitizeValue(event.resourceId || event.moreInfoUrl || event.title),
    sanitizeValue(event.moreInfoUrl || event.title),
    sanitizeValue(event.title),
    sanitizeValue(event.start),
  ].join("|");
  return identity;
}
