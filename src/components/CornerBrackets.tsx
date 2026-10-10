import { cn } from "@/lib/utils";

/**
 * The four brackets of a camera viewfinder, one per corner. This is the
 * signature detail of the brand, so it lives in one place and is reused by the
 * QR card and the analysing preview.
 */
const CORNERS = [
  "top-5 left-5 rounded-tl-xl border-t border-l",
  "top-5 right-5 rounded-tr-xl border-t border-r",
  "right-5 bottom-5 rounded-br-xl border-r border-b",
  "bottom-5 left-5 rounded-bl-xl border-b border-l",
];

export function CornerBrackets({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {CORNERS.map((corner) => (
        <span key={corner} className={cn("bracket", corner)} />
      ))}
    </div>
  );
}
