import { fx } from "./fx";
import { stage } from "./stage";

/*
  The night shift: a second look for the site, earned with 150 swings of the
  hammer (home/doodles.ts); every 150 swings after that change shift again,
  off, then on. The Konami code (eggs.ts) turns it on or off too. Neon takes
  the place of the four signal colours (styles.css, "The night shift"), the
  shards change colour and pulse on a beat with the doodles, and the accents
  cycle through the night's colours. It lasts until a reload. Wide build only.
*/

/** The shards' night palette, in formations.ts order: lilac, lime, sky, coral, iris, mist. */
const SHARDS = ["#3cefff", "#ff4fd8", "#b18cff", "#ffe14d", "#7a5cff", "#f4ecff"];
/** The night's tempo, in beats per minute (styles.css keeps the same beat). */
export const BPM = 120;
/** Swings of the hammer from one change of shift to the next. */
export const NIGHT_SWINGS = 150;

class Theme {
  private night = false;
  private since = 0;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  /** When the night shift came on (performance.now()), or 0 while it is day. */
  getSnapshot = () => (this.night ? this.since : 0);
  getServerSnapshot = () => 0;

  /** Bring the night shift on or off; it arrives like a blow, from `at` on screen. */
  set(on: boolean, at?: { x: number; y: number }) {
    if (on === this.night) return;
    this.night = on;
    this.since = on ? performance.now() : 0;
    const root = document.documentElement;
    if (on) root.dataset.theme = "night";
    else delete root.dataset.theme;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    stage.setPalette(on ? SHARDS : null);
    stage.setBeat(on && !reduced ? BPM : 0);
    fx.setNight(on);
    if (on && !reduced) {
      const x = at?.x ?? window.innerWidth / 2;
      const y = at?.y ?? window.innerHeight / 2;
      fx.strike(x, y, 420, 2.4);
      stage.burst(x, y, 2.2);
    }
    this.listeners.forEach((fn) => fn());
  }

  toggle(at?: { x: number; y: number }) {
    this.set(!this.night, at);
  }
}

export const theme = new Theme();
