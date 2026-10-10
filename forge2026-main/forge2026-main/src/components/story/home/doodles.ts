import { gsap } from "gsap";
import { fx } from "../fx";
import { NIGHT_SWINGS, theme } from "../theme";

/*
  The doodle forge. The hero's open space starts empty, and every third swing
  of the hammer forges a doodle: it flies out of the blow and lands in that
  space, hand-drawn in the four signal colours, with an idle loop of its own
  (styles.css, "Hero doodles"). There is no limit; past MAX the oldest fade
  out as new ones land, so the page stays light. Swings and doodles last while
  you move between pages and start over on a reload. The 150th swing brings
  on the night shift (theme.ts).

  Once landed, doodles answer the page: they step aside and tip as the cursor
  comes close (arrows point at it) and the whole field leans against it; a
  blow sends a hop through them from the anvil; a click on open space pushes
  the near ones away.

  Each doodle is layered so no two motions share an element (GSAP would fold
  a CSS translate or scale into its own): the outer span holds its place, the
  flier takes the flight in, the kick takes hops and pushes, the body follows
  the cursor, and the drawing plays its idle loop.
*/

export type Tone = "lime" | "lilac" | "coral" | "sky";

type Kind = {
  kind: string;
  /** Width in pixels at the base size. */
  w: number;
  vb: [number, number];
  tone: Tone;
  svg: string;
};

/** The drawings, in the order they are first forged. */
const KINDS: Kind[] = [
  {
    kind: "code",
    w: 78,
    vb: [80, 52],
    tone: "lime",
    svg: '<path d="M24 10 8 26l16 16M56 10l16 16-16 16M46 6 34 46"/>',
  },
  {
    kind: "squiggle",
    w: 116,
    vb: [120, 32],
    tone: "lilac",
    svg: '<path pathLength="100" d="M4 16c8-12 16-12 24 0s16 12 24 0 16-12 24 0 16 12 24 0 12-10 16-6"/>',
  },
  {
    kind: "sparkle",
    w: 36,
    vb: [40, 40],
    tone: "coral",
    svg: '<path class="fill" d="M20 1c1.6 11.4 7.6 17.4 19 19-11.4 1.6-17.4 7.6-19 19-1.6-11.4-7.6-17.4-19-19C12.4 18.4 18.4 12.4 20 1Z"/>',
  },
  {
    kind: "bolt",
    w: 38,
    vb: [36, 52],
    tone: "sky",
    svg: '<path d="M22 2 5 29h12l-5 21 19-29H19Z"/>',
  },
  {
    kind: "arrow",
    w: 84,
    vb: [84, 44],
    tone: "lime",
    svg: '<path d="M4 36C16 12 40 4 58 16c4 3 9 5 17 5M65 12l11 9-11 9"/>',
  },
  {
    kind: "braces",
    w: 60,
    vb: [64, 56],
    tone: "sky",
    svg:
      '<path class="brace-l" d="M22 4c-8 0-8 6-8 14 0 6-2 10-8 10 6 0 8 4 8 10 0 8 0 14 8 14"/>' +
      '<path class="brace-r" d="M42 4c8 0 8 6 8 14 0 6 2 10 8 10-6 0-8 4-8 10 0 8 0 14-8 14"/>',
  },
  {
    kind: "ring",
    w: 60,
    vb: [64, 64],
    tone: "coral",
    svg: '<path d="M36 7c16 1 24 15 21 29-3 15-19 23-33 19C10 51 4 36 8 23c4-12 17-18 30-14 6 2 10 5 12 8"/>',
  },
  {
    kind: "prompt",
    w: 58,
    vb: [64, 40],
    tone: "lime",
    svg: '<path d="M6 8l14 12L6 32"/><path class="cursor" d="M28 33h24"/>',
  },
  {
    kind: "zigzag",
    w: 66,
    vb: [72, 28],
    tone: "coral",
    svg: '<path d="M3 21 15 7l12 14L39 7l12 14L63 7"/>',
  },
  {
    kind: "orbit",
    w: 46,
    vb: [56, 56],
    tone: "lilac",
    svg:
      '<circle cx="28" cy="28" r="17"/><circle class="fill" cx="28" cy="28" r="3"/>' +
      '<g class="moon"><circle class="fill" cx="45" cy="28" r="4.5"/></g>',
  },
  {
    kind: "plus",
    w: 48,
    vb: [52, 52],
    tone: "sky",
    svg: '<path class="p1" d="M14 6v16M6 14h16"/><path class="p2" d="M38 20v12M32 26h12"/><path class="p3" d="M18 36v10M13 41h10"/>',
  },
  {
    kind: "dots",
    w: 40,
    vb: [44, 44],
    tone: "lilac",
    svg: [8, 22, 36]
      .flatMap((cy, r) =>
        [8, 22, 36].map(
          (cx, c) => `<circle class="fill" cx="${cx}" cy="${cy}" r="2.8" style="--d:${r + c}"/>`,
        ),
      )
      .join(""),
  },
];

const TONES: Tone[] = ["lime", "lilac", "coral", "sky"];
/** Swings per doodle. */
export const PER_DOODLE = 3;
/** Doodles on the page at once; past this the oldest fade out. */
const MAX = 140;

type Doodle = {
  n: number;
  kind: Kind;
  tone: Tone;
  /** Centre, as shares of the field. */
  x: number;
  y: number;
  /** Width in pixels. */
  w: number;
  tilt: number;
  phase: number;
};

/** A doodle on the page, with its layers and cursor tweens. */
type Live = {
  d: Doodle;
  el: HTMLElement;
  fly: HTMLElement;
  kick: HTMLElement;
  arrow: boolean;
  x: gsap.QuickToFunc;
  y: gsap.QuickToFunc;
  rot: gsap.QuickToFunc;
  scale: gsap.QuickToFunc;
  /** Centre on the page, measured when the layout changes. */
  px: number;
  py: number;
  near: boolean;
  turn: number;
};

type Snap = { swings: number; forged: number; firstAt: number };

/** A small seeded random, so a session's doodles fall the same way each time they are drawn. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class DoodleForge {
  private swings = 0;
  private list: Doodle[] = [];
  private snap: Snap = { swings: 0, forged: 0, firstAt: 0 };
  private listeners = new Set<() => void>();
  private rand = rng(2026);

  // On the page, while the hero is mounted.
  private layer: HTMLElement | null = null;
  private garden: HTMLElement | null = null;
  private live = new Map<number, Live>();
  private queue: Doodle[] = [];
  private queueTimer = 0;
  private seen = true;
  private reduced = false;
  private drift: { x: gsap.QuickToFunc; y: gsap.QuickToFunc } | null = null;
  private mx = -1;
  private my = -1;
  private dirty = false;

  /* ── React ───────────────────────────────────────────────────────── */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.snap;
  getServerSnapshot = (): Snap => ({ swings: 0, forged: 0, firstAt: 0 });

  private emit() {
    this.snap = {
      swings: this.swings,
      forged: this.list.length ? this.list[this.list.length - 1].n + 1 : 0,
      firstAt: this.snap.firstAt,
    };
    this.listeners.forEach((fn) => fn());
  }

  /* ── swings and doodles ──────────────────────────────────────────── */

  /** A swing of the hammer (a click, before the blow lands). */
  swing() {
    this.swings++;
    if (this.swings % NIGHT_SWINGS === 0) {
      // Every 150th swing changes shift: the night comes on with this blow,
      // from the anvil's face, and the next 150th sends it off again.
      const zone = document.querySelector<HTMLElement>(".only-wide .forge-zone");
      const r = zone?.getBoundingClientRect();
      theme.toggle(r ? { x: r.left + r.width / 2, y: r.top + r.height * 0.55 } : undefined);
    }
    if (this.swings % PER_DOODLE === 0) {
      const d = this.make();
      this.list.push(d);
      if (d.n === 0) this.snap.firstAt = performance.now();
      this.queue.push(d);
      // It leaves with the blow; if no blow comes (the forge is off screen),
      // it leaves from the forge anyway.
      window.clearTimeout(this.queueTimer);
      this.queueTimer = window.setTimeout(() => this.launch(), 800);
    }
    this.emit();
  }

  /** Which drawing, colour and place the next doodle gets. */
  private make(): Doodle {
    const n = this.list.length ? this.list[this.list.length - 1].n + 1 : 0;
    const kind = KINDS[n % KINDS.length];
    // Each round through the drawings shifts the colours, so repeats differ.
    const cycle = Math.floor(n / KINDS.length);
    const tone = TONES[(TONES.indexOf(kind.tone) + cycle) % TONES.length];
    const size = this.garden?.getBoundingClientRect();
    const fw = size?.width || 600;
    const fh = size?.height || 400;
    // Later doodles are a little smaller, so they fit the gaps.
    const w = Math.round(
      kind.w * Math.min(1.35, Math.max(0.85, fw / 520)) * Math.max(0.55, 1 - n * 0.012),
    );
    const h = (w * kind.vb[1]) / kind.vb[0];
    const { x, y } = n === 0 ? { x: 0.3, y: 0.42 } : this.place(w, h, fw, fh);
    return {
      n,
      kind,
      tone,
      x,
      y,
      w,
      tilt: kind.kind === "arrow" ? 0 : (this.rand() - 0.5) * 24,
      phase: -this.rand() * 6,
    };
  }

  /** The emptiest spot left: the best of a few random tries. */
  private place(w: number, h: number, fw: number, fh: number) {
    const r = Math.max(w, h) / 2;
    // Keep off the chip at the field's right edge, level with the anvil.
    const chip = this.layer?.querySelector<HTMLElement>(".forge-chip");
    const box = this.garden?.getBoundingClientRect();
    const c = chip && box ? chip.getBoundingClientRect() : null;
    const avoid =
      c && box
        ? { x: c.left - box.left + c.width / 2, y: c.top - box.top + c.height / 2, r: c.width / 2 }
        : null;
    let best = { x: 0.5, y: 0.5 };
    let bestScore = -Infinity;
    for (let k = 0; k < 36; k++) {
      const x = r + this.rand() * Math.max(1, fw - 2 * r);
      const y = r + this.rand() * Math.max(1, fh - 2 * r);
      let score = Infinity;
      for (const o of this.list) {
        const oh = (o.w * o.kind.vb[1]) / o.kind.vb[0];
        const gap = Math.hypot(o.x * fw - x, o.y * fh - y) - (Math.max(o.w, oh) / 2 + r);
        if (gap < score) score = gap;
      }
      if (avoid) score = Math.min(score, Math.hypot(avoid.x - x, avoid.y - y) - (avoid.r + r));
      if (score > bestScore) {
        bestScore = score;
        best = { x: x / fw, y: y / fh };
      }
    }
    return best;
  }

  /** Send the waiting doodles off, from the anvil's face (or the forge's middle). */
  private launch(at?: { x: number; y: number }) {
    window.clearTimeout(this.queueTimer);
    const ready = this.queue.splice(0);
    if (!this.garden) return;
    let from = at;
    if (!from) {
      const zone = document.querySelector<HTMLElement>(".only-wide .forge-zone");
      const r = zone?.getBoundingClientRect();
      if (r) from = { x: r.left + r.width / 2, y: r.top + r.height * 0.55 };
    }
    ready.forEach((d, i) => this.add(d, from, i * 0.12));
  }

  /* ── on the page ─────────────────────────────────────────────────── */

  /** The hero is on screen: draw the doodles so far and answer the page. */
  mount(layer: HTMLElement, garden: HTMLElement) {
    this.layer = layer;
    this.garden = garden;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.list.forEach((d, i) => this.add(d, undefined, 0, i));

    const ro = new ResizeObserver(() => this.measure());
    ro.observe(garden);
    const io = new IntersectionObserver(([e]) => {
      this.seen = e.isIntersecting;
      if (this.seen) delete layer.dataset.off;
      else layer.dataset.off = "";
    });
    io.observe(layer);

    const hover = !this.reduced && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (hover) {
      this.drift = {
        x: gsap.quickTo(garden, "x", { duration: 1.2, ease: "power3.out" }),
        y: gsap.quickTo(garden, "y", { duration: 1.2, ease: "power3.out" }),
      };
      window.addEventListener("pointermove", this.onMove, { passive: true });
      window.addEventListener("scroll", this.onScroll, { passive: true });
      gsap.ticker.add(this.tick);
    }
    window.addEventListener("forge:strike", this.onSwing);
    window.addEventListener("forge:impact", this.onImpact);
    window.addEventListener("forge:ripple", this.onRipple);

    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", this.onMove);
      window.removeEventListener("scroll", this.onScroll);
      window.removeEventListener("forge:strike", this.onSwing);
      window.removeEventListener("forge:impact", this.onImpact);
      window.removeEventListener("forge:ripple", this.onRipple);
      gsap.ticker.remove(this.tick);
      // Doodles still waiting for their blow are already listed: they are
      // drawn in place next time. Take this visit's drawings off the page.
      window.clearTimeout(this.queueTimer);
      this.queue = [];
      for (const l of this.live.values()) {
        gsap.killTweensOf([l.fly, l.kick, l.el.querySelector(".doodle-body")]);
        l.el.remove();
      }
      if (this.garden) gsap.killTweensOf(this.garden);
      this.live.clear();
      this.drift = null;
      this.layer = null;
      this.garden = null;
    };
  }

  /** Put a doodle in the field; from `from`, it flies there. */
  private add(d: Doodle, from?: { x: number; y: number }, delay = 0, order = 0) {
    const garden = this.garden;
    if (!garden) return;
    const el = document.createElement("span");
    el.className = `doodle doodle-${d.kind.kind}`;
    el.style.cssText =
      `--x:${(d.x * 100).toFixed(2)}%;--y:${(d.y * 100).toFixed(2)}%;--w:${d.w};` +
      `--r:${d.kind.vb[1] / d.kind.vb[0]};--c:var(--color-${d.tone});` +
      `--tilt:${d.tilt.toFixed(1)}deg;--phase:${d.phase.toFixed(2)}s;--i:${order}`;
    if (!from) el.dataset.pop = "";
    // Only this file's own drawings and numbers go in here, never page input.
    el.innerHTML =
      `<span class="doodle-fly"><span class="doodle-kick"><span class="doodle-body">` +
      `<svg viewBox="0 0 ${d.kind.vb[0]} ${d.kind.vb[1]}">${d.kind.svg}</svg>` +
      `</span></span></span>`;
    garden.appendChild(el);
    const fly = el.firstElementChild as HTMLElement;
    const kick = fly.firstElementChild as HTMLElement;
    const body = kick.firstElementChild as HTMLElement;
    const to = (prop: string, duration: number) =>
      gsap.quickTo(body, prop, { duration, ease: "power3.out" });
    const live: Live = {
      d,
      el,
      fly,
      kick,
      arrow: d.kind.kind === "arrow",
      x: to("x", 0.9),
      y: to("y", 0.9),
      rot: to("rotation", 1.1),
      scale: to("scale", 0.6),
      px: 0,
      py: 0,
      near: false,
      turn: 0,
    };
    this.live.set(d.n, live);
    this.measureOne(live);

    // Past the limit, the oldest fade out.
    while (this.live.size > MAX) {
      const oldest = this.live.values().next().value as Live;
      this.live.delete(oldest.d.n);
      this.list = this.list.filter((o) => o.n !== oldest.d.n);
      gsap.to(oldest.el, { autoAlpha: 0, duration: 0.6, onComplete: () => oldest.el.remove() });
    }

    if (!from || this.reduced) return;
    // The flight: out of the blow in an arc, spinning, landing with a bounce.
    const cx = live.px - window.scrollX;
    const cy = live.py - window.scrollY;
    const dx = from.x - cx;
    const dy = from.y - cy;
    const arc = 90 + Math.min(160, Math.abs(dx) * 0.25);
    const spin = (dx > 0 ? -1 : 1) * (240 + this.rand() * 180);
    const setX = gsap.quickSetter(fly, "x", "px");
    const setY = gsap.quickSetter(fly, "y", "px");
    const setR = gsap.quickSetter(fly, "rotation", "deg");
    const setS = gsap.quickSetter(fly, "scale");
    const p = { t: 0 };
    gsap.set(fly, { autoAlpha: 0 });
    gsap
      .timeline({ delay })
      .set(fly, { autoAlpha: 1 })
      .to(p, {
        t: 1,
        duration: 0.85,
        ease: "power2.out",
        onUpdate: () => {
          const t = p.t;
          setX(dx * (1 - t));
          setY(dy * (1 - t) - arc * Math.sin(Math.PI * t));
          setR(spin * (1 - t));
          setS(0.25 + 0.75 * t);
        },
        onComplete: () => {
          if (this.seen) fx.ripple(live.px - window.scrollX, live.py - window.scrollY);
        },
      })
      .fromTo(fly, { scale: 1.22 }, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.45)" });
  }

  private measureOne(l: Live) {
    const r = l.el.getBoundingClientRect();
    l.px = r.left + r.width / 2 + window.scrollX;
    l.py = r.top + r.height / 2 + window.scrollY;
  }

  private measure() {
    for (const l of this.live.values()) this.measureOne(l);
  }

  /* ── answering the page ──────────────────────────────────────────── */

  private onSwing = () => this.swing();

  private onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    this.mx = e.clientX;
    this.my = e.clientY;
    this.dirty = true;
  };

  private onScroll = () => {
    this.dirty = true;
  };

  /** The cursor, applied once a frame on GSAP's ticker, and only to the doodles near it. */
  private tick = () => {
    if (!this.dirty || !this.seen || this.mx < 0) return;
    this.dirty = false;
    const { mx, my } = this;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.drift?.x(-((mx - vw / 2) / vw) * 16);
    this.drift?.y(-((my - vh / 2) / vh) * 12);
    for (const l of this.live.values()) {
      const cx = l.px - window.scrollX;
      const cy = l.py - window.scrollY;
      const dx = cx - mx;
      const dy = cy - my;
      const d = Math.hypot(dx, dy) || 1;
      if (l.arrow) {
        // Arrows point at the cursor, turning the short way round.
        let a = (Math.atan2(-dy, -dx) * 180) / Math.PI;
        while (a - l.turn > 180) a -= 360;
        while (a - l.turn < -180) a += 360;
        l.turn = a;
        l.rot(a);
      }
      const k = Math.max(0, 1 - d / 190);
      if (k <= 0) {
        if (l.near) {
          l.near = false;
          l.x(0);
          l.y(0);
          l.scale(1);
          if (!l.arrow) l.rot(0);
        }
        continue;
      }
      // Near it: step aside, tip away and grow a touch.
      l.near = true;
      const near = k * k * (3 - 2 * k);
      l.x((dx / d) * near * 30);
      l.y((dy / d) * near * 30);
      l.scale(1 + near * 0.16);
      if (!l.arrow) l.rot((dx / d) * near * 14);
    }
  };

  /** A push from (x, y) on screen, with a spring back. `reach` 0: a hop for all. */
  private push(x: number, y: number, reach: number, force: number, wave = 0) {
    if (!this.seen || this.reduced) return;
    const hits: { l: Live; d: number; dx: number; dy: number }[] = [];
    for (const l of this.live.values()) {
      const dx = l.px - window.scrollX - x;
      const dy = l.py - window.scrollY - y;
      const d = Math.hypot(dx, dy) || 1;
      if (reach && d > reach) continue;
      hits.push({ l, d, dx, dy });
    }
    // A crowded field hops its nearest sixty; the rest ride the field's own jolt.
    hits.sort((a, b) => a.d - b.d);
    for (const { l, d, dx, dy } of hits.slice(0, 60)) {
      const k = reach ? 1 - d / reach : 1;
      gsap
        .timeline({ delay: wave ? d / wave : 0 })
        .to(l.kick, {
          x: reach ? (dx / d) * force * k : 0,
          y: reach ? (dy / d) * force * k : -force,
          rotation: l.arrow ? 0 : (dx / d) * 8,
          duration: 0.18,
          ease: "power2.out",
          overwrite: "auto",
        })
        .to(l.kick, { x: 0, y: 0, rotation: 0, duration: 1, ease: "elastic.out(1, 0.4)" });
    }
  }

  private onImpact = (e: Event) => {
    const { x, y, power } = (e as CustomEvent<{ x: number; y: number; power: number }>).detail;
    // Doodles forged by this blow fly out of it.
    if (this.queue.length) this.launch({ x, y });
    this.push(x, y, 0, 10 + Math.min(power, 3) * 5, 1600);
  };

  private onRipple = (e: Event) => {
    const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail;
    this.push(x, y, 300, 34);
  };
}

export const doodles = new DoodleForge();
