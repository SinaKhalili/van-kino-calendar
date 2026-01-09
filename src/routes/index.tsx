import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseEventTitle, formatTime, formatVenue } from "../utils/parsers";
import { getEventsForDate } from "../data/events.server";
import {
  getHypeCounts,
  incrementHype,
  decrementHype,
} from "../data/hype.server";
import { getEventIdentifier } from "../utils/event-ids";
import type { CalendarInstance } from "../utils/types";
import Calendar from "../components/Calendar";
import {
  addDaysInPst,
  formatDateKey,
  formatPstDisplay,
  getTodayDateKey,
  getWeekdayLabel,
  isValidDateKey,
  parseDateKey,
} from "../utils/date-helpers";

type SearchSchema = {
  date?: string;
};

export const Route = createFileRoute("/")({
  component: App,
  beforeLoad: ({ search }) => {
    const date = search.date as string | undefined;
    if (!isValidDateKey(date)) {
      const todayKey = getTodayDateKey();
      throw redirect({
        to: "/",
        search: {
          date: todayKey,
        },
      });
    }
  },
  validateSearch: (search: Record<string, unknown>): SearchSchema => {
    return {
      date: isValidDateKey(search.date as string)
        ? (search.date as string)
        : undefined,
    };
  },
  loaderDeps: ({ search }: { search: { date?: string } }) => ({
    date: search.date,
  }),
  loader: async ({ deps }) => {
    const result = await (getEventsForDate as any)({
      data: deps.date ? { date: deps.date } : undefined,
    });

    return {
      events: result.events,
      dateIso: result.dateIso,
      dateKey: result.dateKey,
    };
  },
});

type VenueFilter = "viff" | "rio" | "cinematheque" | "park";
const venueFilters: VenueFilter[] = ["viff", "rio", "cinematheque", "park"];
const venueLinkMap: Record<VenueFilter, string> = {
  viff: "https://viff.org",
  rio: "https://riotheatre.ca",
  cinematheque: "https://thecinematheque.ca",
  park: "https://www.theparktheatre.ca",
};
const weekdayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type ThemeMode = "festival" | "showtime" | "billboard";
type LoadedDayBucket = {
  events: CalendarInstance[];
  date: Date;
  dateKey: string;
};
type RenderDay = {
  dateKey: string;
  events: CalendarInstance[];
  label: string;
  isToday: boolean;
  date: Date;
};
function App() {
  const loaderData = Route.useLoaderData();
  const { events, dateIso, dateKey: loaderDateKey } = loaderData;
  const search = Route.useSearch();
  const fallbackDate = parseDateKey(loaderDateKey) ?? new Date(dateIso);
  const fallbackKey = loaderDateKey || formatDateKey(fallbackDate);
  const activeKey = isValidDateKey(search.date) ? search.date : fallbackKey;
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const displayKey = pendingKey || activeKey;
  const date = parseDateKey(displayKey) ?? fallbackDate;
  const navigate = useNavigate();
  const [activeVenues, setActiveVenues] = useState<VenueFilter[]>([
    ...venueFilters,
  ]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("activeTheme");
      if (
        stored === "festival" ||
        stored === "showtime" ||
        stored === "billboard"
      ) {
        return stored as ThemeMode;
      }
    }
    return "festival";
  });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [heartClickCount, setHeartClickCount] = useState(0);
  const [heartClickTimeout, setHeartClickTimeout] =
    useState<NodeJS.Timeout | null>(null);
  const [isInfiniteScrollEnabled, setIsInfiniteScrollEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("infiniteScrollEnabled") === "true";
    }
    return false;
  });
  const [loadedDayBuckets, setLoadedDayBuckets] = useState<
    Record<string, LoadedDayBucket>
  >({});
  const [loadedDayOrder, setLoadedDayOrder] = useState<string[]>([]);
  const [isFetchingNextDay, setIsFetchingNextDay] = useState(false);
  const infiniteSentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoading = Boolean(pendingKey);
  const [hypeCounts, setHypeCounts] = useState<Record<string, number>>({});
  const [pendingHypeIds, setPendingHypeIds] = useState<Record<string, boolean>>(
    {}
  );
  const [hypedByUser, setHypedByUser] = useState<Record<string, boolean>>(
    () => {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("hypedEvents");
        return stored ? JSON.parse(stored) : {};
      }
      return {};
    }
  );
  const hypeFetchInFlightRef = useRef<Set<string>>(new Set());
  const [hypeError, setHypeError] = useState<string | null>(null);
  const [explosions, setExplosions] = useState<
    Record<string, { id: number; image: string }>
  >({});
  const explosionIdRef = useRef(0);
  const hypeImages = [
    "/cinema1.png",
    "/cinema2.webp",
    "/laughing.jpg",
    "/You_Wouldn't_Get_It.jpg",
    "/godard.webp",
    "/truth.png",
  ];

  const triggerExplosion = useCallback((eventId: string) => {
    const id = explosionIdRef.current++;
    const image = hypeImages[Math.floor(Math.random() * hypeImages.length)]!;
    setExplosions((prev) => ({ ...prev, [eventId]: { id, image } }));
    setTimeout(() => {
      setExplosions((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
    }, 2500);
  }, []);

  useEffect(() => {
    const enabled = localStorage.getItem("debugEnabled") === "true";
    setDebugEnabled(enabled);
  }, []);

  useEffect(() => {
    const loaderDate = parseDateKey(loaderDateKey) ?? new Date(dateIso);
    setLoadedDayBuckets({
      [loaderDateKey]: {
        events,
        date: loaderDate,
        dateKey: loaderDateKey,
      },
    });
    setLoadedDayOrder([loaderDateKey]);
  }, [events, loaderDateKey, dateIso]);

  const handleHeartClick = () => {
    if (heartClickTimeout) {
      clearTimeout(heartClickTimeout);
    }

    const newCount = heartClickCount + 1;
    setHeartClickCount(newCount);

    if (newCount >= 3) {
      const currentEnabled = localStorage.getItem("debugEnabled") === "true";
      const newEnabled = !currentEnabled;
      localStorage.setItem("debugEnabled", String(newEnabled));
      setDebugEnabled(newEnabled);
      setHeartClickCount(0);
      setHeartClickTimeout(null);
    } else {
      const timeout = setTimeout(() => {
        setHeartClickCount(0);
        setHeartClickTimeout(null);
      }, 2000);
      setHeartClickTimeout(timeout);
    }
  };
  const weekdayLabel = getWeekdayLabel(date);
  const weekdayIndex = weekdayLabels.indexOf(weekdayLabel);
  const activeWeekday = weekdayIndex === -1 ? 0 : weekdayIndex;
  const todayKey = getTodayDateKey();
  const isToday = displayKey === todayKey;
  const filterEventsByVenue = useCallback(
    (items: CalendarInstance[]) => {
      if (activeVenues.length === 0) {
        return [];
      }
      return items.filter((event: CalendarInstance) =>
        activeVenues.includes(event.theatre as VenueFilter)
      );
    },
    [activeVenues]
  );
  const infiniteDayData = useMemo<RenderDay[]>(() => {
    if (!isInfiniteScrollEnabled) {
      return [];
    }
    return loadedDayOrder
      .map((key) => {
        const bucket = loadedDayBuckets[key];
        if (!bucket) {
          return null;
        }
        const label = `${getWeekdayLabel(bucket.date)} · ${formatPstDisplay(
          bucket.date
        )}`;
        return {
          dateKey: bucket.dateKey,
          events: filterEventsByVenue(bucket.events),
          label,
          isToday: formatDateKey(bucket.date) === todayKey,
          date: bucket.date,
        } satisfies RenderDay;
      })
      .filter((value): value is RenderDay => Boolean(value));
  }, [
    filterEventsByVenue,
    isInfiniteScrollEnabled,
    loadedDayBuckets,
    loadedDayOrder,
    todayKey,
  ]);

  const loadNextDay = useCallback(async () => {
    if (!isInfiniteScrollEnabled || isFetchingNextDay) {
      return;
    }
    const lastKey = loadedDayOrder[loadedDayOrder.length - 1];
    if (!lastKey) {
      return;
    }
    const lastDate =
      loadedDayBuckets[lastKey]?.date || parseDateKey(lastKey) || new Date();
    const nextDate = addDaysInPst(lastDate, 1);
    const nextKey = formatDateKey(nextDate);
    if (loadedDayBuckets[nextKey]) {
      return;
    }

    setIsFetchingNextDay(true);
    try {
      const response = await (getEventsForDate as any)({
        data: { date: nextKey },
      });
      const resolvedDate =
        parseDateKey(response.dateKey) ?? new Date(response.dateIso);
      setLoadedDayBuckets((prev) => ({
        ...prev,
        [response.dateKey]: {
          events: response.events,
          date: resolvedDate,
          dateKey: response.dateKey,
        },
      }));
      setLoadedDayOrder((prev) =>
        prev.includes(response.dateKey) ? prev : [...prev, response.dateKey]
      );
    } catch (error) {
      console.error("Failed to load next day", error);
    } finally {
      setIsFetchingNextDay(false);
    }
  }, [
    isInfiniteScrollEnabled,
    isFetchingNextDay,
    loadedDayOrder,
    loadedDayBuckets,
  ]);

  useEffect(() => {
    if (pendingKey && loaderDateKey === pendingKey) {
      setPendingKey(null);
    }
  }, [loaderDateKey, pendingKey]);

  useEffect(() => {
    return () => {
      if (heartClickTimeout) {
        clearTimeout(heartClickTimeout);
      }
    };
  }, [heartClickTimeout]);

  useEffect(() => {
    if (!isInfiniteScrollEnabled) {
      return;
    }
    const sentinel = infiniteSentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadNextDay();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [isInfiniteScrollEnabled, loadNextDay]);

  const filteredData = useMemo(
    () => filterEventsByVenue(events),
    [events, filterEventsByVenue]
  );

  const visibleEvents = useMemo<CalendarInstance[]>(() => {
    if (isInfiniteScrollEnabled) {
      return infiniteDayData.flatMap((day) => day.events);
    }
    return filteredData;
  }, [filteredData, infiniteDayData, isInfiniteScrollEnabled]);

  useEffect(() => {
    const collections = isInfiniteScrollEnabled
      ? infiniteDayData.map((day) => day.events)
      : [filteredData];
    const identifierSet = new Set<string>();
    collections.forEach((group) => {
      group.forEach((event) => {
        const id = getEventIdentifier(event);
        if (id) {
          identifierSet.add(id);
        }
      });
    });
    const missing = Array.from(identifierSet).filter(
      (id) =>
        hypeCounts[id] === undefined && !hypeFetchInFlightRef.current.has(id)
    );
    if (missing.length === 0) {
      return;
    }
    missing.forEach((id) => hypeFetchInFlightRef.current.add(id));
    let cancelled = false;
    (async () => {
      try {
        const response = await (getHypeCounts as any)({
          data: { eventIds: missing },
        });
        if (!cancelled && response?.counts) {
          setHypeCounts((prev) => ({ ...prev, ...response.counts }));
        }
      } catch (error) {
        console.error("Failed to load hype counts", error);
      } finally {
        missing.forEach((id) => hypeFetchInFlightRef.current.delete(id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filteredData, hypeCounts, infiniteDayData, isInfiniteScrollEnabled]);

  const getVenueLabel = (event: CalendarInstance) => {
    if (event.theatre === "rio") {
      return "RIO THEATRE";
    }
    if (event.theatre === "cinematheque") {
      return "THE CINEMATHEQUE";
    }
    if (event.theatre === "park") {
      return "THE PARK THEATRE";
    }
    return formatVenue(event.resourceId);
  };

  const getVenueUrl = (event: CalendarInstance) => {
    if (!event.theatre) {
      return null;
    }
    return venueLinkMap[event.theatre as VenueFilter] ?? null;
  };

  const resolveEventUrl = (event: CalendarInstance) => {
    const fallbackMatch = event.title.match(/href="([^"]+)">\s*More Info/);
    return event.moreInfoUrl || fallbackMatch?.[1] || null;
  };

  const renderVenueLink = (event: CalendarInstance, className: string) => {
    const venueLabel = getVenueLabel(event);
    const eventUrl = resolveEventUrl(event) || getVenueUrl(event);
    if (!eventUrl) {
      return <span className={className}>{venueLabel}</span>;
    }
    return (
      <a
        href={eventUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} transition-colors hover:text-yellow-500 underline-offset-4`}
      >
        {venueLabel}
      </a>
    );
  };

  const openEventLink = (event: CalendarInstance) => {
    const targetUrl = resolveEventUrl(event);
    if (targetUrl) {
      window.open(targetUrl, "_blank");
    }
  };

  const handleHypeClick = useCallback(
    async (event: CalendarInstance, displayTitle: string) => {
      const eventId = getEventIdentifier(event);
      if (!eventId) {
        return;
      }
      const isCurrentlyHyped = Boolean(hypedByUser[eventId]);
      setPendingHypeIds((prev) => ({ ...prev, [eventId]: true }));
      setHypeError(null);
      try {
        const serverFn = isCurrentlyHyped ? decrementHype : incrementHype;
        const response = await (serverFn as any)({
          data: {
            eventId,
            title: displayTitle,
            theatre: event.theatre,
          },
        });
        if (response?.eventId) {
          setHypeCounts((prev) => ({
            ...prev,
            [response.eventId]: response.hypeCount ?? 0,
          }));
          setHypedByUser((prev) => {
            const next = { ...prev };
            if (isCurrentlyHyped) {
              delete next[response.eventId];
            } else {
              next[response.eventId] = true;
            }
            window.localStorage.setItem("hypedEvents", JSON.stringify(next));
            return next;
          });
        }
      } catch (error) {
        console.error("Failed to toggle hype", error);
        setHypeError(
          "Couldn't update hype right now. Please try again shortly."
        );
      } finally {
        setPendingHypeIds((prev) => {
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
      }
    },
    [hypedByUser]
  );

  const renderHypeControl = (event: CalendarInstance, displayTitle: string) => {
    // Hide on billboard theme
    if (theme === "billboard") {
      return null;
    }
    const eventId = getEventIdentifier(event);
    if (!eventId) {
      return null;
    }
    const isPending = Boolean(pendingHypeIds[eventId]);
    const isHyped = Boolean(hypedByUser[eventId]);
    const activeExplosion = eventId ? explosions[eventId] : null;

    // Showtime theme: thinner border, smaller padding to match venue label
    const isShowtime = theme === "showtime";
    const buttonClass = isShowtime
      ? `w-full border border-black px-2 py-0.5 text-[11px] sm:text-xs font-black uppercase tracking-widest text-center ${
          isPending
            ? "bg-gray-200 text-gray-400 cursor-wait"
            : isHyped
            ? "bg-amber-100 text-black hover:bg-amber-200"
            : "bg-gray-50 text-gray-600 hover:bg-gray-100"
        }`
      : `w-full border-2 border-black px-3 py-1 text-xs font-black uppercase tracking-widest text-center ${
          isPending
            ? "bg-gray-300 text-gray-500 cursor-wait"
            : isHyped
            ? "bg-amber-200 text-black hover:bg-amber-300"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`;

    return (
      <div className="relative">
        {activeExplosion && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none z-9999">
            <img
              src={activeExplosion.image}
              alt=""
              className="max-w-64 max-h-64 border-8 border-black shadow-2xl animate-[explosion_2.5s_ease-out_forwards]"
            />
            <span className="absolute -left-8 top-1/2 -translate-y-1/2 text-5xl animate-[fireLeft_2.5s_ease-out_forwards]">
              🔥
            </span>
            <span className="absolute -right-8 top-1/2 -translate-y-1/2 text-5xl animate-[fireRight_2.5s_ease-out_forwards]">
              🔥
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (!isHyped && eventId) triggerExplosion(eventId);
            handleHypeClick(event, displayTitle);
          }}
          disabled={isPending}
          className={`${buttonClass} transition transform active:scale-95`}
          aria-live="polite"
          aria-label={
            isHyped
              ? `Remove hype for ${displayTitle}.`
              : `Hype ${displayTitle}.`
          }
        >
          {isPending ? "..." : isHyped ? "HYPED" : "HYPE"}
        </button>
      </div>
    );
  };

  const isBillboardTheme = theme === "billboard";
  const isShowtimeTheme = theme === "showtime";
  const backgroundClass = isBillboardTheme
    ? "bg-gray-800"
    : isShowtimeTheme
    ? "bg-gray-50"
    : "bg-[#fdf9f3]";
  const headerContainerClass = isBillboardTheme
    ? "border-8 border-black bg-[#050505] text-white shadow-[0_10px_25px_rgba(0,0,0,0.4)]"
    : isShowtimeTheme
    ? "border-8 border-black bg-white text-black"
    : "border-8 border-black bg-yellow-200 text-black";
  const headerPanelClass = isBillboardTheme
    ? "border-4 border-yellow-400 bg-[#111111]"
    : isShowtimeTheme
    ? "border-4 border-black bg-gray-50"
    : "border-4 border-black bg-white";
  const headerAccentTextClass = isBillboardTheme
    ? "text-yellow-200"
    : isShowtimeTheme
    ? "text-gray-700"
    : "text-black";
  const renderThemeLayout = (eventItems: CalendarInstance[]) => {
    if (eventItems.length === 0) {
      return (
        <div className="text-black text-base font-bold border-4 border-black p-2 bg-yellow-400">
          NO EVENTS FOUND
        </div>
      );
    }

    if (theme === "showtime") {
      return (
        <div className="border-4 border-black bg-white">
          {eventItems.map((event: CalendarInstance, index: number) => {
            const parsed = parseEventTitle(event.title, event);
            const venueLinkElement = renderVenueLink(
              event,
              "w-full border border-black px-2 py-0.5 tracking-widest text-center sm:text-right inline-block"
            );
            const tintClass =
              event.theatre === "viff"
                ? "bg-yellow-50"
                : event.theatre === "rio"
                ? "bg-red-50"
                : event.theatre === "cinematheque"
                ? "bg-blue-50"
                : event.theatre === "park"
                ? "bg-gray-200"
                : "bg-gray-50";
            return (
              <div
                key={index}
                className={`border-b border-black last:border-b-0 px-3 py-3 text-sm sm:text-base font-black uppercase tracking-tight ${tintClass}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center gap-2 text-black whitespace-nowrap sm:flex-none">
                    <span className="text-lg sm:text-xl font-black">
                      {formatTime(event.start)}
                    </span>
                    <span className="text-gray-400">....</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEventLink(event)}
                    className="flex-1 text-left uppercase italic tracking-tight transition-colors hover:text-yellow-500 text-base sm:text-lg font-lora"
                  >
                    {parsed.title}
                  </button>
                  <div className="flex flex-col gap-2 text-[11px] sm:w-56 sm:text-xs sm:flex-none sm:items-end">
                    {venueLinkElement}
                    {renderHypeControl(event, parsed.title)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (theme === "billboard") {
      return (
        <>
          <div className="border-8 border-black bg-black text-white relative overflow-hidden">
            <div className="relative">
              <div className="flex gap-2 justify-between px-6 py-2">
                {Array.from({ length: 14 })!.map((_, bulbIndex) => (
                  <span
                    key={bulbIndex}
                    className={`w-3 h-3 rounded-full shadow-[0_0_6px_rgba(255,255,137,0.6)] billboard-bulb ${
                      bulbIndex % 3 === 0
                        ? "bg-yellow-300"
                        : bulbIndex % 3 === 1
                        ? "bg-red-300"
                        : "bg-blue-200"
                    }`}
                    style={{ animationDelay: `${bulbIndex * 0.12}s` }}
                  />
                ))}
              </div>
              {eventItems.map((event: CalendarInstance, index: number) => {
                const parsed = parseEventTitle(event.title, event);
                const venueLinkElement = renderVenueLink(
                  event,
                  "text-xs font-black uppercase tracking-[0.5em] text-white whitespace-nowrap font-bebas inline-block"
                );
                const accentColor =
                  event.theatre === "viff"
                    ? "text-yellow-300"
                    : event.theatre === "rio"
                    ? "text-red-300"
                    : event.theatre === "cinematheque"
                    ? "text-blue-200"
                    : event.theatre === "park"
                    ? "text-gray-300"
                    : "text-white";
                return (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row items-stretch"
                  >
                    <div className="bg-white text-black px-2.5 py-2 text-xl sm:text-3xl font-black tracking-[0.2em] flex items-center justify-center w-full sm:w-32 sm:flex-none shadow-[inset_0_0_10px_rgba(0,0,0,0.2)] font-bebas">
                      {formatTime(event.start)}
                    </div>
                    <div className="flex-1 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={() => openEventLink(event)}
                          className={`text-left text-xl sm:text-3xl font-black uppercase tracking-[0.4em] ${accentColor} hover:text-cyan-200 transition-colors drop-shadow-[0_0_6px_rgba(248,231,28,0.25)] font-bebas`}
                        >
                          {parsed.title}
                        </button>
                      </div>
                      <div>{venueLinkElement}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 justify-between px-6 py-2 border-x-8 border-b-8 border-black bg-black">
            {Array.from({ length: 14 })!.map((_, bulbIndex) => (
              <span
                key={`bottom-${bulbIndex}`}
                className={`w-3 h-3 rounded-full shadow-[0_0_6px_rgba(255,255,137,0.6)] billboard-bulb ${
                  bulbIndex % 3 === 0
                    ? "bg-yellow-300"
                    : bulbIndex % 3 === 1
                    ? "bg-red-300"
                    : "bg-blue-200"
                }`}
                style={{ animationDelay: `${0.1 + bulbIndex * 0.12}s` }}
              />
            ))}
          </div>
        </>
      );
    }

    return (
      <div className="space-y-2">
        {eventItems.map((event: CalendarInstance, index: number) => {
          const parsed = parseEventTitle(event.title, event);
          const venueLinkElement = renderVenueLink(
            event,
            "border-2 border-black bg-white px-3 py-1 text-center text-xs font-black uppercase tracking-widest text-black inline-block"
          );
          return (
            <div
              key={index}
              className={`border-4 border-black p-4 transition-colors ${
                event.theatre === "viff"
                  ? "bg-yellow-50 hover:bg-yellow-100"
                  : event.theatre === "rio"
                  ? "bg-red-50 hover:bg-red-100"
                  : event.theatre === "cinematheque"
                  ? "bg-blue-50 hover:bg-blue-100"
                  : event.theatre === "park"
                  ? "bg-gray-200 hover:bg-gray-300"
                  : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex flex-col gap-1 sm:flex-none">
                  <div className="text-3xl font-black text-black leading-none">
                    {formatTime(event.start)}
                  </div>
                  {parsed.duration && (
                    <span className="border-2 border-black px-2 py-0.5 text-xs font-black uppercase tracking-widest">
                      {parsed.duration}
                    </span>
                  )}
                </div>
                <div className="hidden sm:block w-1 self-stretch bg-black" />
                <div className="flex flex-1 items-center">
                  <button
                    onClick={() => openEventLink(event)}
                    className="text-3xl sm:text-4xl font-black text-black uppercase leading-tight text-left hover:text-yellow-600 transition-colors"
                  >
                    {parsed.title}
                  </button>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-60 sm:flex-none">
                  {venueLinkElement}
                  {renderHypeControl(event, parsed.title)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const toggleVenue = (venue: VenueFilter) => {
    setActiveVenues((prev) => {
      if (prev.includes(venue)) {
        return prev.filter((item) => item !== venue);
      }
      return [...prev, venue];
    });
  };

  const handleDateChange = (days: number) => {
    const newDate = addDaysInPst(date, days);
    const nextKey = formatDateKey(newDate);
    if (nextKey === displayKey) return;
    setPendingKey(nextKey);
    navigate({
      to: "/",
      search: {
        date: nextKey,
      },
    });
  };

  const handleTodayClick = () => {
    if (isToday) {
      return;
    }
    setPendingKey(todayKey);
    navigate({
      to: "/",
      search: {
        date: todayKey,
      },
    });
  };

  const handleCalendarDateSelect = (dateKey: string) => {
    if (dateKey === displayKey) {
      setShowCalendar(false);
      return;
    }
    setPendingKey(dateKey);
    navigate({
      to: "/",
      search: {
        date: dateKey,
      },
    });
    setShowCalendar(false);
  };

  const handleInfiniteScrollToggle = () => {
    setIsInfiniteScrollEnabled((prev) => {
      const nextValue = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("infiniteScrollEnabled", String(nextValue));
      }
      return nextValue;
    });
  };

  return (
    <>
      <div
        className={`min-h-screen ${backgroundClass} ${
          isBillboardTheme ? "text-white" : "text-black"
        } p-4`}
      >
        <div className="max-w-6xl mx-auto">
          <div className="mb-4">
            <div className={`${headerContainerClass} px-4 py-3 space-y-3`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div
                  className={`flex flex-col ${
                    isShowtimeTheme ? "gap-0.5" : ""
                  }`}
                >
                  <span
                    className={`text-[11px] font-black uppercase tracking-[0.5em] ${headerAccentTextClass} ${
                      isShowtimeTheme
                        ? "italic leading-tight font-lora"
                        : isBillboardTheme
                        ? "font-bebas"
                        : ""
                    }`}
                  >
                    LIVE LISTINGS / PST
                  </span>
                  <h1
                    className={`text-3xl sm:text-5xl font-black uppercase ${
                      isShowtimeTheme
                        ? "italic leading-tight font-lora"
                        : isBillboardTheme
                        ? "font-bebas leading-none"
                        : "leading-none"
                    }`}
                  >
                    VAN KINO CALENDAR
                  </h1>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-black uppercase ${
                      isBillboardTheme ? "font-bebas" : ""
                    }`}
                  >
                    Vancouver, BC
                  </p>
                  <p
                    className={`text-xs font-black uppercase tracking-widest ${
                      isBillboardTheme ? "font-bebas" : ""
                    }`}
                  >
                    FILM CALENDAR AGGREGATOR
                  </p>
                </div>
              </div>
              <div
                className={`${headerPanelClass} flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-2 px-3 py-2`}
              >
                <button
                  onClick={() => handleDateChange(-1)}
                  disabled={isInfiniteScrollEnabled}
                  className={`bg-black text-white px-4 py-2 text-sm font-black uppercase border-4 border-black transition-colors w-full sm:w-auto sm:self-stretch flex items-center justify-center ${
                    isInfiniteScrollEnabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-yellow-400 hover:text-black"
                  }`}
                >
                  ←
                </button>
                <div
                  className={`flex flex-col items-center text-center flex-1 justify-center ${
                    isShowtimeTheme ? "gap-0.5" : "gap-1"
                  }`}
                >
                  <span
                    className={`text-xs font-black uppercase tracking-[0.5em] ${headerAccentTextClass} ${
                      isShowtimeTheme
                        ? "italic leading-tight font-lora"
                        : isBillboardTheme
                        ? "font-bebas tracking-[0.3em]"
                        : ""
                    }`}
                  >
                    PROGRAMME DATE
                  </span>
                  <p
                    className={`text-4xl font-black uppercase ${
                      isShowtimeTheme
                        ? "italic leading-tight font-lora tracking-tighter"
                        : isBillboardTheme
                        ? "font-bebas tracking-wide"
                        : "tracking-tighter"
                    }`}
                  >
                    <span>
                      {weekdayLabels[activeWeekday] ?? weekdayLabel},{" "}
                    </span>
                    &nbsp;
                    {formatPstDisplay(date)}
                  </p>
                  <span
                    className={`text-xs font-black uppercase border-4 border-black px-2 py-0.5 tracking-widest ${
                      isToday
                        ? isBillboardTheme
                          ? "bg-yellow-400 text-black"
                          : "bg-green-400 text-black"
                        : "hidden"
                    }`}
                  >
                    TODAY
                  </span>
                </div>
                <button
                  onClick={() => handleDateChange(1)}
                  disabled={isInfiniteScrollEnabled}
                  className={`bg-black text-white px-4 py-2 text-sm font-black uppercase border-4 border-black transition-colors w-full sm:w-auto sm:self-stretch flex items-center justify-center ${
                    isInfiniteScrollEnabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-yellow-400 hover:text-black"
                  }`}
                >
                  →
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <button
                  onClick={handleTodayClick}
                  disabled={isToday}
                  className={`px-4 py-2 text-sm font-black uppercase border-4 border-black transition-colors w-full sm:w-auto ${
                    isToday
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-white text-black hover:bg-yellow-400"
                  }`}
                >
                  GO TO TODAY
                </button>
                <button
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="bg-white text-black px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-yellow-400 transition-colors w-full sm:w-auto"
                >
                  {showCalendar ? "HIDE CALENDAR" : "SHOW CALENDAR"}
                </button>
                <div
                  className="relative w-full sm:w-auto"
                  style={{ minWidth: "160px" }}
                >
                  <button
                    type="button"
                    onClick={() => setShowThemePicker((value) => !value)}
                    className="w-full bg-white text-black px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-yellow-400 transition-colors"
                  >
                    THEME
                  </button>
                  {showThemePicker && (
                    <div className="absolute z-10 mt-2 min-w-full w-max bg-white border-4 border-black shadow-lg">
                      {(
                        [
                          { label: "FESTIVAL", value: "festival" },
                          { label: "SHOWTIME", value: "showtime" },
                          { label: "BILLBOARD", value: "billboard" },
                        ] as { label: string; value: ThemeMode }[]
                      ).map((option, index, array) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setTheme(option.value);
                            window.localStorage.setItem(
                              "activeTheme",
                              option.value
                            );
                            setShowThemePicker(false);
                          }}
                          className={`w-full px-4 py-2 text-sm font-black uppercase border-b-4 border-black ${
                            index === array.length - 1 ? "last:border-b-0" : ""
                          } transition-colors ${
                            theme === option.value
                              ? "bg-black text-white"
                              : "bg-white text-black hover:bg-yellow-200"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleInfiniteScrollToggle}
                  className={`px-4 py-2 text-sm font-black uppercase border-4 border-black transition-colors w-full sm:w-auto ${
                    isInfiniteScrollEnabled
                      ? "bg-green-400 text-black"
                      : "bg-white text-black hover:bg-yellow-400"
                  }`}
                >
                  {isInfiniteScrollEnabled
                    ? "DISABLE INFINITE SCROLL"
                    : "ENABLE INFINITE SCROLL"}
                </button>
                {debugEnabled && (
                  <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="bg-red-500 text-white px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-red-600 transition-colors w-full sm:w-auto"
                  >
                    {showDebug ? "HIDE DEBUG" : "SHOW DEBUG"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {hypeError && (
            <div
              className="mb-4 border-4 border-black bg-red-100 text-black px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              role="alert"
            >
              <span className="text-xs sm:text-sm font-black uppercase tracking-[0.3em]">
                {hypeError}
              </span>
              <button
                type="button"
                onClick={() => setHypeError(null)}
                className="bg-black text-white px-3 py-1 text-xs font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-colors"
              >
                DISMISS
              </button>
            </div>
          )}

          {showCalendar && (
            <div className="mb-4 max-w-md">
              <Calendar
                selectedDate={date}
                onDateSelect={handleCalendarDateSelect}
                onClose={() => setShowCalendar(false)}
              />
            </div>
          )}

          {showDebug && debugEnabled && (
            <div className="mb-4 border-4 border-black bg-white p-4">
              <div className="mb-2">
                <h2 className="text-lg font-black uppercase mb-2">
                  DEBUG JSON RESPONSE
                </h2>
                <button
                  onClick={() => setShowDebug(false)}
                  className="bg-black text-white px-3 py-1 text-xs font-black uppercase border-2 border-black hover:bg-red-500 transition-colors"
                >
                  CLOSE
                </button>
              </div>
              <pre className="bg-gray-100 p-4 border-2 border-black overflow-auto text-xs font-mono">
                {JSON.stringify(loaderData, null, 2)}
              </pre>
            </div>
          )}

          <div className="grid grid-cols-2 sm:flex gap-2 mb-4">
            <button
              onClick={() => setActiveVenues([...venueFilters])}
              className={`w-full sm:w-auto px-4 py-2 text-sm font-black uppercase border-4 border-black transition-colors ${
                activeVenues.length === venueFilters.length
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-yellow-400"
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setActiveVenues([])}
              className={`w-full sm:w-auto px-4 py-2 text-sm font-black uppercase border-4 border-black transition-colors ${
                activeVenues.length === 0
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-yellow-400"
              }`}
            >
              NONE
            </button>
            {venueFilters.map((venue) => (
              <button
                key={venue}
                onClick={() => toggleVenue(venue)}
                className={`w-full sm:w-auto px-4 py-2 text-sm font-black uppercase border-4 border-black transition-colors ${
                  activeVenues.includes(venue)
                    ? "bg-black text-white"
                    : "bg-white text-black hover:bg-yellow-400"
                }`}
              >
                {venue.toUpperCase()}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-black text-base font-bold border-4 border-black p-4 bg-yellow-200 animate-pulse text-center">
              FETCHING LATEST PROGRAMME…
            </div>
          ) : isInfiniteScrollEnabled ? (
            infiniteDayData.length === 0 ? (
              renderThemeLayout(filteredData)
            ) : (
              <div className="space-y-6">
                {infiniteDayData.map((day) => (
                  <section key={day.dateKey} className="space-y-3">
                    <div
                      className={`${
                        isBillboardTheme
                          ? "border-4 border-yellow-400 bg-black text-yellow-200"
                          : "border-4 border-black bg-white text-black"
                      } px-4 py-2`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p
                          className={`font-black uppercase text-3xl sm:text-4xl tracking-tight ${
                            isBillboardTheme
                              ? "font-bebas tracking-[0.2em]"
                              : isShowtimeTheme
                              ? "italic font-lora"
                              : ""
                          }`}
                        >
                          {day.label}
                        </p>
                        {day.isToday && (
                          <span
                            className={`text-xs font-black uppercase border-2 border-black px-2 py-0.5 ${
                              isBillboardTheme
                                ? "bg-yellow-400 text-black"
                                : "bg-green-400 text-black"
                            }`}
                          >
                            TODAY
                          </span>
                        )}
                      </div>
                    </div>
                    {renderThemeLayout(day.events)}
                  </section>
                ))}
                <div
                  ref={infiniteSentinelRef}
                  className="h-2 w-full"
                  aria-hidden="true"
                />
                {isFetchingNextDay && (
                  <div className="text-black text-base font-bold border-4 border-black p-4 bg-yellow-200 text-center">
                    LOADING NEXT DAY…
                  </div>
                )}
              </div>
            )
          ) : (
            renderThemeLayout(filteredData)
          )}
        </div>
      </div>

      <footer
        className={`border-t ${
          isBillboardTheme ? "border-gray-700" : "border-white/20"
        } ${isBillboardTheme ? "mt-0" : "mt-8"} ${
          isBillboardTheme ? "bg-gray-800" : "bg-black"
        } text-white`}
      >
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 sm:gap-12">
            <div className="sm:flex-1">
              <p className="text-sm uppercase tracking-widest opacity-90">
                Van Kino Calendar
              </p>
              <p className="mt-2 text-sm font-lora opacity-60">
                Aggregating Vancouver art cinema listings
              </p>
            </div>
            <div className="sm:flex-1">
              <p className="text-sm font-lora opacity-90">
                Made with{" "}
                <button
                  onClick={handleHeartClick}
                  className="cursor-pointer hover:scale-110 transition-transform inline-block"
                  aria-label="Toggle debug mode"
                >
                  💚
                </button>{" "}
                in Vancouver by{" "}
                <a
                  href="https://sina.town"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  Sina
                </a>
              </p>
              <p className="mt-3 text-sm font-lora opacity-60">
                <a
                  href="https://github.com/sinakhalili/van-kino-calendar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400/80 hover:text-yellow-300 transition-colors"
                >
                  GitHub
                </a>
                {" · "}
                <a
                  href="https://cloud.umami.is/analytics/eu/share/tCcvXWtDXOdQOcqx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400/80 hover:text-yellow-300 transition-colors"
                >
                  Analytics
                </a>
              </p>
            </div>
            <div className="sm:flex-1 sm:text-right">
              <p className="text-sm uppercase tracking-widest opacity-90">
                Sources
              </p>
              <p className="mt-2 text-sm font-lora opacity-60">
                <a
                  href="https://viff.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400/80 hover:text-yellow-300 transition-colors"
                >
                  VIFF
                </a>
                {" · "}
                <a
                  href="https://riotheatre.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400/80 hover:text-yellow-300 transition-colors"
                >
                  Rio Theatre
                </a>
                {" · "}
                <a
                  href="https://thecinematheque.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400/80 hover:text-yellow-300 transition-colors"
                >
                  The Cinematheque
                </a>
                {" · "}
                <a
                  href="https://www.theparktheatre.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400/80 hover:text-yellow-300 transition-colors"
                >
                  The Park
                </a>
              </p>
              <p className="mt-3 text-xs font-lora opacity-40">
                All content belongs to respective venues
              </p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
