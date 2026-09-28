import { load } from "cheerio";
import { cachedListings } from "./listing-cache.server";
import { getViffTheatre } from "./venues";
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
  const day = String(pst.day).padStart(2, "0");
  const year = pst.year;
  return `${month}+${day}+${year}`;
}

export async function fetchViffEvents(
  date: Date = new Date(),
  targetKey?: string
): Promise<CalendarInstance[]> {
  const dateStr = formatDateForViff(date);
  const events: CalendarInstance[] = [];
  let array: RawInstance[];
  try {
    const nonce = await getCalendarNonce();
    array = await fetchInstances(dateStr, nonce);
  } catch (error) {
    console.error("Unable to load VIFF calendar", error);
    throw error;
  }
  if (array.length === 0) return events;
  // The calendar API ignores festival-only, so use membership in the official
  // festival program instead. Cache the catalog across dates and requests.
  let festivalUrls = new Set<string>();
  try {
    festivalUrls = await getFestivalProgram();
  } catch (error) {
    console.error("Unable to verify VIFF festival membership", error);
    throw error;
  }
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

    const $ = load(titleHtml);
    const moreInfoLink = $("a").filter((_, link) => $(link).text().trim() === "More Info").attr("href");
    const moreInfoUrl = raw.link ?? raw.permalink ?? raw.url ?? raw.moreInfoUrl ?? moreInfoLink;
    const resourceId = raw.resourceId ?? raw.venue ?? raw.location ?? "viff-centre-theatre";
    if (!endDate || isNaN(endDate.getTime())) continue;
    events.push({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      resourceId,
      title:
        raw.title?.rendered ??
        raw.title ??
        raw.post_title ??
        raw.event_title ??
        "Untitled",
      moreInfo:
        raw.moreInfo ?? raw.excerpt ?? raw.description ?? raw.summary ?? "",
      eventType: raw.eventType ?? raw.event_type ?? "Film",
      theatre: getViffTheatre(resourceId),
      isViffFestival: Boolean(moreInfoUrl && festivalUrls.has(programPath(moreInfoUrl))),
      moreInfoUrl,
    });
  }

  return events;
}

// The public calendar embeds a WordPress nonce; no user credentials or env vars
// are required. Refresh it periodically and once on an expired-token response.
let nonceCache: { value: string; expires: number } | undefined;
async function getCalendarNonce(force = false): Promise<string> {
  if (!force && nonceCache && nonceCache.expires > Date.now()) return nonceCache.value;
  const response = await fetch("https://viff.org/whats-on-calendar/", { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`VIFF calendar returned ${response.status}`);
  const html = await response.text();
  const settings = html.match(/var wpApiSettings\s*=\s*({[^;]+});/);
  const value = settings ? JSON.parse(settings[1]).nonce : undefined;
  if (typeof value !== "string" || !value) throw new Error("VIFF calendar nonce missing");
  nonceCache = { value, expires: Date.now() + 60 * 60 * 1000 };
  return value;
}

type RawInstance = Record<string, any>;
async function fetchInstances(date: string, nonce: string): Promise<RawInstance[]> {
  const url = `https://viff.org/wp-json/v1/attendable/calendar/instances?dates=${date}`;
  let response = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { accept: "application/json", "X-WP-Nonce": nonce } });
  if (response.status === 403) {
    const refreshed = await getCalendarNonce(true);
    response = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { accept: "application/json", "X-WP-Nonce": refreshed } });
  }
  if (!response.ok) throw new Error(`VIFF instances returned ${response.status}`);
  const json = await response.json();
  if (!Array.isArray(json)) throw new Error("Unexpected VIFF calendar response");
  return json;
}

function programPath(url: string): string {
  const parsed = new URL(url, "https://viff.org");
  if (parsed.hostname !== "viff.org") return "";
  return parsed.pathname.replace(/\/book\/.*$/, "/").replace(/\/$/, "");
}

let programCache: { urls: Set<string>; expires: number } | undefined;
async function getFestivalProgram(): Promise<Set<string>> {
  if (programCache && programCache.expires > Date.now()) return programCache.urls;
  // Cache only resolved data: sharing in-flight fetch promises across Worker
  // requests ties their I/O lifetime to the wrong request.
  const cached = await cachedListings("viff-program", async () => [...await loadFestivalProgram()]);
  const urls = new Set(cached.value);
  programCache = { urls, expires: Date.now() + 15 * 60 * 1000 };
  return urls;
}

async function loadFestivalProgram(): Promise<Set<string>> {
  const urls = new Set<string>();
  let next: string | undefined = "https://viff.org/whats-on/?festival-only=true";
  const visited = new Set<string>();
  const signal = AbortSignal.timeout(20_000);
  while (next) {
    if (visited.has(next) || visited.size >= 50) throw new Error("Invalid VIFF program pagination");
    visited.add(next);
    const response = await fetch(next, { signal });
    if (!response.ok) throw new Error(`VIFF program returned ${response.status}`);
    const $ = load(await response.text());
    $(".c-event-card__title a").each((_, link) => {
      const href = $(link).attr("href");
      if (href) urls.add(programPath(href));
    });
    const href = $("a.next.page-numbers").attr("href");
    next = undefined;
    if (href) {
      const page = new URL(href, "https://viff.org");
      if (page.origin !== "https://viff.org" || !/^\/whats-on\/page\/\d+\/$/.test(page.pathname)) {
        throw new Error("Unexpected VIFF program page URL");
      }
      page.searchParams.set("festival-only", "true");
      next = page.toString();
    }
  }
  return urls;
}
