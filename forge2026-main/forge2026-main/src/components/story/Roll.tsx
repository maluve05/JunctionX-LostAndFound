import type { CSSProperties } from "react";

/**
 * A button label whose letters roll over one after another when the button
 * is hovered: each letter slides up out of view as its twin slides in from
 * below (styles.css, "Button details"). Screen readers get the plain words.
 */
export function Roll({ children }: { children: string }) {
  return (
    <span className="roll">
      <span className="sr-only">{children}</span>
      <span className="roll-in" aria-hidden="true">
        {Array.from(children).map((ch, i) => (
          <span key={i} data-ch={ch} style={{ "--i": i } as CSSProperties} className="roll-ch">
            {ch}
          </span>
        ))}
      </span>
    </span>
  );
}
