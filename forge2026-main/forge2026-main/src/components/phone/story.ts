/*
  The phone build's sense of where you are.

  A phone page is a story in chapters (sections marked data-ph-chapter). This
  module follows the scroll with one passive listener: which chapter you are
  in (for the top bar and the chapter sheet), how far through the page you
  are (the ring on the Next button, written straight to the DOM), and which
  chapters you have read. What you have read, where you stopped and how many
  times you have struck the anvil are remembered on this device, so a second
  visit picks up where the first left off.

  Chapter positions are measured once and again whenever the page changes
  height, never during the scroll itself.
*/

/** A chapter, and the colour it wears (lime, sky, coral or lilac). */
export type PhoneChapter = { id: string; label: string; tone?: string };

type Snapshot = { page: string; chapters: PhoneChapter[]; active: number };

const EMPTY: Snapshot = { page: "", chapters: [], active: -1 };

/** Where the reading line sits: a chapter is "on" once its top passes it. */
const LINE = 0.42;

type Saved = { read: Record<string, string[]>; resume?: { page: string; id: string } };

function load(): Saved {
  try {
    const raw = window.localStorage.getItem("forge:story");
    if (raw) return JSON.parse(raw) as Saved;
  } catch {
    // Private mode or blocked storage: remember nothing.
  }
  return { read: {} };
}

function save(s: Saved) {
  try {
    window.localStorage.setItem("forge:story", JSON.stringify(s));
  } catch {
    // Remembering is a nicety.
  }
}

class PhoneStory {
  private snap: Snapshot = EMPTY;
  private els: HTMLElement[] = [];
  private tops: number[] = [];
  private listeners = new Set<() => void>();
  private progressFns = new Set<(p: number) => void>();
  private scrolledFns = new Set<(on: boolean) => void>();
  private saved: Saved | null = null;
  private raf = 0;
  private scrolled = false;
  private resizeObs: ResizeObserver | null = null;
  private attached = false;

  /* ── React ───────────────────────────────────────────────────────── */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.snap;
  getServerSnapshot = () => EMPTY;

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  /* ── pages ───────────────────────────────────────────────────────── */

  /** A page has mounted: `root` holds its chapters. Returns the cleanup. */
  mount(page: string, root: HTMLElement) {
    this.attach();
    this.els = Array.from(root.querySelectorAll<HTMLElement>("[data-ph-chapter]"));
    this.snap = {
      page,
      chapters: this.els.map((el) => ({
        id: el.id,
        label: el.dataset.phChapter ?? "",
        tone: el.dataset.phTone,
      })),
      active: -1,
    };
    this.measure();
    this.resizeObs?.observe(root);
    this.update();
    this.emit();
    return () => {
      this.resizeObs?.unobserve(root);
      if (this.snap.page !== page) return;
      this.els = [];
      this.tops = [];
      this.snap = EMPTY;
      this.emit();
    };
  }

  private attach() {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener("scroll", this.schedule, { passive: true });
    window.addEventListener("resize", this.onResize, { passive: true });
    this.resizeObs = new ResizeObserver(this.onResize);
  }

  private onResize = () => {
    this.measure();
    this.schedule();
  };

  private measure() {
    const y = window.scrollY;
    this.tops = this.els.map((el) => el.getBoundingClientRect().top + y);
  }

  private schedule = () => {
    if (!this.raf) this.raf = requestAnimationFrame(this.update);
  };

  private update = () => {
    this.raf = 0;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    this.progressFns.forEach((fn) => fn(p));

    const scrolled = y > 8;
    if (scrolled !== this.scrolled) {
      this.scrolled = scrolled;
      this.scrolledFns.forEach((fn) => fn(scrolled));
    }

    // The last chapter whose top has passed the reading line; at the very
    // bottom of the page, the last chapter, however short it is.
    let active = -1;
    const line = y + vh * LINE;
    for (let i = 0; i < this.tops.length; i++) if (this.tops[i] <= line) active = i;
    if (max > 0 && y >= max - 2 && this.tops.length) active = this.tops.length - 1;
    if (active !== this.snap.active) {
      this.snap = { ...this.snap, active };
      if (active >= 0) this.remember(this.snap.page, this.snap.chapters[active].id);
      this.emit();
    }
  };

  /** Page progress, 0 to 1, every frame it changes. */
  onProgress(fn: (p: number) => void) {
    this.progressFns.add(fn);
    this.schedule();
    return () => {
      this.progressFns.delete(fn);
    };
  }

  /** Whether the page has moved off its top. */
  onScrolled(fn: (on: boolean) => void) {
    this.scrolledFns.add(fn);
    fn(this.scrolled);
    return () => {
      this.scrolledFns.delete(fn);
    };
  }

  /* ── moving through the story ────────────────────────────────────── */

  private reduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /** Scroll to a chapter (or any element) by id. */
  go(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: this.reduced() ? "auto" : "smooth", block: "start" });
  }

  top() {
    window.scrollTo({ top: 0, behavior: this.reduced() ? "auto" : "smooth" });
  }

  /** The chapter after the one on screen, or null at the end of the story. */
  next(): PhoneChapter | null {
    const { chapters } = this.snap;
    const y = window.scrollY;
    // A few pixels of slack, so a chapter we just arrived at counts as passed.
    const i = this.tops.findIndex((t) => t > y + 80);
    return i >= 0 ? chapters[i] : null;
  }

  /* ── memory ──────────────────────────────────────────────────────── */

  private store() {
    return (this.saved ??= load());
  }

  private remember(page: string, id: string) {
    const s = this.store();
    const read = new Set(s.read[page] ?? []);
    read.add(id);
    s.read[page] = [...read];
    s.resume = { page, id };
    save(s);
  }

  read(page: string) {
    return new Set(this.store().read[page] ?? []);
  }

  /** Where the last visit stopped on this page, if it stopped part of the way in. */
  resume(page: string, chapters: PhoneChapter[]) {
    const r = this.store().resume;
    if (!r || r.page !== page) return null;
    const i = chapters.findIndex((c) => c.id === r.id);
    return i > 0 && i < chapters.length - 1 ? chapters[i] : null;
  }
}

export const phoneStory = new PhoneStory();

/** Strikes of the anvil, ever, on this device. */
export const strikes = {
  get(): number {
    try {
      return Number(window.localStorage.getItem("forge:strikes")) || 0;
    } catch {
      return 0;
    }
  },
  set(n: number) {
    try {
      window.localStorage.setItem("forge:strikes", String(n));
    } catch {
      // Remembering is a nicety.
    }
  },
};
