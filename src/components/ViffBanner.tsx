import type { CalendarInstance } from "../utils/types";

export default function ViffBanner({ event }: { event: CalendarInstance }) {
  if (!event.isViffFestival) return null;
  return (
    <div className="mb-3 flex items-center gap-3 border-2 border-black bg-fuchsia-600 px-3 py-1 text-white">
      <span className="text-lg font-black tracking-tight">VIFF</span>
      <span className="border-l border-white/60 pl-3 text-xs font-bold uppercase tracking-widest">
        Official Festival Selection
      </span>
    </div>
  );
}
