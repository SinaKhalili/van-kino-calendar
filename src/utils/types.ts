import type { Theatre } from "./venues";

export interface CalendarInstance {
  start: string;
  end: string;
  resourceId: string;
  title: string;
  moreInfo: string;
  eventType: string;
  theatre: Theatre;
  isViffFestival?: boolean;
  moreInfoUrl?: string;
}
