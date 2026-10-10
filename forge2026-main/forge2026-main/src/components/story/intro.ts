import { fx } from "./fx";
import { perf } from "./perf";
import {
  ANVIL,
  HAMMER_HANDLE,
  HAMMER_HEAD,
  HAMMER_PIVOT,
  LOGO_HEIGHT,
  LOGO_SHARDS,
} from "./scene/mark";

/*
  The way in: the forge heats, the hammer comes down, and the page opens.

    heat     the anvil glows in the dark with the hammer raised, while the 3D
             scene loads (a tap strikes early)
    strike   the hammer cocks back and swings down
    hold     contact: a white flash, the screen shakes, sparks fly (over the
             page, on the FX layer), the mark's own sparks are forged out of
             the blow into the logo and the wordmark lands
    reveal   the logo pushes toward you and an iris opens from the anvil onto
             the page

  All drawn on one canvas, as a pure function of the intro's own clock, so a
  frame can be stepped by hand. The mark is drawn from its own traced paths
  (scene/mark.ts), the same ones the 3D forge is built from, and settles into
  exactly the logo's pose.
*/

const MIN_HEAT = 0.95;
const MAX_HEAT = 2.8;
const WIND = 0.36;
const SWING = 0.13;
/** From contact to the reveal: the logo's moment. */
const HOLD = 0.9;
const REVEAL = 0.85;

type Pose = { x: number; y: number; r: number };
const deg = (d: number) => (d * Math.PI) / 180;
/** The hammer in the mark's own units (y down): raised while heating, cocked, on the anvil, and home. */
const RAISED: Pose = { x: 14, y: -26, r: deg(24) };
const COCKED: Pose = { x: 24, y: -50, r: deg(40) };
const CONTACT: Pose = { x: -34, y: 142, r: deg(-33.2) };
const BOUNCE: Pose = { x: -27, y: 120, r: deg(-26) };
const HOME: Pose = { x: 0, y: 0, r: 0 };

const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  r: a.r + (b.r - a.r) * t,
});

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeOutBack = (x: number) => {
  const c1 = 1.6;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** Points of a path's first subpath (M/L/Z polylines only), in the mark's units. */
function outline(d: string): [number, number][] {
  const first = d.split("M").filter((c) => c.trim())[0];
  const nums = first
    .replace(/[LZ]/g, " ")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

export type IntroHooks = {
  /** Is the page ready to be revealed (the 3D scene loaded)? */
  ready: () => boolean;
  onPhase?: (phase: string) => void;
  /** The page is being revealed. */
  onReveal: () => void;
  onDone: () => void;
};

export class IntroPlayer {
  private ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private W = 0;
  private H = 0;
  /** Pixels per mark unit, and where the anvil face sits on screen. */
  private s = 1;
  private ox = 0;
  private oy = 0;
  private wordY = 0;
  private wordH = 0;

  private t = 0;
  private tStrike = -1;
  private tImpact = -1;
  private tReveal = -1;
  phase: "heat" | "strike" | "hold" | "reveal" | "done" = "heat";

  private anvil = new Path2D(ANVIL);
  private head = new Path2D(HAMMER_HEAD);
  private handle = new Path2D(HAMMER_HANDLE);
  private sparks = LOGO_SHARDS.map((sh, i) => {
    const pts = outline(sh.d);
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
    return {
      path: new Path2D(sh.d),
      fill: sh.fill,
      c,
      spin: (i % 2 ? 1 : -1) * (1.5 + (i % 5) * 0.6),
      delay: (i % 7) * 0.014,
    };
  });
  private word = new Image();
  private wordReady = false;
  private snap: HTMLCanvasElement | null = null;

  /** Dev tools: ignore the ticker, so frames can be stepped by hand with `frame(dt, true)`. */
  paused = false;

  constructor(
    private root: HTMLElement,
    private canvas: HTMLCanvasElement,
    private hooks: IntroHooks,
  ) {
    this.ctx = canvas.getContext("2d");
    this.word.onload = () => (this.wordReady = true);
    this.word.src = "/brand/wordmark.webp";
    this.layout();
  }

  layout = () => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.dpr = Math.min(window.devicePixelRatio || 1, perf.tier === "low" ? 1 : coarse ? 1.5 : 2);
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    this.W = W;
    this.H = H;
    const markH = Math.min(H * 0.36, W * 0.52, 330);
    this.s = markH / LOGO_HEIGHT;
    this.wordH = markH * 0.25;
    const gap = markH * 0.12;
    const total = markH + gap + this.wordH;
    const top = (H - total) / 2 - H * 0.02;
    // The mark runs from the hammer's top (y -206) to the anvil's foot (y 111).
    this.oy = top + 206 * this.s;
    this.ox = W / 2 + 8 * this.s;
    this.wordY = this.oy + 111 * this.s + gap;
  };

  /* ── control ──────────────────────────────────────────────────────── */

  /** A tap while heating strikes now; a tap after the blow opens the page now. */
  poke() {
    if (this.phase === "heat") this.strike();
    else if (this.phase === "hold") this.tReveal = Math.min(this.tReveal, this.t + 0.05);
  }

  private setPhase(p: IntroPlayer["phase"]) {
    this.phase = p;
    this.root.dataset.phase = p;
    this.hooks.onPhase?.(p);
  }

  private strike() {
    this.tStrike = this.t;
    this.tImpact = this.t + WIND + SWING;
    this.setPhase("strike");
  }

  private impact() {
    this.setPhase("hold");
    this.tReveal = this.t + HOLD;
    fx.strike(this.ox, this.oy, LOGO_HEIGHT * this.s * 1.15, 2.4);
    if (window.matchMedia("(pointer: coarse)").matches && "vibrate" in navigator) {
      try {
        navigator.vibrate([30, 50, 40]);
      } catch {
        // A nicety only.
      }
    }
  }

  private reveal() {
    this.setPhase("reveal");
    // Freeze the last frame; the reveal carries it away.
    const snap = document.createElement("canvas");
    snap.width = this.canvas.width;
    snap.height = this.canvas.height;
    snap.getContext("2d")?.drawImage(this.canvas, 0, 0);
    this.snap = snap;
    this.hooks.onReveal();
  }

  /* ── the frame ────────────────────────────────────────────────────── */

  frame(dtRaw: number, manual = false) {
    if (this.phase === "done" || (this.paused && !manual)) return;
    const dt = Math.min(Math.max(dtRaw, 0), 1 / 20);
    this.t += dt;
    const t = this.t;

    if (this.phase === "heat" && t > MIN_HEAT && (this.hooks.ready() || t > MAX_HEAT))
      this.strike();
    if (this.phase === "strike" && t >= this.tImpact) this.impact();
    if (this.phase === "hold" && t >= this.tReveal) this.reveal();
    if (this.phase === "reveal" && t >= this.tReveal + REVEAL) {
      this.setPhase("done");
      this.hooks.onDone();
      return;
    }
    this.render();
  }

  private hammer(t: number): Pose {
    if (this.phase === "heat") {
      const tremble = Math.sin(t * 11) * deg(0.7) + Math.sin(t * 2.1) * deg(1.5);
      return { ...RAISED, r: RAISED.r + tremble };
    }
    if (this.tImpact < 0 || t < this.tImpact) {
      const u = t - this.tStrike;
      if (u < WIND) return lerpPose(RAISED, COCKED, easeOutCubic(clamp01(u / WIND)));
      return lerpPose(COCKED, CONTACT, Math.pow(clamp01((u - WIND) / SWING), 2.3));
    }
    const v = t - this.tImpact;
    if (v < 0.09) return lerpPose(CONTACT, BOUNCE, easeOutCubic(v / 0.09));
    return lerpPose(BOUNCE, HOME, easeOutBack(clamp01((v - 0.09) / 0.85)));
  }

  private render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const { W, H, dpr, t } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.phase === "reveal") {
      this.renderReveal(ctx);
      return;
    }

    const since = this.tImpact > 0 ? t - this.tImpact : -1;
    const hit = since >= 0;
    const flash = hit ? Math.max(0, 1 - since / 0.42) : 0;
    const shake = hit ? Math.max(0, 1 - since / 0.65) : 0;
    const heat = hit ? 0.25 + 0.75 * Math.exp(-since * 2.2) : 0;
    const appear = easeOutCubic(clamp01(t / 0.6));

    // The room: black, with the forge's glow.
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, W, H);
    const gy = this.oy + 40 * this.s;
    const glowR = 340 * this.s * (1 + heat * 0.5);
    const breathe = 0.85 + Math.sin(t * 2.4) * 0.15;
    const g = ctx.createRadialGradient(this.ox, gy, 0, this.ox, gy, glowR);
    const ga = appear * (0.32 * breathe + heat * 0.35);
    g.addColorStop(0, `rgba(196, 184, 255, ${ga * 0.55})`);
    g.addColorStop(0.45, `rgba(90, 56, 255, ${ga * 0.5})`);
    g.addColorStop(1, "rgba(90, 56, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // The mark.
    const sx = (Math.random() - 0.5) * 22 * shake * shake;
    const sy = (Math.random() - 0.5) * 22 * shake * shake;
    const punch = hit ? 1 + 0.07 * Math.exp(-since * 6) : 1;
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.translate(this.ox + sx, this.oy + sy);
    ctx.scale(this.s * punch, this.s * punch);
    this.drawAnvil(ctx, heat);
    if (hit) this.drawSparks(ctx, since);
    // A smear behind the hammer while it swings.
    if (this.phase === "strike" && t - this.tStrike > WIND) {
      for (let k = 3; k >= 1; k--) {
        ctx.globalAlpha = appear * (0.3 - k * 0.07);
        this.drawHammer(ctx, this.hammer(t - k * 0.022), 0);
      }
      ctx.globalAlpha = appear;
    }
    this.drawHammer(ctx, this.hammer(t), heat);
    ctx.restore();

    // The wordmark lands just after the blow.
    if (hit && this.wordReady) {
      const u = clamp01((since - 0.12) / 0.55);
      if (u > 0) {
        const e = easeOutExpo(u);
        const h = this.wordH * (1.3 - 0.3 * e);
        const w = h * (this.word.naturalWidth / this.word.naturalHeight || 3.1);
        ctx.globalAlpha = e;
        ctx.drawImage(this.word, W / 2 - w / 2 + sx, this.wordY + (this.wordH - h) / 2 + sy, w, h);
        ctx.globalAlpha = 1;
      }
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(246, 244, 255, ${(flash * flash * 0.92).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** The logo pushes toward you while an iris opens from the anvil onto the page. */
  private renderReveal(ctx: CanvasRenderingContext2D) {
    const snap = this.snap;
    if (!snap) return;
    const { W, H, ox, oy } = this;
    const u = clamp01((this.t - this.tReveal) / REVEAL);
    const e = easeInOutCubic(u);
    const zoom = 1 + 0.5 * e * e;
    ctx.save();
    ctx.globalAlpha = 1 - clamp01((u - 0.6) / 0.4);
    ctx.translate(ox, oy);
    ctx.scale(zoom, zoom);
    ctx.translate(-ox, -oy);
    ctx.drawImage(snap, 0, 0, W, H);
    ctx.restore();

    const far = Math.max(
      Math.hypot(ox, oy),
      Math.hypot(W - ox, oy),
      Math.hypot(ox, H - oy),
      Math.hypot(W - ox, H - oy),
    );
    const R = far * 1.15 * e;
    if (R < 1) return;
    ctx.globalCompositeOperation = "destination-out";
    const hole = ctx.createRadialGradient(ox, oy, R * 0.72, ox, oy, R);
    hole.addColorStop(0, "rgba(0, 0, 0, 1)");
    hole.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(ox, oy, R, 0, Math.PI * 2);
    ctx.fill();
    // A ring of light rides the edge of the opening.
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(196, 184, 255, ${(0.55 * (1 - u)).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ox, oy, R * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  private metal(ctx: CanvasRenderingContext2D, y0: number, y1: number) {
    const m = ctx.createLinearGradient(0, y0, 0, y1);
    m.addColorStop(0, "#f7f8fb");
    m.addColorStop(0.5, "#c9cbd5");
    m.addColorStop(1, "#7e808d");
    return m;
  }

  private drawAnvil(ctx: CanvasRenderingContext2D, heat: number) {
    ctx.fillStyle = this.metal(ctx, 0, 112);
    ctx.fill(this.anvil, "evenodd");
    // Lit from behind by the glow.
    ctx.strokeStyle = `rgba(196, 184, 255, ${0.35 + heat * 0.4})`;
    ctx.lineWidth = 1.6;
    ctx.stroke(this.anvil);
    if (heat > 0.01) {
      ctx.save();
      ctx.clip(this.anvil, "evenodd");
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(-8, 4, 0, -8, 4, 150);
      g.addColorStop(0, `rgba(255, 255, 255, ${heat})`);
      g.addColorStop(0.35, `rgba(196, 184, 255, ${heat * 0.75})`);
      g.addColorStop(1, "rgba(90, 56, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(-140, -10, 280, 130);
      ctx.restore();
    }
  }

  /** The mark's sparks, forged out of the blow and flying to their places. */
  private drawSparks(ctx: CanvasRenderingContext2D, since: number) {
    for (const sp of this.sparks) {
      const u = clamp01((since - sp.delay) / 0.55);
      if (u <= 0) continue;
      const e = easeOutExpo(u);
      const [cx, cy] = sp.c;
      ctx.save();
      ctx.translate(cx * e, -2 + (cy + 2) * e);
      ctx.rotate((1 - e) * sp.spin);
      ctx.scale(0.25 + 0.75 * e, 0.25 + 0.75 * e);
      ctx.translate(-cx, -cy);
      ctx.fillStyle = sp.fill;
      ctx.fill(sp.path);
      if (e < 1) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255, 250, 235, ${((1 - e) * 0.9).toFixed(3)})`;
        ctx.fill(sp.path);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
    }
  }

  private drawHammer(ctx: CanvasRenderingContext2D, p: Pose, heat: number) {
    ctx.save();
    ctx.translate(HAMMER_PIVOT.x + p.x, HAMMER_PIVOT.y + p.y);
    ctx.rotate(p.r);
    ctx.translate(-HAMMER_PIVOT.x, -HAMMER_PIVOT.y);
    ctx.fillStyle = this.metal(ctx, -206, -135);
    ctx.fill(this.head, "evenodd");
    ctx.fill(this.handle);
    if (heat > 0.3) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(196, 184, 255, ${((heat - 0.3) * 0.6).toFixed(3)})`;
      ctx.fill(this.head, "evenodd");
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
  }
}
