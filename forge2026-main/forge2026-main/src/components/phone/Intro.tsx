import { useEffect, useRef, useState } from "react";
import {
  ANVIL,
  HAMMER_HANDLE,
  HAMMER_HEAD,
  HAMMER_PIVOT,
  LOGO_SHARDS,
  MIST,
} from "../story/scene/mark";

/*
  The phone's way in: the anvil rises, the hammer comes down, the mark's
  shards burst out of the blow, the wordmark lands, and the screen lifts away
  onto the page. About two seconds; a tap skips it.

  It is all CSS (phone.css, "The way in") on transforms and opacity, so it
  plays from the first paint, before any script runs, and stays smooth while
  the page hydrates underneath. It is in the server's HTML, so it plays once
  per full load and never on moves between pages. Reduced motion skips it.
*/

const VIEW = "-136 -212 254 327";
/** Where the hammer turns and where the blow lands, as shares of the mark's box. */
const PIVOT = { x: (HAMMER_PIVOT.x + 136) / 254, y: (HAMMER_PIVOT.y + 212) / 327 };
const FACE = { x: 136 / 254, y: 212 / 327 };
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function PhoneIntro() {
  const root = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // Already over (a slow load), or not wanted: take it out of the page.
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      getComputedStyle(el).visibility === "hidden"
    ) {
      setGone(true);
      return;
    }
    const skip = () => {
      el.dataset.skip = "";
    };
    const end = (e: AnimationEvent) => {
      if (e.target === el) setGone(true);
    };
    el.addEventListener("pointerdown", skip);
    el.addEventListener("animationend", end);
    return () => {
      el.removeEventListener("pointerdown", skip);
      el.removeEventListener("animationend", end);
    };
  }, []);

  if (gone) return null;

  return (
    <div ref={root} className="ph-intro" aria-hidden="true">
      <div className="ph-intro-mark">
        <svg viewBox={VIEW} className="ph-intro-anvil">
          <path d={ANVIL} fill={MIST} fillRule="evenodd" />
        </svg>
        <svg
          viewBox={VIEW}
          className="ph-intro-shards"
          style={{ transformOrigin: `${pct(FACE.x)} ${pct(FACE.y)}` }}
        >
          {LOGO_SHARDS.map((s) => (
            <path key={s.d} d={s.d} fill={s.fill} />
          ))}
        </svg>
        <svg
          viewBox={VIEW}
          className="ph-intro-hammer"
          style={{ transformOrigin: `${pct(PIVOT.x)} ${pct(PIVOT.y)}` }}
        >
          <g fill={MIST}>
            <path d={HAMMER_HEAD} fillRule="evenodd" />
            <path d={HAMMER_HANDLE} />
          </g>
        </svg>
        <span className="ph-intro-flash" style={{ left: pct(FACE.x), top: pct(FACE.y) }} />
        <span className="ph-intro-ring" style={{ left: pct(FACE.x), top: pct(FACE.y) }} />
      </div>
      <img
        src="/brand/wordmark.webp"
        alt=""
        width={296}
        height={95}
        className="ph-intro-word"
        fetchPriority="high"
      />
      <p className="ph-intro-meta">Lisbon · November 2026</p>
    </div>
  );
}
