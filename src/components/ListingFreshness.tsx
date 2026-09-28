import { formatPstDisplay } from "../utils/date-helpers";
import { formatTime } from "../utils/parsers";

export interface ListingFreshnessProps {
  updatedAt: string | null;
  stale: boolean;
  unavailableSources: string[];
}

export default function ListingFreshness({ updatedAt, stale, unavailableSources }: ListingFreshnessProps) {
  return (
    <p className="mb-3 text-xs font-bold" role="status">
      {updatedAt
        ? `Last updated ${formatPstDisplay(new Date(updatedAt))} at ${formatTime(updatedAt)} (Vancouver).`
        : "Listings are temporarily unavailable."}
      {stale && " Showing saved listings while checking for updates."}
      {unavailableSources.length > 0 && ` Unavailable: ${unavailableSources.join(", ")}.`}
    </p>
  );
}
