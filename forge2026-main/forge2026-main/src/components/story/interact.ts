import { gsap } from "gsap";
import { fx } from "./fx";
import { ShardCursor, type CursorState } from "./shardCursor";
import { stage } from "./stage";

/*
  Everything the pointer touches answers it.

    custom cursor   a crystal shard whose tip is the pointer (shardCursor.ts);
                    over anything you can press it charges up and a tag
                    names what a click will do (data-cursor="…")
    magnetic        buttons lean toward the cursor while it is over them
    tilt + glare    [data-tilt] surfaces turn in 3D under the pointer, with a
                    light that follows it (--rx, --ry, --mx, --my)
    ripple          a press sends a ring out from the exact point touched;
                    on open space, away from anything you can press, the ring
                    spreads over the page and a wave runs through the 3D shards

  Kept calm on purpose: clicks don't throw sparks, and letters never move
  (registerChars and shock are left for a headline that asks for them with
  data-proximity; none does now).

  Hover work only runs with a real mouse; clicks and taps work everywhere.
  Nothing runs for people who ask for reduced motion. All per-frame work goes
  through GSAP's ticker, the page's single animation loop.
*/

const PRESSABLE = "a, button, summary, label, select, [role='button'], [role='tab'], [data-cursor]";
const FIELD = "input, textarea, select, [contenteditable='true']";
const MAGNETIC = ".btn, .round-btn, .social, .tab, [data-magnetic]";
/** Surfaces with a light that follows the cursor across them (--mx, --my). */
const SPOT = ".spot, .btn, .round-btn, .tier-tab";
const RIPPLE =
  ".btn, .round-btn, .social, .tab, .door, .tier-tab, .who-tab, .crosslink, .segmented button, .faq summary";

type CursorParts = { canvas: HTMLCanvasElement; tag: HTMLElement };

type Prox = {
  el: HTMLElement;
  chars: HTMLElement[];
  pts: Float32Array;
  f: Float32Array;
  reach: number;
  visible: boolean;
};

class Interactions {
  private started = false;
  /** Custom cursor and hover effects: a fine pointer, and motion allowed. */
  hover = false;
  private reduced = false;

  private x = -200;
  private y = -200;
  private seen = false;
  private moved = true;
  private pressed = false;

  private parts: CursorParts | null = null;

  /** Button scenes (Glyphs.tsx): told which button the mouse is over, and when it is pressed. */
  private onGlyph: ((el: HTMLElement | null) => void) | null = null;
  private onGlyphPress: (() => void) | null = null;
  private glyphEl: HTMLElement | null = null;
  private shard: ShardCursor | null = null;

  private target: HTMLElement | null = null;
  private magnet: { el: HTMLElement; dx: number; dy: number } | null = null;
  private tilt: HTMLElement | null = null;
  private spot: HTMLElement | null = null;

  private prox = new Map<HTMLElement, Prox>();
  private io: IntersectionObserver | null = null;
  private lastScroll = -1;

  private now = 0;
  private shockAt = -10;
  private shockX = 0;
  private shockY = 0;
  private shockPow = 0;

  start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.hover = !this.reduced && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("pointerdown", this.onDown, { passive: true });
    window.addEventListener("pointerup", this.onUp, { passive: true });
    window.addEventListener("click", this.onClick, { passive: true });
    document.addEventListener("pointerover", this.onOver, { passive: true });
    document.documentElement.addEventListener("pointerleave", this.onLeave);
    window.addEventListener("blur", this.onLeave);

    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const p = this.prox.get(e.target as HTMLElement);
        if (p) p.visible = e.isIntersecting;
      }
    });

    this.makeCursor();
    gsap.ticker.add(this.tick);
  }

  registerScenes(onHover: ((el: HTMLElement | null) => void) | null, onPress: (() => void) | null) {
    this.onGlyph = onHover;
    this.onGlyphPress = onPress;
  }

  private setGlyph(el: HTMLElement | null) {
    if (el === this.glyphEl) return;
    this.glyphEl = el;
    this.onGlyph?.(el);
  }

  registerCursor(parts: CursorParts | null) {
    this.parts = parts;
    if (!parts) {
      this.shard = null;
      delete document.documentElement.dataset.shardCursor;
    }
    this.makeCursor();
  }

  private makeCursor() {
    if (!this.started || !this.hover || !this.parts || this.shard) return;
    this.shard = new ShardCursor(this.parts.canvas, this.parts.tag);
    // Not data-cursor: that names what a click on an element does, and the
    // page itself must not read as something to press.
    document.documentElement.dataset.shardCursor = "";
  }

  /* ── pointer events ───────────────────────────────────────────────── */

  private onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    this.x = e.clientX;
    this.y = e.clientY;
    this.moved = true;
    this.seen = true;
    this.shard?.move(this.x, this.y);
    stage.pointer(this.x, this.y, true);
  };

  private onLeave = () => {
    this.seen = false;
    this.shard?.hide();
    stage.pointer(0, 0, false);
    this.release();
    this.clearProximity();
  };

  private onOver = (e: PointerEvent) => {
    if (!this.hover || e.pointerType !== "mouse") return;
    const el = e.target instanceof Element ? e.target : null;
    const target = (el?.closest(`${FIELD}, ${PRESSABLE}`) as HTMLElement | null) ?? null;
    this.spot = (el?.closest(SPOT) as HTMLElement | null) ?? null;
    if (target !== this.target) {
      this.target = target;
      this.paintCursorState();
    }
    const magnetic = (el?.closest(MAGNETIC) as HTMLElement | null) ?? null;
    if (magnetic !== this.magnet?.el) {
      if (this.magnet) this.magnet.el.style.translate = "";
      this.magnet = magnetic ? { el: magnetic, dx: 0, dy: 0 } : null;
    }
    const tilt = (el?.closest("[data-tilt]") as HTMLElement | null) ?? null;
    if (tilt !== this.tilt) {
      if (this.tilt) this.resetTilt(this.tilt);
      this.tilt = tilt;
      if (tilt) tilt.dataset.tilting = "";
    }
    this.setGlyph((el?.closest("[data-glyph]") as HTMLElement | null) ?? null);
  };

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.pressed = true;
    // Where the next page transition's iris will open from.
    const root = document.documentElement.style;
    root.setProperty("--vt-x", `${Math.round(e.clientX)}px`);
    root.setProperty("--vt-y", `${Math.round(e.clientY)}px`);
    if (e.pointerType === "mouse") this.shard?.pressDown();
    const el = e.target instanceof Element ? e.target : null;
    const ripple = el?.closest(RIPPLE) as HTMLElement | null;
    if (ripple && !this.reduced) this.ripple(ripple, e.clientX, e.clientY);
    // A mouse ripples open space on press, for immediacy; touch waits for a
    // tap (click), so starting a scroll with a finger sets nothing off.
    if (e.pointerType === "mouse" && this.open(el)) this.rippleOpen(e.clientX, e.clientY);
    // The button's scene plays its finale.
    if (this.glyphEl && el && this.glyphEl.contains(el)) this.onGlyphPress?.();
  };

  private onUp = () => {
    this.pressed = false;
    this.shard?.pressUp();
  };

  private onClick = (e: MouseEvent) => {
    // Taps: pointer events report touch, and the click only fires on a real tap.
    const type = (e as PointerEvent).pointerType;
    const touchLike = type ? type !== "mouse" : !this.hover;
    const el = e.target instanceof Element ? e.target : null;
    if (touchLike && this.open(el)) this.rippleOpen(e.clientX, e.clientY);
  };

  /** Open space: not on anything you can press or type in. */
  private open(el: Element | null) {
    return !el?.closest(`${FIELD}, ${PRESSABLE}`);
  }

  /** Open space answers a press with a ripple: a ring on the page, a wave through the shards. */
  private rippleOpen(x: number, y: number) {
    if (this.reduced) return;
    stage.burst(x, y, 0.85);
    fx.ripple(x, y);
    // For anything on the page that wants to feel it (the hero's doodles).
    window.dispatchEvent(new CustomEvent("forge:ripple", { detail: { x, y } }));
  }

  private release() {
    this.setGlyph(null);
    if (this.magnet) this.magnet.el.style.translate = "";
    this.magnet = null;
    if (this.tilt) this.resetTilt(this.tilt);
    this.tilt = null;
    this.target = null;
    this.paintCursorState();
  }

  /* ── cursor ───────────────────────────────────────────────────────── */

  private paintCursorState() {
    const c = this.shard;
    if (!c) return;
    const t = this.target;
    let state: CursorState = "idle";
    let label = "";
    if (t) {
      if (t.matches(FIELD) || t.closest(FIELD)) state = "field";
      else {
        state = "press";
        label = t.dataset.cursor ?? t.closest<HTMLElement>("[data-cursor]")?.dataset.cursor ?? "";
      }
    }
    c.setState(state, label);
  }

  /* ── effects ──────────────────────────────────────────────────────── */

  private resetTilt(el: HTMLElement) {
    delete el.dataset.tilting;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  private ripple(el: HTMLElement, x: number, y: number) {
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const dot = document.createElement("span");
    dot.className = "ripple";
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.left = `${x - r.left - size / 2}px`;
    dot.style.top = `${y - r.top - size / 2}px`;
    el.appendChild(dot);
    window.setTimeout(() => dot.remove(), 700);
  }

  /* ── proximity type ───────────────────────────────────────────────── */

  /** Give a headline's letters to the proximity effect (after splitting). */
  registerChars(el: HTMLElement, chars: Element[]) {
    if (!this.hover) return;
    const list = chars as HTMLElement[];
    const pts = new Float32Array(list.length * 2);
    for (let i = 0; i < list.length; i++) {
      // Layout offsets ignore transforms, so reveals in flight don't skew
      // this. The headline itself is positioned (styles.css), so the chain
      // of offset parents ends at it.
      let x = list[i].offsetWidth / 2;
      let y = list[i].offsetHeight / 2;
      let node: HTMLElement | null = list[i];
      while (node && node !== el) {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      pts[i * 2] = x;
      pts[i * 2 + 1] = y;
    }
    const size = parseFloat(getComputedStyle(el).fontSize) || 48;
    const prev = this.prox.get(el);
    const entry: Prox = {
      el,
      chars: list,
      pts,
      f: new Float32Array(list.length),
      reach: Math.max(110, size * 1.9),
      visible: prev?.visible ?? true,
    };
    this.prox.set(el, entry);
    if (!prev) this.io?.observe(el);
    this.moved = true;
  }

  /**
   * A shockwave through the page's lettering, from (x, y): letters jump and
   * glow as it passes them, nearest first. Sent by a strike of the anvil.
   */
  shock(x: number, y: number, power = 1) {
    if (!this.hover) return;
    this.shockAt = this.now;
    this.shockX = x;
    this.shockY = y;
    this.shockPow = Math.min(1.4, 0.75 + power * 0.25);
  }

  unregister(el: HTMLElement) {
    this.prox.delete(el);
    this.io?.unobserve(el);
  }

  private clearProximity() {
    for (const p of this.prox.values()) {
      for (let i = 0; i < p.chars.length; i++) {
        if (p.f[i] !== 0) {
          p.f[i] = 0;
          p.chars[i].style.setProperty("--f", "0");
        }
      }
    }
  }

  /* ── the frame ────────────────────────────────────────────────────── */

  /** Dev tools: step one frame by hand (a background tab gets no frames). */
  step(dt: number) {
    this.tick(0, dt * 1000);
  }

  private tick = (_time: number, deltaMs: number) => {
    if (!this.hover) return;
    const dt = deltaMs / 1000;
    this.now += Math.min(dt, 0.1);
    this.shard?.frame(dt);

    const scroll = window.scrollY;
    const scrolled = scroll !== this.lastScroll;
    this.lastScroll = scroll;
    const shocking = this.now - this.shockAt < 1.8;
    if (!shocking && (!this.seen || (!this.moved && !scrolled))) return;
    this.moved = false;

    // Magnetic pull, measured against the element's resting place.
    const m = this.seen ? this.magnet : null;
    if (m) {
      const r = m.el.getBoundingClientRect();
      const cx = r.left + r.width / 2 - m.dx;
      const cy = r.top + r.height / 2 - m.dy;
      // A lean, not a lunge: never far enough to reach a neighbour 12px away.
      const k = 0.16;
      const lim = Math.min(6, r.width * 0.06);
      m.dx = Math.max(-lim, Math.min(lim, (this.x - cx) * k));
      m.dy = Math.max(-lim, Math.min(lim, (this.y - cy) * k));
      m.el.style.translate = `${m.dx.toFixed(1)}px ${m.dy.toFixed(1)}px`;
    }

    // Tilt and glare.
    const t = this.seen ? this.tilt : null;
    if (t) {
      const r = t.getBoundingClientRect();
      const px = (this.x - r.left) / r.width;
      const py = (this.y - r.top) / r.height;
      t.style.setProperty("--rx", `${((0.5 - py) * 10).toFixed(2)}deg`);
      t.style.setProperty("--ry", `${((px - 0.5) * 12).toFixed(2)}deg`);
      t.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      t.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    }

    // The light that follows the cursor across the surface under it.
    const s = this.seen ? this.spot : null;
    if (s && s !== t) {
      const r = s.getBoundingClientRect();
      s.style.setProperty("--mx", `${(((this.x - r.left) / r.width) * 100).toFixed(1)}%`);
      s.style.setProperty("--my", `${(((this.y - r.top) / r.height) * 100).toFixed(1)}%`);
    }

    // Letters near the cursor lift and glow; a shockwave lifts them as it passes.
    const since = this.now - this.shockAt;
    for (const p of this.prox.values()) {
      if (!p.visible) continue;
      const r = p.el.getBoundingClientRect();
      if (r.bottom < -p.reach || r.top > window.innerHeight + p.reach) continue;
      const reach = p.reach;
      for (let i = 0; i < p.chars.length; i++) {
        const cx = r.left + p.pts[i * 2];
        const cy = r.top + p.pts[i * 2 + 1];
        const d = this.seen ? Math.hypot(cx - this.x, cy - this.y) : Infinity;
        let v = d < reach ? (1 - d / reach) ** 2 : 0;
        if (shocking) {
          const tw = since - Math.hypot(cx - this.shockX, cy - this.shockY) / 1500;
          if (tw > 0 && tw < 1.2) {
            const w = this.shockPow * (tw < 0.05 ? tw / 0.05 : Math.exp(-(tw - 0.05) * 4.2));
            if (w > v) v = w;
          }
        }
        if (Math.abs(v - p.f[i]) > 0.02 || (v === 0 && p.f[i] !== 0)) {
          p.f[i] = v;
          p.chars[i].style.setProperty("--f", v.toFixed(3));
        }
      }
    }
  };
}

export const interactions = new Interactions();
