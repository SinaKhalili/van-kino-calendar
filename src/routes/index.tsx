import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { parseEventTitle, formatTime, formatVenue } from "../utils/parsers";
import { getEventsForDate } from "../data/events.server";
import { CalendarInstance } from "../utils/types";
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

type FilterType = "all" | "viff" | "rio" | "cinematheque";
const weekdayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function App() {
  const { events, dateIso, dateKey: loaderDateKey } = Route.useLoaderData();
  const search = Route.useSearch();
  const fallbackDate = parseDateKey(loaderDateKey) ?? new Date(dateIso);
  const fallbackKey = loaderDateKey || formatDateKey(fallbackDate);
  const activeKey = isValidDateKey(search.date) ? search.date : fallbackKey;
  const date = parseDateKey(activeKey) ?? fallbackDate;
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>("all");
  const weekdayLabel = getWeekdayLabel(date);
  const weekdayIndex = weekdayLabels.indexOf(weekdayLabel);
  const activeWeekday = weekdayIndex === -1 ? 0 : weekdayIndex;
  const todayKey = getTodayDateKey();
  const isToday = activeKey === todayKey;

  const filteredData = events.filter((event: CalendarInstance) => {
    if (filter === "all") return true;
    return event.theatre === filter;
  });

  const handleDateChange = (days: number) => {
    const newDate = addDaysInPst(date, days);
    const nextKey = formatDateKey(newDate);
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

    navigate({
      to: "/",
      search: {
        date: todayKey,
      },
    });
  };

  return (
    <>
      <div className="min-h-screen bg-white text-black p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-3">
            <div className="hidden sm:grid grid-cols-7 gap-2">
              {weekdayLabels.map((label, index) => (
                <div
                  key={label}
                  className={`text-center text-xs font-black uppercase border-4 border-black py-1 tracking-wider ${
                    index === activeWeekday
                      ? "bg-black text-white"
                      : "bg-white text-black"
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
            <div
              className="flex sm:hidden gap-2 overflow-x-auto pb-1"
              role="tablist"
            >
              {weekdayLabels.map((label, index) => (
                <div
                  key={label}
                  className={`min-w-[64px] text-center text-[10px] font-black uppercase border-4 border-black py-1 tracking-wider ${
                    index === activeWeekday
                      ? "bg-black text-white"
                      : "bg-white text-black"
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 border-4 border-black bg-white px-3 py-2">
                <button
                  onClick={() => handleDateChange(-1)}
                  className="bg-black text-white px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-yellow-400 hover:text-black transition-colors w-full sm:w-auto"
                >
                  ←
                </button>
                <div className="flex flex-col items-center gap-1 text-center flex-1">
                  <span className="text-xs font-black uppercase tracking-[0.5em]">
                    PROGRAMME DATE
                  </span>
                  <p className="text-4xl font-black uppercase tracking-tighter">
                    {formatPstDisplay(date)}
                  </p>
                  <span
                    className={`text-xs font-black uppercase border-4 border-black px-2 py-0.5 tracking-widest ${
                      isToday
                        ? "bg-green-400 text-black"
                        : "bg-white text-black"
                    }`}
                  >
                    {isToday
                      ? "TODAY"
                      : `${
                          weekdayLabels[activeWeekday] ?? weekdayLabel
                        } SCHEDULE`}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleTodayClick}
                    disabled={isToday}
                    className={`px-4 py-2 text-sm font-black uppercase border-4 border-black transition-colors ${
                      isToday
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-white text-black hover:bg-yellow-400"
                    }`}
                  >
                    TODAY
                  </button>
                  <button
                    onClick={() => handleDateChange(1)}
                    className="bg-black text-white px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-yellow-400 hover:text-black transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex gap-2 mb-4">
            <button
              onClick={() => setFilter("all")}
              className={`w-full sm:w-auto px-4 py-2 text-sm font-black uppercase border-4 border-black transition-colors ${
                filter === "all"
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-yellow-400"
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setFilter("viff")}
              className={`w-full sm:w-auto px-4 py-2 text-sm font-black uppercase border-4 border-black transition-colors ${
                filter === "viff"
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-yellow-400"
              }`}
            >
              VIFF
            </button>
            <button
              onClick={() => setFilter("rio")}
              className={`w-full sm:w-auto px-4 py-2 text-sm font-black uppercase border-4 border-black transition-colors ${
                filter === "rio"
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-yellow-400"
              }`}
            >
              RIO
            </button>
            <button
              onClick={() => setFilter("cinematheque")}
              className={`w-full sm:w-auto px-4 py-2 text-sm font-black uppercase border-4 border-black transition-colors ${
                filter === "cinematheque"
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-yellow-400"
              }`}
            >
              CINEMATHEQUE
            </button>
          </div>

          {filteredData.length === 0 ? (
            <div className="text-black text-base font-bold border-4 border-black p-2 bg-yellow-400">
              NO EVENTS FOUND
            </div>
          ) : (
            <div className="space-y-2">
              {filteredData.map((event: CalendarInstance, index: number) => {
                const parsed = parseEventTitle(event.title, event);
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
                          <div className="text-xs sm:text-sm font-bold text-black mt-1 uppercase tracking-wide">
                            {formatTime(event.end)}
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
                                {event.theatre === "rio"
                                  ? "RIO THEATRE"
                                  : event.theatre === "cinematheque"
                                  ? "THE CINEMATHEQUE"
                                  : formatVenue(event.resourceId)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t-4 border-black">
                          <button
                            className="bg-black text-white px-2 py-1 text-xs font-black uppercase tracking-[0.2em] hover:bg-yellow-400 hover:text-black border-4 border-black transition-colors w-full sm:w-auto"
                            onClick={() => {
                              if (event.moreInfoUrl) {
                                window.open(event.moreInfoUrl, "_blank");
                              } else {
                                const moreInfoMatch = event.title.match(
                                  /href="([^"]+)">\s*More Info/
                                );
                                if (moreInfoMatch) {
                                  window.open(moreInfoMatch[1], "_blank");
                                }
                              }
                            }}
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
      <footer className="border-t-8 bg-black text-white mt-8">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs sm:text-sm font-black ">
          made with 💚 in vancouver by{" "}
          <a
            href="https://sina.town"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-400 hover:text-yellow-300 transition-colors"
          >
            sina
          </a>
        </div>
      </footer>
    </>
  );
}
