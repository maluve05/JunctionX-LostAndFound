/*
  The FORGe cursor: a crystal shard, the same kind of fragment the 3D scene is
  made of, drawn as a real 3D solid on a small canvas.

  Its tip is exactly where the pointer is, so it points and clicks as precisely
  as the system arrow. Behind the tip it is alive: the body swings to trail
  the direction of travel (a sprung pendulum, so it overshoots a little and
  settles), turns on its own axis so its facets catch the light, stretches
  when thrown, and sheds sparks when it moves fast. Over anything pressable it
  grows, spins up and charges (two small shards orbit the tip) and a tag names
  what a click will do. Pressing squashes it and throws sparks.
*/

type V3 = [number, number, number];
export type CursorState = "idle" | "press" | "field";

const SIZE = 120;
const HALF = SIZE / 2;
/** Resting angle of the shard's body, from the tip, like a system arrow. */
const REST = (62 * Math.PI) / 180;
const LEN = 33;
const WAIST = 0.56;

// The solid: a tip, an uneven waist of five points (chipped, not cut like a
// gem), and a tail knocked off-centre.
const RADII = [7.4, 4.8, 6.8, 4.1, 6];
const ANGLES = [0.1, 1.42, 2.41, 3.86, 4.95];
const BASE: V3[] = [
  [0, 0, 0],
  ...RADII.map(
    (r, i) =>
      [Math.cos(ANGLES[i]) * r, LEN * (WAIST + (i % 2) * 0.06), Math.sin(ANGLES[i]) * r] as V3,
  ),
  [1.4, LEN, 0.9],
];
const FACES: [number, number, number][] = [];
for (let i = 0; i < 5; i++) {
  const a = 1 + i;
  const b = 1 + ((i + 1) % 5);
  FACES.push([0, a, b], [6, b, a]);
}

// Light from the upper left, in front; the viewer looks down -z.
const L = normalise([-0.45, -0.75, 0.62]);
const H = normalise([L[0], L[1], L[2] + 1]);

function normalise(v: V3): V3 {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

const DEEP: V3 = [34, 18, 118];
const IRIS: V3 = [90, 56, 255];
const LILAC: V3 = [206, 196, 255];
const LIME: V3 = [214, 255, 66];

const mix = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const wrap = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class ShardCursor {
  private ctx: CanvasRenderingContext2D | null;
  private dpr: number;

  private x = -200;
  private y = -200;
  private lx = -200;
  private ly = -200;
  private vx = 0;
  private vy = 0;
  private tagX = -200;
  private tagY = -200;

  private angle = REST;
  private spinV = 0;
  private roll = 0;
  private rollV = 1.2;
  private scale = 1;
  private scaleV = 0;
  private charge = 0;
  private alpha = 0;
  private press = 0;
  private time = 0;
  private shed = 0;

  private visible = false;
  private state: CursorState = "idle";
  private label = "";
  private down = false;

  private pts: V3[] = BASE.map(() => [0, 0, 0] as V3);

  constructor(
    private canvas: HTMLCanvasElement,
    private tag: HTMLElement,
  ) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * this.dpr;
    canvas.height = SIZE * this.dpr;
    this.ctx = canvas.getContext("2d");
  }

  move(x: number, y: number) {
    if (!this.visible) {
      this.lx = this.tagX = x;
      this.ly = this.tagY = y;
    }
    this.x = x;
    this.y = y;
    this.visible = true;
    // The tip follows the pointer in the same event, not a frame later.
    this.canvas.style.transform = `translate3d(${x - HALF}px, ${y - HALF}px, 0)`;
  }

  hide() {
    this.visible = false;
  }

  setState(state: CursorState, label: string) {
    this.state = state;
    // The old label stays in the tag while it fades out.
    if (label && label !== this.label) this.tag.textContent = label;
    this.label = label;
    if (label && state === "press") this.tag.dataset.on = "";
    else delete this.tag.dataset.on;
  }

  pressDown() {
    this.down = true;
    this.press = 1;
    this.rollV += 16;
    this.scaleV -= 9;
  }

  pressUp() {
    this.down = false;
    this.scaleV += 7;
  }

  frame(dtRaw: number) {
    const dt = Math.min(Math.max(dtRaw, 0.001), 1 / 20);
    this.time += dt;

    // Velocity, smoothed over a few frames.
    const ivx = (this.x - this.lx) / dt;
    const ivy = (this.y - this.ly) / dt;
    this.lx = this.x;
    this.ly = this.y;
    const kv = 1 - Math.exp(-dt * 18);
    this.vx += (ivx - this.vx) * kv;
    this.vy += (ivy - this.vy) * kv;
    const speed = Math.hypot(this.vx, this.vy);

    const field = this.state === "field";
    const hot = this.state === "press";
    this.alpha += ((this.visible && !field ? 1 : 0) - this.alpha) * (1 - Math.exp(-dt * 14));
    this.charge += ((hot ? 1 : 0) - this.charge) * (1 - Math.exp(-dt * 10));
    this.press *= Math.exp(-dt * 7);

    // The body trails the motion: rest direction plus the way it's being dragged.
    const bias = 700;
    let tx = Math.cos(REST) - this.vx / bias;
    let ty = Math.sin(REST) - this.vy / bias;
    if (speed < 30) {
      // Idle, it breathes.
      const idle = Math.sin(this.time * 1.7) * 0.07;
      tx = Math.cos(REST + idle);
      ty = Math.sin(REST + idle);
    }
    const target = Math.atan2(ty, tx);
    const diff = wrap(target - this.angle);
    this.spinV += (diff * 170 - this.spinV * 15) * dt;
    this.angle = wrap(this.angle + this.spinV * dt);

    // Turning on its own axis: faster when moving or charged.
    const rollTarget = 1.3 + Math.min(speed / 380, 7) + this.charge * 4.5;
    this.rollV += (rollTarget - this.rollV) * (1 - Math.exp(-dt * 3));
    this.roll += this.rollV * dt;

    // A springy scale: grows over controls, squashes on press.
    const sTarget = (1 + this.charge * 0.2) * (this.down ? 0.8 : 1);
    this.scaleV += ((sTarget - this.scale) * 260 - this.scaleV * 16) * dt;
    this.scale += this.scaleV * dt;

    // The tag trails the tip a little.
    const kt = 1 - Math.exp(-dt * 16);
    this.tagX += (this.x - this.tagX) * kt;
    this.tagY += (this.y - this.tagY) * kt;
    // `translate`, not `transform`: the tag pops in with `scale`, which must not scale its position.
    this.tag.style.translate = `${(this.tagX + 22).toFixed(1)}px ${(this.tagY + 24).toFixed(1)}px`;

    this.draw(speed);
  }

  private draw(speed: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.alpha < 0.01) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, HALF * this.dpr, HALF * this.dpr);
    ctx.globalAlpha = this.alpha;

    // Pose: roll about its own axis, lean toward the viewer, then point.
    const stretch = 1 + Math.min(speed / 2600, 0.32);
    const s = this.scale;
    const cr = Math.cos(this.roll);
    const sr = Math.sin(this.roll);
    const lean = 0.42 + Math.sin(this.time * 0.9) * 0.12;
    const cl = Math.cos(lean);
    const sl = Math.sin(lean);
    const turn = this.angle - Math.PI / 2;
    const ct = Math.cos(turn);
    const st = Math.sin(turn);
    for (let i = 0; i < BASE.length; i++) {
      const [bx, by, bz] = BASE[i];
      // Roll about y.
      const x1 = bx * cr + bz * sr;
      const z1 = -bx * sr + bz * cr;
      const y1 = by * stretch;
      // Lean about x (the tail comes toward the viewer).
      const y2 = y1 * cl - z1 * sl;
      const z2 = y1 * sl + z1 * cl;
      // Point: turn in the screen plane.
      this.pts[i][0] = (x1 * ct - y2 * st) * s;
      this.pts[i][1] = (x1 * st + y2 * ct) * s;
      this.pts[i][2] = z2 * s;
    }

    const P = this.pts;
    const faces: { f: [number, number, number]; z: number; shade: V3; edge: number }[] = [];
    const cx = (P[0][0] + P[6][0]) / 2;
    const cy = (P[0][1] + P[6][1]) / 2;
    const cz = (P[0][2] + P[6][2]) / 2;
    for (const f of FACES) {
      const a = P[f[0]];
      const b = P[f[1]];
      const c = P[f[2]];
      const ux = b[0] - a[0];
      const uy = b[1] - a[1];
      const uz = b[2] - a[2];
      const wx = c[0] - a[0];
      const wy = c[1] - a[1];
      const wz = c[2] - a[2];
      let n: V3 = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
      const mx = (a[0] + b[0] + c[0]) / 3;
      const my = (a[1] + b[1] + c[1]) / 3;
      const mz = (a[2] + b[2] + c[2]) / 3;
      // Outward normals, whatever the winding.
      if (n[0] * (mx - cx) + n[1] * (my - cy) + n[2] * (mz - cz) < 0) n = [-n[0], -n[1], -n[2]];
      n = normalise(n);
      if (n[2] <= 0) continue;
      const d = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      const sp = Math.pow(Math.max(0, n[0] * H[0] + n[1] * H[1] + n[2] * H[2]), 26);
      let col = d < 0.55 ? mix(DEEP, IRIS, d / 0.55) : mix(IRIS, LILAC, (d - 0.55) / 0.45);
      col = mix(col, LIME, this.charge * 0.35 * d);
      const glint = Math.min(1, sp * 1.4 + this.press * 0.7);
      col = mix(col, [255, 255, 255], glint);
      faces.push({ f, z: mz, shade: col, edge: d });
    }
    faces.sort((p, q) => p.z - q.z);

    // A dark rim first, so the shard reads on white buttons as well as the dark page.
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(11, 11, 15, 0.55)";
    ctx.lineWidth = 2.6;
    for (const { f } of faces) {
      this.tri(ctx, f);
      ctx.stroke();
    }

    if (this.charge > 0.02) {
      ctx.shadowColor = `rgba(196, 184, 255, ${0.85 * this.charge})`;
      ctx.shadowBlur = 16 * this.charge;
    }
    for (const { f, shade } of faces) {
      this.tri(ctx, f);
      ctx.fillStyle = `rgb(${shade[0] | 0}, ${shade[1] | 0}, ${shade[2] | 0})`;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Crisp facet edges.
    ctx.lineWidth = 0.7;
    for (const { f, edge } of faces) {
      this.tri(ctx, f);
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.18 + edge * 0.4).toFixed(2)})`;
      ctx.stroke();
    }

    // Charged: two small shards orbit the tip.
    if (this.charge > 0.02) {
      for (let k = 0; k < 2; k++) {
        const a = this.time * 5.2 + k * Math.PI;
        const r = 15 + Math.sin(this.time * 3 + k) * 2;
        const ox = Math.cos(a) * r;
        const oy = Math.sin(a) * r * 0.6;
        ctx.save();
        ctx.globalAlpha = this.alpha * this.charge;
        ctx.translate(ox, oy);
        ctx.rotate(a * 1.5);
        ctx.beginPath();
        ctx.moveTo(0, -3.4);
        ctx.lineTo(1.7, 1.5);
        ctx.lineTo(-1.5, 2);
        ctx.closePath();
        ctx.fillStyle = k ? "#d6ff42" : "#c4b8ff";
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  private tri(ctx: CanvasRenderingContext2D, f: [number, number, number]) {
    const P = this.pts;
    ctx.beginPath();
    ctx.moveTo(P[f[0]][0], P[f[0]][1]);
    ctx.lineTo(P[f[1]][0], P[f[1]][1]);
    ctx.lineTo(P[f[2]][0], P[f[2]][1]);
    ctx.closePath();
  }
}
