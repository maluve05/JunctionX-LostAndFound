import { createElement, use, type ComponentType } from "react";

/*
  Two builds of the site in one app.

  Phones (under 768px wide) get the phone build (components/phone): a light,
  tap-first story told with photographs and type, with no 3D scene, loading
  intro or sparks layer. Anything wider gets the 3D story (components/story).

  The server renders both, and CSS shows the one that fits the screen
  (`.only-phone` / `.only-wide` in styles.css), so the first paint is right
  before any script runs. In the browser only the build on screen hydrates:
  the other one waits, its server HTML untouched and hidden, and its code is
  never downloaded (see `onDemand`). If the window changes size across the
  line later (a tablet turned, a desktop window narrowed), the other build
  wakes up then.
*/

export type Mode = "phone" | "wide";

const QUERY = "(max-width: 767px)";

class Layout {
  private mql: MediaQueryList | null = null;
  private firstMode: Mode | null = null;
  private waiting: Partial<Record<Mode, { promise: Promise<void>; resolve: () => void }>> = {};
  private listeners = new Set<(mode: Mode) => void>();

  private media() {
    if (!this.mql) {
      this.mql = window.matchMedia(QUERY);
      this.firstMode = this.mql.matches ? "phone" : "wide";
      this.mql.addEventListener("change", () => {
        const mode = this.mode;
        this.waiting[mode]?.resolve();
        this.listeners.forEach((fn) => fn(mode));
      });
    }
    return this.mql;
  }

  /** The build that fits the screen right now. Browser only. */
  get mode(): Mode {
    return this.media().matches ? "phone" : "wide";
  }

  /** The build the page opened with (a phone turned sideways later is still "phone"). */
  get first(): Mode {
    this.media();
    return this.firstMode!;
  }

  /** Resolves once the screen fits `mode` (straight away if it already does). */
  until(mode: Mode) {
    if (this.mode === mode) return Promise.resolve();
    let entry = this.waiting[mode];
    if (!entry) {
      let resolve = () => {};
      const promise = new Promise<void>((r) => (resolve = r));
      entry = { promise, resolve };
      this.waiting[mode] = entry;
    }
    return entry.promise;
  }

  onChange(fn: (mode: Mode) => void) {
    this.media();
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export const layout = new Layout();

export type OnDemand = ComponentType & { preload: () => Promise<void> };

/**
 * A component the server renders straight away and the browser downloads
 * only when it is needed. Call it as
 *
 *   onDemand(import.meta.env.SSR ? Thing : undefined, () => import("./Thing").then((m) => m.Thing))
 *
 * In the browser build `import.meta.env.SSR` is false, so the static import
 * is dropped and the code lives in its own chunk, fetched when it first
 * renders or, on a wide screen, once the browser is idle.
 */
export function onDemand(
  server: ComponentType | undefined,
  load: () => Promise<ComponentType>,
): OnDemand {
  if (server) return Object.assign(server, { preload: () => Promise.resolve() });

  let Loaded: ComponentType | null = null;
  let pending: Promise<void> | null = null;
  const preload = () =>
    (pending ??= load().then((C) => {
      Loaded = C;
    }));

  function OnDemandPart() {
    if (!Loaded) use(preload());
    return createElement(Loaded!);
  }
  // On a wide screen, fetch it once the page has settled: whatever is on
  // screen asks for its own part straight away, the rest arrive ahead of the
  // pages that need them.
  if (layout.mode === "wide") {
    const idle =
      (window as Window & { requestIdleCallback?: (cb: () => void, o?: object) => number })
        .requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    idle(() => void preload(), { timeout: 4000 });
  }
  return Object.assign(OnDemandPart, { preload });
}

/**
 * For a route's loader: on a wide screen, wait for the page's wide build to
 * arrive before the page changes, so it never flashes empty on the way in.
 */
export function wideReady(part: OnDemand) {
  if (typeof window === "undefined" || layout.mode !== "wide") return;
  return part.preload();
}
