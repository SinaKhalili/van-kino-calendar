export const venues = {
  viff: { name: "VIFF CENTRE", url: "https://viff.org" },
  rio: { name: "RIO", url: "https://riotheatre.ca" },
  cinematheque: { name: "CINEMATHEQUE", url: "https://thecinematheque.ca" },
  park: { name: "PARK", url: "https://www.theparktheatre.ca" },
  "fifth-avenue": { name: "FIFTH AVE", url: "https://www.cineplex.com/theatre/fifth-avenue-cinemas" },
  "international-village": { name: "INT'L VILLAGE", url: "https://www.cineplex.com/theatre/international-village" },
  "vancouver-playhouse": { name: "VANCOUVER PLAYHOUSE", url: "https://viff.org/find-us/" },
  "sfu-woodwards": { name: "SFU WOODWARDS", url: "https://viff.org/find-us/" },
  "lindsay-family-stage": { name: "LINDSAY FAMILY STAGE", url: "https://viff.org/find-us/" },
  "alliance-francaise": { name: "ALLIANCE FRANÇAISE", url: "https://viff.org/find-us/" },
  annex: { name: "ANNEX", url: "https://viff.org/find-us/" },
  "the-pearl": { name: "THE PEARL", url: "https://viff.org/find-us/" },
  "other-viff-venue": { name: "OTHER VIFF VENUES", url: "https://viff.org/find-us/" },
} as const;

export type Theatre = keyof typeof venues;
export const venueFilters = Object.keys(venues) as Theatre[];

/** VIFF resource IDs describe screens; filters group them by physical venue. */
export function getViffTheatre(resourceId: string): Theatre {
  if (resourceId.startsWith("viff-centre-")) return "viff";
  if (resourceId.startsWith("international-village")) return "international-village";
  if (resourceId.startsWith("fifth-avenue")) return "fifth-avenue";
  if (resourceId.startsWith("sfu-")) return "sfu-woodwards";
  if (resourceId.startsWith("lindsay-family-stage")) return "lindsay-family-stage";
  const aliases: Record<string, Theatre> = {
    "the-rio-theatre": "rio",
    "the-cinematheque": "cinematheque",
    "the-park-theatre": "park",
    "annex-theatre": "annex",
  };
  return aliases[resourceId] ?? (Object.hasOwn(venues, resourceId) ? resourceId as Theatre : "other-viff-venue");
}
