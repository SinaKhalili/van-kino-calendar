import { CalendarInstance } from "./types";
import { getPstDateComponents } from "./date-helpers";

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([a-f\d]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#038;/g, "&");
}

export function parseEventTitle(html: string, event: CalendarInstance) {
  // For Rio, Cinematheque, and Park events, title is already plain text
  if (event.theatre === "rio" || event.theatre === "cinematheque" || event.theatre === "park") {
    return {
      title: decodeHtmlEntities(event.title),
      time: "",
      duration: "",
      description: event.moreInfo
        ? decodeHtmlEntities(
            event.moreInfo
              .replace(/<[^>]+>/g, "")
              .replace(/\s+/g, " ")
              .trim()
              .substring(0, 200)
          )
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
    title: titleMatch?.[1]
      ? decodeHtmlEntities(titleMatch[1].trim())
      : "Untitled",
    time: timeMatch?.[1]?.trim() || "",
    duration: durationMatch?.[1] ? `${durationMatch[1]} min` : "",
    description: description || "",
  };
}

export function formatTime(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const { hour, minute } = getPstDateComponents(date);
  const hours12 = hour % 12 || 12;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hours12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

export function formatVenue(resourceId: string) {
  return resourceId
    .replace("viff-centre-", "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
