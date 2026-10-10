/*
  Sparks, glows, rings and flying fragments, in 2D.

  The engine behind the FX layer over the whole page (click sparks, the
  cursor's trail, the anvil strike, the loading intro's blow). It only
  integrates and draws; whoever owns a canvas decides when to call `step` and
  `draw`. Everything glowing is drawn additively, so where sparks overlap
  they burn white. There is no fire: the forge throws cold, bright sparks.
*/

type Rgb = readonly [number, number, number];
type Range = readonly [number, number];

const hex = (h: string): Rgb => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const PALETTE = {
  white: hex("#fffaf0"),
  iris: hex("#5a38ff"),
  lilac: hex("#c4b8ff"),
  lime: hex("#d6ff42"),
};

const DAY = { ...PALETTE };
/** The night shift's sparks: the same roles in its neon. */
const NIGHT = {
  white: hex("#fff4fc"),
  iris: hex("#b18cff"),
  lilac: hex("#3cefff"),
  lime: hex("#ff4fd8"),
};

/** Sparks in the night shift's colours, or the day's again. */
export function nightSparks(on: boolean) {
  Object.assign(PALETTE, on ? NIGHT : DAY);
}

const rand = (r: Range) => r[0] + Math.random() * (r[1] - r[0]);
const pick = <T>(list: readonly T[]) => list[(Math.random() * list.length) | 0];

/** Soft round glows, one per colour, drawn once and stamped many times. */
const sprites = new Map<string, HTMLCanvasElement>();
function sprite(colour: string) {
  let c = sprites.get(colour);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const [r, gg, b] = hex(colour);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, `rgba(${r},${gg},${b},1)`);
    grd.addColorStop(0.22, `rgba(${r},${gg},${b},0.62)`);
    grd.addColorStop(0.55, `rgba(${r},${gg},${b},0.16)`);
    grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }
  sprites.set(colour, c);
  return c;
}

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: Rgb;
  w: number;
  drag: number;
  grav: number;
  trail: number;
};

type Glow = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  alpha: number;
  drag: number;
  grav: number;
  colour: string;
  sway: number;
  phase: number;
};

type Frag = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  life: number;
  max: number;
  fill: string;
  grav: number;
};

type Ring = {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  w: number;
  c: Rgb;
};

type Flash = {
  x: number;
  y: number;
  radius: number;
  life: number;
  max: number;
  power: number;
  c: Rgb;
};

export type SparkOptions = {
  n: number;
  speed: Range;
  /** Centre of the spray, radians (0 = right, -PI/2 = up). Omit for all round. */
  angle?: number;
  spread?: number;
  colours?: readonly Rgb[];
  life?: Range;
  width?: Range;
  grav?: number;
  drag?: number;
  trail?: number;
};

export class Particles {
  private sparks: Spark[] = [];
  private glows: Glow[] = [];
  private frags: Frag[] = [];
  private rings: Ring[] = [];
  private flashes: Flash[] = [];
  /** A hard ceiling so a frantic clicker can't bury the page. */
  cap = 1600;

  get count() {
    return (
      this.sparks.length +
      this.glows.length +
      this.frags.length +
      this.rings.length +
      this.flashes.length
    );
  }

  clear() {
    this.sparks.length = 0;
    this.glows.length = 0;
    this.frags.length = 0;
    this.rings.length = 0;
    this.flashes.length = 0;
  }

  private get room() {
    return this.cap - this.sparks.length - this.glows.length;
  }

  /* ── spawning ─────────────────────────────────────────────────────── */

  spray(x: number, y: number, o: SparkOptions) {
    const n = Math.min(o.n, Math.max(0, this.room));
    const colours = o.colours ?? [PALETTE.white, PALETTE.lilac, PALETTE.lime, PALETTE.iris];
    for (let i = 0; i < n; i++) {
      const a =
        o.angle === undefined
          ? Math.random() * Math.PI * 2
          : o.angle + (Math.random() - 0.5) * (o.spread ?? Math.PI);
      const s = rand(o.speed);
      const max = rand(o.life ?? [0.45, 1.1]);
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        max,
        c: pick(colours),
        w: rand(o.width ?? [1.1, 2.4]),
        drag: o.drag ?? 1.6,
        grav: o.grav ?? 900,
        trail: o.trail ?? 0.035,
      });
    }
  }

  /** A single soft glow, for the light around an impact. */
  glow(x: number, y: number, size: number, colour: string, life = 0.6, alpha = 1) {
    this.glows.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0,
      max: life,
      size,
      grow: 0.4,
      alpha,
      drag: 0,
      grav: 0,
      colour,
      sway: 0,
      phase: 0,
    });
  }

  /** Little crystal shards that tumble out and fall. */
  shards(
    x: number,
    y: number,
    n: number,
    speed: Range,
    fills: readonly string[] = ["#5a38ff", "#c4b8ff", "#d6ff42", "#e9eaee"],
    size: Range = [4, 9],
  ) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
      const s = rand(speed);
      this.frags.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 16,
        size: rand(size),
        life: 0,
        max: 0.9 + Math.random() * 0.8,
        fill: pick(fills),
        grav: 1100,
      });
    }
  }

  ring(x: number, y: number, r0: number, r1: number, life = 0.6, w = 3, c: Rgb = PALETTE.lilac) {
    this.rings.push({ x, y, r0, r1, life: 0, max: life, w, c });
  }

  flash(x: number, y: number, radius: number, power = 1, life = 0.35, c: Rgb = PALETTE.white) {
    this.flashes.push({ x, y, radius, life: 0, max: life, power, c });
  }

  /* ── simulation ───────────────────────────────────────────────────── */

  step(dt: number) {
    if (dt <= 0) return;

    const sp = this.sparks;
    for (let i = sp.length - 1; i >= 0; i--) {
      const p = sp[i];
      p.life += dt;
      if (p.life >= p.max) {
        sp[i] = sp[sp.length - 1];
        sp.pop();
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    const gl = this.glows;
    for (let i = gl.length - 1; i >= 0; i--) {
      const p = gl[i];
      p.life += dt;
      if (p.life >= p.max) {
        gl[i] = gl[gl.length - 1];
        gl.pop();
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.phase += dt * 7;
      p.vx = p.vx * k + Math.sin(p.phase) * p.sway * dt * 6;
      p.vy = p.vy * k + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    const fr = this.frags;
    for (let i = fr.length - 1; i >= 0; i--) {
      const p = fr[i];
      p.life += dt;
      if (p.life >= p.max) {
        fr[i] = fr[fr.length - 1];
        fr.pop();
        continue;
      }
      p.vx *= Math.exp(-0.8 * dt);
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }

    for (const list of [this.rings, this.flashes] as { life: number; max: number }[][]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].life += dt;
        if (list[i].life >= list[i].max) list.splice(i, 1);
      }
    }
  }

  /* ── drawing ──────────────────────────────────────────────────────── */

  draw(ctx: CanvasRenderingContext2D) {
    // Solid fragments first, with normal blending.
    ctx.globalCompositeOperation = "source-over";
    for (const p of this.frags) {
      const t = p.life / p.max;
      ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.4);
      ctx.lineTo(s * 0.55, s * 0.5);
      ctx.lineTo(-s * 0.45, s * 0.8);
      ctx.closePath();
      ctx.fillStyle = p.fill;
      ctx.fill();
      ctx.restore();
    }

    // Everything that glows adds up.
    ctx.globalCompositeOperation = "lighter";

    for (const f of this.flashes) {
      const t = f.life / f.max;
      const a = f.power * (1 - t) * (1 - t);
      const r = f.radius * (0.7 + t * 0.5);
      const [cr, cg, cb] = f.c;
      const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      grd.addColorStop(0, `rgba(${cr},${cg},${cb},${Math.min(1, a)})`);
      grd.addColorStop(0.35, `rgba(${cr},${cg},${cb},${Math.min(1, a) * 0.45})`);
      grd.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = grd;
      ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2);
    }

    for (const p of this.glows) {
      const t = p.life / p.max;
      const fade = t < 0.1 ? t / 0.1 : 1 - t;
      const flick = 0.75 + 0.25 * Math.sin(p.phase * 2.3);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * fade * flick));
      const s = Math.max(0.5, p.size * (1 + p.grow * t));
      ctx.drawImage(sprite(p.colour), p.x - s / 2, p.y - s / 2, s, s);
    }

    ctx.lineCap = "round";
    for (const p of this.sparks) {
      const t = p.life / p.max;
      // White when thrown, their own colour as they fly.
      const bright = Math.max(0, 1 - t * 2.6);
      const r = p.c[0] + (250 - p.c[0]) * bright;
      const g = p.c[1] + (250 - p.c[1]) * bright;
      const b = p.c[2] + (255 - p.c[2]) * bright;
      ctx.globalAlpha = Math.max(0, 1 - t * t);
      ctx.strokeStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.lineWidth = p.w * (1 - t * 0.6);
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * p.trail, p.y - p.vy * p.trail);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    for (const g of this.rings) {
      const t = g.life / g.max;
      const e = 1 - Math.pow(1 - t, 3);
      const r = g.r0 + (g.r1 - g.r0) * e;
      ctx.globalAlpha = (1 - t) * (1 - t);
      ctx.strokeStyle = `rgb(${g.c[0]},${g.c[1]},${g.c[2]})`;
      ctx.lineWidth = g.w * (1 - t * 0.7);
      ctx.beginPath();
      ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
}
