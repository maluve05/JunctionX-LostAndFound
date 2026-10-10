/**
 * The line between two chapters: a laser rule that ignites as you cross it,
 * with the next chapter's name decoding beside it (see transitions.ts).
 * Decorative; the chapter's own heading carries the meaning.
 */
export function Seam({ label }: { label: string }) {
  return (
    <div className="seam" aria-hidden="true">
      <span className="seam-line" />
      <span className="seam-label">{label}</span>
    </div>
  );
}
