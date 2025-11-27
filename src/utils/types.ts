export interface CalendarInstance {
  start: string;
  end: string;
  resourceId: string;
  title: string;
  moreInfo: string;
  eventType: string;
  theatre: "viff" | "rio" | "cinematheque";
  moreInfoUrl?: string;
}
