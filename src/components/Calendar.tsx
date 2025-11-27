import { useState, useEffect } from "react";
import {
  formatDateKey,
  parseDateKey,
  getTodayDateKey,
  PST_TIME_ZONE,
} from "../utils/date-helpers";

interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (dateKey: string) => void;
  onClose?: () => void;
}

// Helper to get PST date components
function getPstDateComponents(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PST_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === "year")?.value || "0");
  const month = parseInt(parts.find((p) => p.type === "month")?.value || "0");
  const day = parseInt(parts.find((p) => p.type === "day")?.value || "0");
  return { year, month, day };
}

// Helper to create a date in PST (at noon PST to avoid timezone edge cases)
function createPstDate(year: number, month: number, day: number): Date {
  // Create a date string in PST format and parse it
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;
  return parseDateKey(dateStr) || new Date();
}

export default function Calendar({
  selectedDate,
  onDateSelect,
  onClose,
}: CalendarProps) {
  const todayKey = getTodayDateKey();
  const selectedKey = formatDateKey(selectedDate);

  // Get PST components of selected date
  const selectedPst = getPstDateComponents(selectedDate);

  // Track the month being viewed (starts with selected date's month in PST)
  const [viewMonth, setViewMonth] = useState(() => {
    return createPstDate(selectedPst.year, selectedPst.month, 1);
  });

  // Update view month when selected date changes (but only if it's a different month)
  useEffect(() => {
    const currentSelectedPst = getPstDateComponents(selectedDate);
    const currentViewPst = getPstDateComponents(viewMonth);
    if (
      currentSelectedPst.year !== currentViewPst.year ||
      currentSelectedPst.month !== currentViewPst.month
    ) {
      const selectedMonth = createPstDate(
        currentSelectedPst.year,
        currentSelectedPst.month,
        1
      );
      setViewMonth(selectedMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Get PST components of view month
  const viewPst = getPstDateComponents(viewMonth);
  const year = viewPst.year;
  const month = viewPst.month;

  // Get first day of month in PST
  const firstDay = createPstDate(year, month, 1);

  // Calculate days in month: create date for next month's first day, then subtract 1 day
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthFirst = createPstDate(nextYear, nextMonth, 1);
  // Subtract 1 day in PST
  const lastDay = new Date(nextMonthFirst);
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  const lastDayPst = getPstDateComponents(lastDay);
  const daysInMonth = lastDayPst.day;

  // Get the day of the week for the first day (0 = Sunday, 6 = Saturday) in PST
  const firstDayOfWeek = firstDay.getUTCDay();

  // Month and year display
  const monthYearFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PST_TIME_ZONE,
    month: "long",
    year: "numeric",
  });

  const monthYear = monthYearFormatter.format(viewMonth);
  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  const handlePrevMonth = () => {
    setViewMonth((currentViewMonth) => {
      const currentPst = getPstDateComponents(currentViewMonth);
      const newMonth = currentPst.month === 1 ? 12 : currentPst.month - 1;
      const newYear =
        currentPst.month === 1 ? currentPst.year - 1 : currentPst.year;
      return createPstDate(newYear, newMonth, 1);
    });
  };

  const handleNextMonth = () => {
    setViewMonth((currentViewMonth) => {
      const currentPst = getPstDateComponents(currentViewMonth);
      const newMonth = currentPst.month === 12 ? 1 : currentPst.month + 1;
      const newYear =
        currentPst.month === 12 ? currentPst.year + 1 : currentPst.year;
      return createPstDate(newYear, newMonth, 1);
    });
  };

  const handleDateClick = (day: number) => {
    const date = createPstDate(year, month, day);
    onDateSelect(formatDateKey(date));
    onClose?.();
  };

  return (
    <div className="border-4 border-black bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="bg-black text-white px-3 py-1 text-sm font-black uppercase border-4 border-black hover:bg-yellow-400 hover:text-black transition-colors"
        >
          ←
        </button>
        <h3 className="text-lg font-black uppercase">{monthYear}</h3>
        <button
          onClick={handleNextMonth}
          className="bg-black text-white px-3 py-1 text-sm font-black uppercase border-4 border-black hover:bg-yellow-400 hover:text-black transition-colors"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekdayLabels.map((label, index) => (
          <div
            key={index}
            className="text-center text-xs font-black uppercase py-1"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before the first day of the month */}
        {Array.from({ length: firstDayOfWeek }).map((_, index) => (
          <div key={`empty-${index}`} className="aspect-square" />
        ))}

        {/* Days of the month */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const date = createPstDate(year, month, day);
          const dateKey = formatDateKey(date);
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedKey;

          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              className={`aspect-square text-sm font-black uppercase border-4 border-black transition-colors ${
                isSelected
                  ? "bg-black text-white"
                  : isToday
                  ? "bg-yellow-400 text-black"
                  : "bg-white text-black hover:bg-yellow-200"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
