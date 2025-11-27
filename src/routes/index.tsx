import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { parseEventTitle, formatTime, formatVenue } from "../utils/parsers";
import { getEventsForDate } from "../data/events.server";
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

type VenueFilter = "viff" | "rio" | "cinematheque";
const venueFilters: VenueFilter[] = ["viff", "rio", "cinematheque"];
const weekdayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type ThemeMode = "festival" | "showtime";

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
  const [theme, setTheme] = useState<ThemeMode>("festival");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [heartClickCount, setHeartClickCount] = useState(0);
  const [heartClickTimeout, setHeartClickTimeout] =
    useState<NodeJS.Timeout | null>(null);
  const isLoading = Boolean(pendingKey);

  useEffect(() => {
    const enabled = localStorage.getItem("debugEnabled") === "true";
    setDebugEnabled(enabled);
  }, []);

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

  const filteredData =
    activeVenues.length === 0
      ? []
      : events.filter((event: CalendarInstance) =>
          activeVenues.includes(event.theatre as VenueFilter)
        );

  const getVenueLabel = (event: CalendarInstance) => {
    if (event.theatre === "rio") {
      return "RIO THEATRE";
    }
    if (event.theatre === "cinematheque") {
      return "THE CINEMATHEQUE";
    }
    return formatVenue(event.resourceId);
  };

  const openEventLink = (event: CalendarInstance) => {
    const fallbackMatch = event.title.match(/href="([^"]+)">\s*More Info/);
    const targetUrl = event.moreInfoUrl || fallbackMatch?.[1];
    if (targetUrl) {
      window.open(targetUrl, "_blank");
    }
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

  return (
    <>
      <div className="min-h-screen bg-[#fdf9f3] text-black p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4">
            <div className="border-8 border-black bg-yellow-200 px-4 py-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-[11px] font-black uppercase tracking-[0.5em]">
                    LIVE LISTINGS / PST
                  </span>
                  <h1 className="text-3xl sm:text-5xl font-black uppercase leading-none">
                    VAN KINO CALENDAR
                  </h1>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black uppercase">Vancouver, BC</p>
                  <p className="text-xs font-black uppercase tracking-widest">
                    FILM CALENDAR AGGREGATOR
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-2 border-4 border-black bg-white px-3 py-2">
                <button
                  onClick={() => handleDateChange(-1)}
                  className="bg-black text-white px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-yellow-400 hover:text-black transition-colors w-full sm:w-auto sm:self-stretch flex items-center justify-center"
                >
                  ←
                </button>
                <div className="flex flex-col items-center gap-1 text-center flex-1 justify-center">
                  <span className="text-xs font-black uppercase tracking-[0.5em]">
                    PROGRAMME DATE
                  </span>
                  <p className="text-4xl font-black uppercase tracking-tighter">
                    <span>
                      {weekdayLabels[activeWeekday] ?? weekdayLabel},{" "}
                    </span>
                    &nbsp;
                    {formatPstDisplay(date)}
                  </p>
                  <span
                    className={`text-xs font-black uppercase border-4 border-black px-2 py-0.5 tracking-widest ${
                      isToday ? "bg-green-400 text-black" : "hidden"
                    }`}
                  >
                    TODAY
                  </span>
                </div>
                <button
                  onClick={() => handleDateChange(1)}
                  className="bg-black text-white px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-yellow-400 hover:text-black transition-colors w-full sm:w-auto sm:self-stretch flex items-center justify-center"
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
                <div className="relative w-full sm:w-auto" style={{ minWidth: "160px" }}>
                  <button
                    type="button"
                    onClick={() => setShowThemePicker((value) => !value)}
                    className="w-full bg-white text-black px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-yellow-400 transition-colors"
                  >
                    THEME
                  </button>
                  {showThemePicker && (
                    <div className="absolute z-10 mt-2 min-w-full w-max bg-white border-4 border-black shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setTheme("festival");
                          setShowThemePicker(false);
                        }}
                        className={`w-full px-4 py-2 text-sm font-black uppercase border-b-4 border-black last:border-b-0 transition-colors ${
                          theme === "festival"
                            ? "bg-black text-white"
                            : "bg-white text-black hover:bg-yellow-200"
                        }`}
                      >
                        FESTIVAL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTheme("showtime");
                          setShowThemePicker(false);
                        }}
                        className={`w-full px-4 py-2 text-sm font-black uppercase border-b-4 border-black last:border-b-0 transition-colors ${
                          theme === "showtime"
                            ? "bg-black text-white"
                            : "bg-white text-black hover:bg-yellow-200"
                        }`}
                      >
                        SHOWTIME
                      </button>
                    </div>
                  )}
                </div>
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
          ) : filteredData.length === 0 ? (
            <div className="text-black text-base font-bold border-4 border-black p-2 bg-yellow-400">
              NO EVENTS FOUND
            </div>
          ) : theme === "showtime" ? (
            <div className="border-4 border-black bg-white">
              {filteredData.map((event: CalendarInstance, index: number) => {
                const parsed = parseEventTitle(event.title, event);
                const venueLabel = getVenueLabel(event);
                const tintClass =
                  event.theatre === "viff"
                    ? "bg-yellow-50"
                    : event.theatre === "rio"
                    ? "bg-red-50"
                    : event.theatre === "cinematheque"
                    ? "bg-blue-50"
                    : "bg-gray-50";
                return (
                  <div
                    key={index}
                    className={`flex flex-wrap sm:flex-nowrap items-center gap-2 border-b border-black last:border-b-0 px-3 py-3 text-sm sm:text-base font-black uppercase tracking-tight ${tintClass}`}
                  >
                    <span className="text-lg sm:text-xl font-black text-black">
                      {formatTime(event.start)}
                    </span>
                    <span className="text-gray-400">....</span>
                    <button
                      type="button"
                      onClick={() => openEventLink(event)}
                      className="flex-1 min-w-[200px] text-left uppercase italic tracking-tight transition-colors hover:text-yellow-500"
                    >
                      {parsed.title}
                    </button>
                    <span className="text-[11px] sm:text-xs border border-black px-2 py-0.5 tracking-widest">
                      {venueLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredData.map((event: CalendarInstance, index: number) => {
                const parsed = parseEventTitle(event.title, event);
                const venueLabel = getVenueLabel(event);
                return (
                  <div
                    key={index}
                    className={`border-4 border-black p-4 transition-colors ${
                      event.theatre === "viff"
                        ? "bg-yellow-50 hover:bg-yellow-100"
                        : event.theatre === "rio"
                        ? "bg-red-50 hover:bg-red-100"
                        : "bg-blue-50 hover:bg-blue-100"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex sm:block items-center gap-2 border-black sm:border-r-4 border-b-4 sm:border-b-0 pr-0 sm:pr-4 pb-3 sm:pb-0">
                        <div>
                          <div className="text-2xl sm:text-3xl font-black text-black leading-none">
                            {formatTime(event.start)}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="mb-2 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-black text-black uppercase leading-tight">
                              {parsed.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase text-black">
                              {parsed.duration && (
                                <span className="border-2 border-black px-2 py-0.5 tracking-widest">
                                  {parsed.duration}
                                </span>
                              )}
                              <span className="border-2 border-black px-2 py-0.5 tracking-widest">
                                {venueLabel}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t-4 border-black">
                          <button
                            className="bg-black text-white px-2 py-1 text-xs font-black uppercase tracking-[0.2em] hover:bg-yellow-400 hover:text-black border-4 border-black transition-colors w-full sm:w-auto"
                            onClick={() => openEventLink(event)}
                          >
                            MORE INFO →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t-8 border-white bg-black text-white mt-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="relative py-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              <div className="text-center text-xs sm:text-sm font-black uppercase sm:flex-1">
                <p>Van Kino Calendar</p>
                <p className="mt-2 text-[10px] sm:text-xs opacity-80">
                  Aggregating Vancouver art cinema listings
                </p>
              </div>
              <div className="hidden sm:block absolute left-1/3 top-0 bottom-0 w-1 bg-white -translate-x-1/2"></div>
              <div className="text-center text-xs sm:text-sm font-black sm:flex-1 uppercase">
                made with{" "}
                <button
                  onClick={handleHeartClick}
                  className="cursor-pointer hover:scale-110 transition-transform inline-block"
                  aria-label="Toggle debug mode"
                >
                  💚
                </button>{" "}
                in vancouver by{" "}
                <a
                  href="https://sina.town"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  sina
                </a>
                <p className="mt-2 text-[10px] sm:text-xs opacity-80">
                  View the source code on{" "}
                  <a
                    href="https://github.com/sinakhalili/van-kino-calendar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    GitHub
                  </a>
                </p>
                <p className="mt-2 text-[10px] sm:text-xs opacity-80">
                  Open analytics on{" "}
                  <a
                    href="https://cloud.umami.is/analytics/eu/share/tCcvXWtDXOdQOcqx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    Umami
                  </a>
                </p>
              </div>
              <div className="text-center text-xs sm:text-sm font-black sm:flex-1">
                <p className="uppercase">Sources</p>
                <p className="mt-2 text-[10px] sm:text-xs opacity-80">
                  <a
                    href="https://viff.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    VIFF
                  </a>{" "}
                  •{" "}
                  <a
                    href="https://riotheatre.ca"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    Rio Theatre
                  </a>{" "}
                  •{" "}
                  <a
                    href="https://thecinematheque.ca"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    The Cinematheque
                  </a>
                </p>
                <p className="mt-2 text-[10px] sm:text-xs opacity-80 uppercase">
                  All content and trademarks belong to their respective venues.
                  This is an independent, non-commercial aggregator.
                </p>
              </div>
              <div className="hidden sm:block absolute left-2/3 top-0 bottom-0 w-1 bg-white -translate-x-1/2"></div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
