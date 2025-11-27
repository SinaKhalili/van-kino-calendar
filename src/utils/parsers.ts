import { CalendarInstance } from "./types";
import { PST_TIME_ZONE } from "./date-helpers";

export function parseEventTitle(html: string, event: CalendarInstance) {
  // For Rio and Cinematheque events, title is already plain text
  if (event.theatre === "rio" || event.theatre === "cinematheque") {
    return {
      title: event.title,
      time: "",
      duration: "",
      description: event.moreInfo
        ? event.moreInfo
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 200)
        : "",
    };
  }

  // For VIFF events, parse HTML
  const titleMatch = html.match(/<h3[^>]*>([^<]+)<\/h3>/);
  const timeMatch = html.match(/<time[^>]*>([^<]+)<\/time>/);
  const durationMatch = html.match(
    /<span[^>]*c-calendar-instance__duration[^>]*>.*?(\d+)\s*min/
  );

  // Extract description - text after the type paragraph, before buttons div
  let description = "";
  const typeEndMatch = html.match(
    /<p[^>]*c-calendar-instance__type[^>]*>.*?<\/p>/s
  );
  const buttonsStartMatch = html.match(/<div[^>]*c-calendar-instance__buttons/);

  if (typeEndMatch && buttonsStartMatch) {
    const startIdx = typeEndMatch.index! + typeEndMatch[0].length;
    const endIdx = buttonsStartMatch.index!;
    const descText = html.substring(startIdx, endIdx).trim();
    // Remove HTML tags and clean up whitespace
    description = descText
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    title: titleMatch?.[1]?.trim() || "Untitled",
    time: timeMatch?.[1]?.trim() || "",
    duration: durationMatch?.[1] ? `${durationMatch[1]} min` : "",
    description: description || "",
  };
}

export function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: PST_TIME_ZONE,
  });
}

export function formatVenue(resourceId: string) {
  return resourceId
    .replace("viff-centre-", "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
