import { CalendarInstance } from "./types";

export interface MarathonStats {
  filmCount: number;
  screenTimeMinutes: number;
  totalTimeMinutes: number;
  venueChanges: number;
}

export interface MarathonResult {
  schedule: CalendarInstance[];
  stats: MarathonStats;
}

const TRAVEL_BUFFER_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Calculate the maximum number of movies you can see in a day.
 * Uses greedy interval scheduling: sort by end time, pick greedily.
 * Adds travel buffer when switching venues.
 */
export function calculateMarathon(events: CalendarInstance[]): MarathonResult {
  if (events.length === 0) {
    return {
      schedule: [],
      stats: { filmCount: 0, screenTimeMinutes: 0, totalTimeMinutes: 0, venueChanges: 0 },
    };
  }

  // Sort by end time
  const sorted = [...events].sort(
    (a, b) => new Date(a.end).getTime() - new Date(b.end).getTime()
  );

  const schedule: CalendarInstance[] = [];
  let lastEnd = 0;
  let lastVenue: string | null = null;
  let venueChanges = 0;

  for (const movie of sorted) {
    const movieStart = new Date(movie.start).getTime();
    const movieEnd = new Date(movie.end).getTime();

    // Calculate required gap
    const requiredGap = lastVenue && lastVenue !== movie.theatre ? TRAVEL_BUFFER_MS : 0;
    const earliestStart = lastEnd + requiredGap;

    if (movieStart >= earliestStart) {
      // Count venue change
      if (lastVenue && lastVenue !== movie.theatre) {
        venueChanges++;
      }

      schedule.push(movie);
      lastEnd = movieEnd;
      lastVenue = movie.theatre;
    }
  }

  // Calculate stats
  const screenTimeMinutes = schedule.reduce((sum, movie) => {
    const start = new Date(movie.start).getTime();
    const end = new Date(movie.end).getTime();
    return sum + (end - start) / (1000 * 60);
  }, 0);

  const totalTimeMinutes =
    schedule.length > 0
      ? (new Date(schedule[schedule.length - 1].end).getTime() -
          new Date(schedule[0].start).getTime()) /
        (1000 * 60)
      : 0;

  return {
    schedule,
    stats: {
      filmCount: schedule.length,
      screenTimeMinutes: Math.round(screenTimeMinutes),
      totalTimeMinutes: Math.round(totalTimeMinutes),
      venueChanges,
    },
  };
}

/**
 * Format minutes as "Xh Ym"
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
