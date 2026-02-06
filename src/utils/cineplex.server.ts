import { CalendarInstance } from "./types";
import { formatDateKey } from "./date-helpers";

const CINEPLEX_API_BASE = "https://apis.cineplex.com/prod/cpx/theatrical/api";
const CINEPLEX_API_KEY = "dcdac5601d864addbc2675a2e96cb1f8";

// Vancouver Cineplex theatre IDs
const VANCOUVER_THEATRES = [
  { id: "1149", name: "Fifth Avenue Cinemas", slug: "fifth-avenue" as const },
  { id: "1147", name: "International Village", slug: "international-village" as const },
];

interface CineplexSession {
  showStartDateTime: string;
  showStartDateTimeUtc: string;
  seatsRemaining: number;
  isSoldOut: boolean;
  auditorium: string;
  ticketingUrl?: string;
}

interface CineplexExperience {
  experienceTypes: string[];
  sessions: CineplexSession[];
}

interface CineplexMovie {
  id: number;
  name: string;
  filmUrl: string;
  runtimeInMinutes: number;
  genres: string[];
  localRating?: string;
  warnings?: string[];
  experiences: CineplexExperience[];
}

interface CineplexDate {
  startDate: string;
  movies: CineplexMovie[];
}

interface CineplexTheatreShowtimes {
  theatre: string;
  theatreId: number;
  dates: CineplexDate[];
}

async function fetchCineplexShowtimes(
  theatreId: string
): Promise<CineplexTheatreShowtimes[]> {
  const url = new URL(`${CINEPLEX_API_BASE}/v1/showtimes`);
  url.searchParams.set("language", "en-us");
  url.searchParams.set("LocationId", theatreId);

  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      "Ocp-Apim-Subscription-Key": CINEPLEX_API_KEY,
    },
  });

  if (!response.ok) {
    console.error(
      `Cineplex API error for theatre ${theatreId}: ${response.status}`
    );
    return [];
  }

  return response.json();
}

export async function fetchCineplexEvents(
  date: Date = new Date(),
  targetKey?: string
): Promise<CalendarInstance[]> {
  const events: CalendarInstance[] = [];
  const targetDateKey = targetKey ?? formatDateKey(date);

  // Fetch showtimes from all Vancouver Cineplex theatres in parallel
  const allShowtimes = await Promise.all(
    VANCOUVER_THEATRES.map((theatre) => fetchCineplexShowtimes(theatre.id))
  );

  for (let i = 0; i < VANCOUVER_THEATRES.length; i++) {
    const theatre = VANCOUVER_THEATRES[i];
    const showtimesData = allShowtimes[i];

    for (const theatreData of showtimesData) {
      for (const dateData of theatreData.dates) {
        for (const movie of dateData.movies) {
          for (const experience of movie.experiences) {
            for (const session of experience.sessions) {
              // Parse the showtime — use the UTC field since showStartDateTime
              // is a timezone-naive local string that CF Workers parses as UTC
              const startDate = new Date(session.showStartDateTimeUtc);

              // Check if this showtime is for the target date
              if (formatDateKey(startDate) !== targetDateKey) {
                continue;
              }

              // Calculate end time from runtime
              const endDate = new Date(
                startDate.getTime() + movie.runtimeInMinutes * 60 * 1000
              );

              // Build experience string (e.g., "3D", "IMAX", "UltraAVX")
              const experienceStr =
                experience.experienceTypes.length > 0
                  ? ` (${experience.experienceTypes.join(", ")})`
                  : "";

              // Build more info string
              const moreInfoParts: string[] = [];
              if (movie.genres.length > 0) {
                moreInfoParts.push(movie.genres.join(", "));
              }
              if (movie.localRating) {
                moreInfoParts.push(`Rated ${movie.localRating}`);
              }
              if (movie.runtimeInMinutes) {
                moreInfoParts.push(`${movie.runtimeInMinutes} min`);
              }
              if (session.auditorium) {
                moreInfoParts.push(session.auditorium);
              }
              if (session.isSoldOut) {
                moreInfoParts.push("SOLD OUT");
              } else if (session.seatsRemaining < 20) {
                moreInfoParts.push(`${session.seatsRemaining} seats left`);
              }

              events.push({
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                resourceId: theatre.slug,
                title: `${movie.name}${experienceStr}`,
                moreInfo: moreInfoParts.join(" • "),
                eventType: movie.genres.includes("Documentary")
                  ? "Documentary"
                  : "Film",
                theatre: theatre.slug,
                moreInfoUrl: `https://www.cineplex.com/movie/${movie.filmUrl}`,
              });
            }
          }
        }
      }
    }
  }

  return events;
}
