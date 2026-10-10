import * as THREE from "three";
import { IRIS, LILAC, LIME, MIST } from "./logo";
import type { FormationName } from "./names";
import { NOVAE_CELL, NOVAE_E } from "../eggArt";

export type { FormationName };

/*
  The story is told by 500 shards (a drawing budget, not a headcount: the site
  doesn't say how many builders come). Every chapter of a page names a
  formation (data-scene="…" on its section), and the scene morphs the shards
  from one formation to the next as the chapter scrolls in.

  Formations are laid out against the base camera (z = 18, looking at the
  origin) in terms of the visible half-width and half-height at z = 0, so the
  same formation reads on a phone held upright and on a wide monitor.
*/

export const N = 500;

export type Layout = {
  halfW: number;
  halfH: number;
  /** Portrait or narrow: the copy sits low, formations sit high. */
  mobile: boolean;
};

export type Vec3 = [number, number, number];
export type CamPose = { p: Vec3; t: Vec3 };

/**
 * How the shards travel into a formation, and what the camera does while
 * they do. Each chapter arrives its own way, so no two changes look alike.
 *
 *   warp    the shards race at the camera and the lens widens: a jump
 *   blast   they are blown outward from the middle, then gather again
 *   drop    they rain in from above while the camera looks down
 *   rise    they stream upward while the camera tilts to follow
 *   vortex  they swirl around the centre as the horizon rolls
 *   depth   they surface from far behind as the camera pulls back
 *   orbit   they sweep around the scene with the camera
 *   split   they tear apart to either side
 */
export type Transit = "warp" | "blast" | "drop" | "rise" | "vortex" | "depth" | "orbit" | "split";
/** Where the forge stands: the anvil face in world space, and the mark's height. */
export type ForgePlace = { x: number; y: number; h: number };

/** Values the scene updates every frame for the formations that react to input. */
export type Shared = { flowL: number; flowR: number };

export type Formation = {
  pos: Float32Array;
  rot: Float32Array;
  scl: Float32Array;
  col: Float32Array;
  heat: Float32Array;
  /** Live position for particle i at time t (seconds); returns a scale factor. */
  animate?: (i: number, t: number, out: Float32Array) => number;
  camera: CamPose;
  forge: ForgePlace | null;
  /** Particle pairs joined by a line while this formation holds. */
  lines?: Uint16Array;
  /** Glow strength; dense formations turn it down so their shape stays crisp. */
  glow?: number;
  /** How the shards travel into this formation. */
  transit: Transit;
  /**
   * Arriving from another page, shards land in this order (0 first, 1 last)
   * instead of all at once, so a drawing is traced rather than half there.
   */
  order?: Float32Array;
};

/* ── helpers ─────────────────────────────────────────────────────────── */

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roughly normal, mean 0, most values within ±1. */
const gauss = (r: () => number) => (r() + r() + r() - 1.5) / 1.5;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _r = new THREE.Quaternion();

/** Orientation that points a shard's blade (+y) along a direction, then rolls it. */
function orient(out: Float32Array, i: number, dx: number, dy: number, dz: number, roll: number) {
  _v.set(dx, dy, dz);
  if (_v.lengthSq() < 1e-8) _v.set(0, 1, 0);
  _v.normalize();
  _q.setFromUnitVectors(UP, _v);
  _r.setFromAxisAngle(_v, roll);
  _q.premultiply(_r);
  out[i * 4] = _q.x;
  out[i * 4 + 1] = _q.y;
  out[i * 4 + 2] = _q.z;
  out[i * 4 + 3] = _q.w;
}

/** The site's four signal colours (styles.css), for builders from everywhere. */
const CORAL = "#ff7a59";
const SKY = "#8ed1ff";
const PALETTE = [LILAC, LIME, SKY, CORAL, IRIS, MIST].map((hex) => new THREE.Color(hex));
/** Share of the shards in each colour, in PALETTE order. */
const SHARES = [0.3, 0.22, 0.2, 0.16, 0.07, 0.05];
const DIM = new THREE.Color("#262638");

/**
 * Each shard keeps one colour through the whole story, so the eye can follow a
 * builder from the forge to the demo. A crowd from everywhere: the four signal
 * colours, with a little of the mark's iris and some mist. `hexes` swaps the
 * colours (same order: lilac, lime, sky, coral, iris, mist) and keeps who
 * wears which, as the night shift theme does.
 */
export function identityColours(hexes?: readonly string[]): Float32Array {
  const palette = hexes ? hexes.map((h) => new THREE.Color(h)) : PALETTE;
  const r = rng(7);
  const out = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    let roll = r();
    let k = 0;
    while (k < SHARES.length - 1 && roll >= SHARES[k]) roll -= SHARES[k++];
    const c = palette[k] ?? PALETTE[k];
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  return out;
}

function blank(): Omit<Formation, "camera" | "forge" | "transit"> {
  return {
    pos: new Float32Array(N * 3),
    rot: new Float32Array(N * 4),
    scl: new Float32Array(N * 3),
    col: new Float32Array(N * 3),
    heat: new Float32Array(N),
  };
}

function setScale(f: { scl: Float32Array }, i: number, x: number, y = x, z = x) {
  f.scl[i * 3] = x;
  f.scl[i * 3 + 1] = y;
  f.scl[i * 3 + 2] = z;
}

function setColour(f: { col: Float32Array }, i: number, src: Float32Array, k = 1) {
  f.col[i * 3] = src[i * 3] * k;
  f.col[i * 3 + 1] = src[i * 3 + 1] * k;
  f.col[i * 3 + 2] = src[i * 3 + 2] * k;
}

function wobble(base: Float32Array, amp: number, speed: number, seed: number) {
  const r = rng(seed);
  const phase = Float32Array.from({ length: N }, () => r() * Math.PI * 2);
  return (i: number, t: number, out: Float32Array) => {
    const p = phase[i];
    const s = t * speed;
    out[0] = base[i * 3] + Math.sin(s * 0.9 + p) * amp;
    out[1] = base[i * 3 + 1] + Math.cos(s * 0.7 + p * 1.3) * amp;
    out[2] = base[i * 3 + 2] + Math.sin(s * 0.5 + p * 0.7) * amp * 1.8;
    return 1;
  };
}

/**
 * Where the forge stands for this layout. On a wide screen it rises to the
 * right of the headline, clear of it; upright, it takes the top of the screen
 * and the copy sits below.
 */
export function forgePlace(L: Layout): ForgePlace {
  return L.mobile
    ? { x: 0, y: L.halfH * 0.39, h: Math.min(L.halfH * 0.54, L.halfW * 1.55) }
    : { x: L.halfW * 0.56, y: L.halfH * 0.14, h: L.halfH };
}

/* ── glyphs for the year ─────────────────────────────────────────────── */

/** Points inside some text, and the spacing between them, both as a share of its width. */
export type Glyphs = { xy: Float32Array; step: number };

/**
 * Points on a regular lattice inside the glyphs of `text`, set in Geist Bold.
 * Returned centred, width 1, y up. Sampled once the font has loaded so the
 * numerals are the site's own.
 */
export async function sampleGlyphs(text: string, count: number): Promise<Glyphs> {
  try {
    await document.fonts.load('700 300px "Geist"');
  } catch {
    // Falls back to the system face; still legible.
  }
  const W = 1000;
  const H = 400;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { xy: new Float32Array(count * 2), step: 0.02 };
  ctx.fillStyle = "#fff";
  ctx.font = '700 320px "Geist", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2 + 12);
  const data = ctx.getImageData(0, 0, W, H).data;
  const filled = (x: number, y: number) => data[(y * W + x) * 4 + 3] > 140;

  let minX = W;
  let maxX = 0;
  let minY = H;
  let maxY = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (!filled(x, y)) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  // The widest lattice that still yields enough points gives the most even set.
  let pts: number[] = [];
  let step = 26;
  for (; step >= 4; step--) {
    pts = [];
    for (let y = minY + step / 2; y <= maxY; y += step) {
      const row = Math.round(y / step);
      // Offset every other row: a hexagonal lattice reads smoother than a square one.
      const shift = row % 2 ? step / 2 : 0;
      for (let x = minX + shift; x <= maxX; x += step) {
        if (filled(Math.round(x), Math.round(y))) pts.push(x, y);
      }
    }
    if (pts.length / 2 >= count) break;
  }

  const have = pts.length / 2;
  const width = maxX - minX || 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const out = new Float32Array(count * 2);
  for (let k = 0; k < count; k++) {
    const src = Math.min(have - 1, Math.floor((k * have) / count));
    out[k * 2] = (pts[src * 2] - cx) / width;
    out[k * 2 + 1] = -(pts[src * 2 + 1] - cy) / width;
  }
  return { xy: out, step: Math.max(step, 4) / width };
}

/* ── the handshake's outline ─────────────────────────────────────────── */

/**
 * The handshake from Phosphor Icons (MIT), thin weight, in its 256-unit box:
 * the same icon as the Partner button's scene (Glyphs.tsx). Drawn as a line,
 * it reads at the size of the whole hero; filled, 500 shards lose its fingers.
 */
export const HANDSHAKE =
  "M250.73,109.69l-25.53-51a12,12,0,0,0-16.1-5.37L182.88,66.38,129,52.14a3.92,3.92,0,0,0-2,0L73.12,66.38,46.9,53.27a12,12,0,0,0-16.1,5.37L5.27,109.69a12,12,0,0,0,5.37,16.1l27.29,13.65,55.75,39.82a3.87,3.87,0,0,0,1.35.62l64,16a4,4,0,0,0,3.8-1l55.54-55.54,27-13.5a12,12,0,0,0,5.37-16.1Zm-51,36.95-37.2-29.8a4,4,0,0,0-5.34.3c-19.49,19.64-41.34,17.11-55.29,8.2a4.07,4.07,0,0,1-1.85-3,3.91,3.91,0,0,1,1.11-3.21L145.62,76h35.91l29.6,59.21ZM12.21,116.32a4,4,0,0,1,.22-3L38,62.22h0A4,4,0,0,1,41.54,60a4,4,0,0,1,1.78.43l24,12L38.21,130.64l-24-12A4,4,0,0,1,12.21,116.32Zm146.56,71.25L97.71,172.3l-52.6-37.57L75.45,74,128,60.14,157.72,68H144a4,4,0,0,0-2.79,1.13l-45.7,44.33a12,12,0,0,0,2.06,18.62c19.88,12.71,44.13,10,62.66-6.81L194,152.33Zm85-71.25a4,4,0,0,1-2,2.32l-24,12L188.68,72.43l24-12A4,4,0,0,1,218,62.22l25.53,51.05A4,4,0,0,1,243.79,116.32ZM127.94,217a4,4,0,0,1-3.88,3,4.09,4.09,0,0,1-1-.12L81.38,209.45a4,4,0,0,1-1.36-.62L53.68,190a4,4,0,0,1,4.65-6.51l25.72,18.37,41,10.25A4,4,0,0,1,127.94,217Z";

/**
 * Points evenly spaced along a path, the way the line runs at each (unit
 * vectors), and the spacing between them. Centred, width 1, y up.
 */
export type Outline = { xy: Float32Array; dir: Float32Array; step: number };

export function sampleOutline(d: string, count: number): Outline {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  // Some browsers only measure a path that is in the document.
  svg.setAttribute("style", "position:absolute;width:0;height:0;visibility:hidden");
  document.body.appendChild(svg);
  const total = path.getTotalLength();
  const gap = total / count;
  const h = gap * 0.35;
  const raw = new Float32Array(count * 2);
  const dir = new Float32Array(count * 2);
  for (let k = 0; k < count; k++) {
    const s = (k + 0.5) * gap;
    const p = path.getPointAtLength(s);
    const a = path.getPointAtLength(Math.max(0, s - h));
    const b = path.getPointAtLength(Math.min(total, s + h));
    // Where one outline ends and the next begins, one side of the step
    // leaps across the gap: take the other side.
    const fwd = Math.hypot(b.x - p.x, b.y - p.y);
    const back = Math.hypot(p.x - a.x, p.y - a.y);
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    if (fwd > h * 3) {
      dx = p.x - a.x;
      dy = p.y - a.y;
    } else if (back > h * 3) {
      dx = b.x - p.x;
      dy = b.y - p.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    raw[k * 2] = p.x;
    raw[k * 2 + 1] = p.y;
    dir[k * 2] = dx / len;
    // y up, as in the scene.
    dir[k * 2 + 1] = -dy / len;
  }
  svg.remove();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let k = 0; k < count; k++) {
    minX = Math.min(minX, raw[k * 2]);
    maxX = Math.max(maxX, raw[k * 2]);
    minY = Math.min(minY, raw[k * 2 + 1]);
    maxY = Math.max(maxY, raw[k * 2 + 1]);
  }
  const width = maxX - minX || 1;
  const xy = new Float32Array(count * 2);
  for (let k = 0; k < count; k++) {
    xy[k * 2] = (raw[k * 2] - (minX + maxX) / 2) / width;
    xy[k * 2 + 1] = -(raw[k * 2 + 1] - (minY + maxY) / 2) / width;
  }
  return { xy, dir, step: gap / width };
}

/* ── the formations ─────────────────────────────────────────────────── */

type Ctx = {
  L: Layout;
  identity: Float32Array;
  glyphs: Glyphs;
  hands: Outline;
  shared: Shared;
};

/** The hero: sparks thrown up and out from the anvil face, drifting outward for ever. */
function forge({ L, identity }: Ctx): Formation {
  const f = blank();
  const r = rng(11);
  const place = forgePlace(L);
  const h = place.h;
  const dirs = new Float32Array(N * 3);
  const life = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const theta = gauss(r) * 1.25;
    const reach = h * (0.64 + Math.pow(r(), 1.5) * (L.mobile ? 1.05 : 1.3));
    const spreadX = L.mobile ? 0.62 : 1.18;
    const x = place.x + Math.sin(theta) * reach * spreadX;
    const y = place.y + Math.cos(theta) * reach * 0.92 - h * 0.06;
    const z = gauss(r) * 2.6 - 0.4;
    f.pos.set([x, y, z], i * 3);
    const dz = (r() - 0.5) * 0.5;
    dirs.set([Math.sin(theta), Math.cos(theta), dz], i * 3);
    orient(f.rot, i, Math.sin(theta), Math.cos(theta), dz, r() * Math.PI * 2);
    setScale(f, i, h * (0.018 + Math.pow(r(), 2.2) * 0.05));
    setColour(f, i, identity);
    f.heat[i] = 0.35 + r() * 0.6;
    life[i * 2] = r();
    life[i * 2 + 1] = 0.02 + r() * 0.05;
  }
  const span = h * 0.5;
  return {
    ...f,
    // Sparks keep leaving the forge: each drifts outward along its own line
    // and fades out at either end (fully, so its jump back to the start is
    // never seen), so the field never repeats and never stops.
    animate(i, t, out) {
      const u = (life[i * 2] + t * life[i * 2 + 1]) % 1;
      const d = (u - 0.5) * span;
      out[0] = f.pos[i * 3] + dirs[i * 3] * d;
      out[1] = f.pos[i * 3 + 1] + dirs[i * 3 + 1] * d;
      out[2] = f.pos[i * 3 + 2] + dirs[i * 3 + 2] * d;
      return Math.min(1, Math.sin(Math.PI * u) * 1.6);
    },
    camera: { p: [0, 0, 18], t: [0, 0, 0] },
    forge: place,
    transit: "warp",
  };
}

/** The year, "2026", set in the shards themselves (the text is sampled in StoryScene). */
function year({ L, identity, glyphs }: Ctx): Formation {
  const f = blank();
  const r = rng(23);
  const width = L.mobile ? L.halfW * 1.72 : L.halfW * 0.86;
  const cx = L.mobile ? 0 : L.halfW * 0.42;
  const cy = L.mobile ? L.halfH * 0.46 : L.halfH * 0.06;
  // Lattice spacing in world units, a touch over, so the shards just touch.
  const cell = width * glyphs.step * 1.06;
  for (let i = 0; i < N; i++) {
    const gx = glyphs.xy[i * 2];
    const gy = glyphs.xy[i * 2 + 1];
    f.pos.set([cx + gx * width + gauss(r) * cell * 0.08, cy + gy * width, gauss(r) * 0.22], i * 3);
    const tilt = gauss(r) * 0.35;
    orient(f.rot, i, Math.sin(tilt), Math.cos(tilt), gauss(r) * 0.2, r() * Math.PI * 2);
    setScale(f, i, cell * (1.45 + r() * 0.5));
    setColour(f, i, identity);
    f.heat[i] = 0.5 + r() * 0.35;
  }
  return {
    ...f,
    animate: wobble(f.pos, cell * 0.18, 1, 29),
    camera: L.mobile
      ? { p: [-0.3, 0.3, 17.6], t: [0, 0.1, 0] }
      : { p: [-1.1, 0.5, 17.2], t: [0.4, 0.1, 0] },
    forge: null,
    transit: "warp",
    glow: 0.45,
  };
}

/** Connect: a network, every builder a node, joined to their nearest neighbours. */
function connect({ L, identity }: Ctx): Formation {
  const f = blank();
  const r = rng(31);
  for (let i = 0; i < N; i++) {
    const x = L.mobile
      ? (r() * 2 - 1) * L.halfW * 1.15
      : lerp(-0.25, 1.15, Math.pow(r(), 0.8)) * L.halfW;
    const y = L.mobile ? lerp(-0.05, 1.05, r()) * L.halfH : (r() * 2 - 1) * L.halfH * 0.95;
    const z = lerp(-7, 2, r());
    f.pos.set([x, y, z], i * 3);
    orient(f.rot, i, gauss(r), gauss(r), gauss(r), r() * 6.28);
    setScale(f, i, (L.mobile ? 0.1 : 0.14) + r() * 0.12);
    setColour(f, i, identity);
    f.heat[i] = 0.4 + r() * 0.3;
  }
  // Two nearest neighbours each, within reach: a web, not a hairball.
  const pairs: number[] = [];
  const seen = new Set<number>();
  const reach = L.mobile ? 1.1 : 1.8;
  for (let i = 0; i < N && pairs.length < 1600; i++) {
    let best = -1;
    let second = -1;
    let bd = Infinity;
    let sd = Infinity;
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const dx = f.pos[i * 3] - f.pos[j * 3];
      const dy = f.pos[i * 3 + 1] - f.pos[j * 3 + 1];
      const dz = f.pos[i * 3 + 2] - f.pos[j * 3 + 2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) {
        second = best;
        sd = bd;
        best = j;
        bd = d;
      } else if (d < sd) {
        second = j;
        sd = d;
      }
    }
    for (const [j, d] of [
      [best, bd],
      [second, sd],
    ] as const) {
      if (j < 0 || d > reach * reach) continue;
      const key = Math.min(i, j) * N + Math.max(i, j);
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(i, j);
    }
  }
  return {
    ...f,
    animate: wobble(f.pos, 0.14, 0.6, 37),
    camera: L.mobile
      ? { p: [0.2, 0.9, 18.4], t: [0, 0.2, -2] }
      : { p: [0.6, 1.8, 18.6], t: [0.2, 0, -2] },
    forge: null,
    transit: "blast",
    lines: Uint16Array.from(pairs),
  };
}

/** Build: teams of five, each a crystal, a whole city of them going up. */
function build({ L, identity }: Ctx): Formation {
  const f = blank();
  const r = rng(41);
  const cols = L.mobile ? 5 : 10;
  const phase = new Float32Array(N);
  for (let c = 0; c < N / 5; c++) {
    const col = c % cols;
    const row = Math.floor(c / cols);
    const cxw = L.mobile
      ? lerp(-0.86, 0.86, col / (cols - 1)) * L.halfW
      : lerp(0.08, 1.12, col / (cols - 1)) * L.halfW;
    const czw = L.mobile ? 1.5 - row * 1.25 : 2 - row * 2.2;
    const ground = L.mobile ? L.halfH * 0.36 : -L.halfH * 0.42;
    const jx = gauss(r) * 0.25;
    const jz = gauss(r) * 0.3;
    const tall = (L.mobile ? 0.45 : 0.55) + r() * (L.mobile ? 0.5 : 0.65);
    const p = r() * 6.28;
    for (let k = 0; k < 5; k++) {
      const i = c * 5 + k;
      phase[i] = p;
      if (k === 0) {
        f.pos.set([cxw + jx, ground + tall / 2, czw + jz], i * 3);
        orient(f.rot, i, 0, 1, 0, r() * 6.28);
        setScale(f, i, tall * 0.62, tall, tall * 0.62);
      } else {
        const a = (k / 4) * Math.PI * 2 + p;
        const len = tall * (0.45 + r() * 0.2);
        const lean = 0.42;
        const dx = Math.cos(a) * Math.sin(lean);
        const dz = Math.sin(a) * Math.sin(lean);
        const dy = Math.cos(lean);
        f.pos.set(
          [
            cxw + jx + Math.cos(a) * 0.16 + dx * len * 0.5,
            ground + dy * len * 0.5,
            czw + jz + Math.sin(a) * 0.16 + dz * len * 0.5,
          ],
          i * 3,
        );
        orient(f.rot, i, dx, dy, dz, a);
        setScale(f, i, len * 0.6, len, len * 0.6);
      }
      setColour(f, i, identity);
      f.heat[i] = 0.55 + r() * 0.3;
    }
  }
  return {
    ...f,
    animate(i, t, out) {
      out[0] = f.pos[i * 3];
      out[1] = f.pos[i * 3 + 1] + Math.sin(t * 1.1 + phase[i]) * 0.05;
      out[2] = f.pos[i * 3 + 2];
      return 1 + Math.sin(t * 1.1 + phase[i]) * 0.04;
    },
    camera: L.mobile
      ? { p: [0, 3.2, 17], t: [0, 0.2, -5] }
      : { p: [0, 3.4, 16.8], t: [0, -0.6, -5] },
    forge: null,
    transit: "drop",
    glow: 0.3,
  };
}

/** Ship: everything launches, a column of streaks rising through the frame. */
function ship({ L, identity }: Ctx): Formation {
  const f = blank();
  const r = rng(53);
  const cx = L.mobile ? 0 : L.halfW * 0.46;
  const top = L.halfH * 1.35;
  // Upright, the launch rises out of the middle so the copy below stays clear.
  const bottom = L.mobile ? -L.halfH * 0.02 : -top;
  const speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const rad = Math.abs(gauss(r)) * (L.mobile ? 0.55 : 0.85) + 0.05;
    const a = r() * 6.28;
    f.pos.set(
      [cx + Math.cos(a) * rad * 1.5, lerp(bottom, top, r()), Math.sin(a) * rad * 1.5 - 0.5],
      i * 3,
    );
    const tilt = gauss(r) * 0.06;
    orient(f.rot, i, Math.sin(tilt), Math.cos(tilt), 0, r() * 6.28);
    const s = (L.mobile ? 0.1 : 0.15) + r() * 0.12;
    setScale(f, i, s * 0.7, s * 2.6, s * 0.7);
    // Hotter on the way out: lift towards lilac and white.
    f.col[i * 3] = lerp(identity[i * 3], 0.85, 0.35);
    f.col[i * 3 + 1] = lerp(identity[i * 3 + 1], 0.85, 0.35);
    f.col[i * 3 + 2] = lerp(identity[i * 3 + 2], 0.95, 0.35);
    f.heat[i] = 0.85 + r() * 0.15;
    speed[i] = 2.2 + r() * 3.4;
  }
  const range = top - bottom;
  return {
    ...f,
    animate(i, t, out) {
      let y = f.pos[i * 3 + 1] - bottom + t * speed[i];
      y = (y % range) + bottom;
      out[0] = f.pos[i * 3];
      out[1] = y;
      out[2] = f.pos[i * 3 + 2];
      const edge = Math.min(y - bottom, top - y) / (range * 0.12);
      return Math.min(1, Math.max(0, edge));
    },
    camera: L.mobile
      ? { p: [0, -0.7, 17.8], t: [0, 0.6, 0] }
      : { p: [0, -1.4, 17.6], t: [0, 1.2, 0] },
    forge: null,
    transit: "rise",
    glow: 0.6,
  };
}

/** A calm, deep field: the shards step back so faces and photographs lead. */
function field({ L, identity }: Ctx): Formation {
  const f = blank();
  const r = rng(61);
  for (let i = 0; i < N; i++) {
    f.pos.set(
      [(r() * 2 - 1) * L.halfW * 1.8, (r() * 2 - 1) * L.halfH * 1.6, lerp(-26, -7, r())],
      i * 3,
    );
    orient(f.rot, i, gauss(r), gauss(r), gauss(r), r() * 6.28);
    setScale(f, i, 0.14 + r() * 0.2);
    setColour(f, i, identity, 0.6);
    f.heat[i] = 0.25 + r() * 0.25;
  }
  return {
    ...f,
    animate(i, t, out) {
      const a = t * 0.025;
      const x = f.pos[i * 3];
      const z = f.pos[i * 3 + 2] + 16;
      out[0] = x * Math.cos(a) - z * Math.sin(a);
      out[1] = f.pos[i * 3 + 1] + Math.sin(t * 0.3 + i) * 0.1;
      out[2] = x * Math.sin(a) + z * Math.cos(a) - 16;
      return 1;
    },
    camera: { p: [0, 0, 18], t: [0, 0, -6] },
    forge: null,
    transit: "vortex",
  };
}

/**
 * 2025, told in its own numbers: 120 shards lit, in 30 teams of four. The
 * rest wait in the dark, room for the builders still to come.
 */
function record({ L, identity }: Ctx): Formation {
  const f = blank();
  const r = rng(71);
  const cols = L.mobile ? 5 : 6;
  const rows = 30 / cols;
  const cellX = L.mobile ? (1.64 * L.halfW) / (cols - 1) : (0.86 * L.halfW) / (cols - 1);
  for (let i = 0; i < N; i++) {
    if (i < 120) {
      const c = Math.floor(i / 4);
      const k = i % 4;
      const col = c % cols;
      const row = Math.floor(c / cols);
      const x = L.mobile
        ? lerp(-0.82, 0.82, col / (cols - 1)) * L.halfW
        : lerp(0.1, 0.88, col / (cols - 1)) * L.halfW;
      const y = L.mobile
        ? lerp(0.92, 0.14, row / (rows - 1)) * L.halfH
        : lerp(0.62, -0.62, row / (rows - 1)) * L.halfH;
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const d = cellX * (L.mobile ? 0.1 : 0.13);
      f.pos.set([x + Math.cos(a) * d, y + Math.sin(a) * d, gauss(r) * 0.3], i * 3);
      orient(f.rot, i, Math.cos(a), Math.sin(a), 0.2, r() * 0.6);
      setScale(f, i, cellX * (L.mobile ? 0.2 : 0.3));
      setColour(f, i, identity, 1.1);
      f.heat[i] = 0.9;
    } else {
      f.pos.set(
        [(r() * 2 - 1) * L.halfW * 1.9, (r() * 2 - 1) * L.halfH * 1.7, lerp(-34, -14, r())],
        i * 3,
      );
      orient(f.rot, i, gauss(r), gauss(r), gauss(r), r() * 6.28);
      setScale(f, i, 0.16 + r() * 0.1);
      f.col[i * 3] = DIM.r;
      f.col[i * 3 + 1] = DIM.g;
      f.col[i * 3 + 2] = DIM.b;
      f.heat[i] = 0.06;
    }
  }
  return {
    ...f,
    animate: wobble(f.pos, 0.05, 1.2, 73),
    camera: L.mobile
      ? { p: [0.3, 0.2, 17.6], t: [0.1, 0.1, 0] }
      : { p: [0.7, 0.3, 17.4], t: [0.3, 0, 0] },
    forge: null,
    transit: "depth",
    glow: 0.75,
  };
}

/**
 * Partners: a handshake, drawn in shards. Each lies along the line it sits on,
 * so the outline reads as a drawing in light, and a spark runs along it now
 * and then. Arriving from another page, the shards trace it in order.
 */
function handshake({ L, identity, hands }: Ctx): Formation {
  const f = blank();
  const r = rng(83);
  // As wide as the space beside the headline allows (clear of it and of the
  // chapter rail), and never too tall. Upright, it fits the band between the
  // header and the headline.
  const width = L.mobile
    ? Math.min(L.halfW * 1.2, L.halfH * 0.82)
    : Math.min(L.halfW * 0.8, L.halfH * 1.25);
  const cx = L.mobile ? 0 : L.halfW * 0.54;
  const cy = L.mobile ? L.halfH * 0.56 : L.halfH * 0.06;
  // Spacing along the line in world units: each shard reaches its neighbours.
  const cell = width * hands.step;
  const order = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    f.pos.set(
      [cx + hands.xy[i * 2] * width, cy + hands.xy[i * 2 + 1] * width, gauss(r) * 0.1],
      i * 3,
    );
    orient(f.rot, i, hands.dir[i * 2], hands.dir[i * 2 + 1], gauss(r) * 0.12, r() * Math.PI * 2);
    const k = 0.85 + r() * 0.3;
    setScale(f, i, cell * 0.7 * k, cell * 1.7 * k, cell * 0.7 * k);
    setColour(f, i, identity);
    f.heat[i] = 0.6 + r() * 0.25;
    // The points run along the outline in order: trace them that way.
    order[i] = i / (N - 1);
  }
  const drift = wobble(f.pos, cell * 0.12, 0.8, 87);
  return {
    ...f,
    animate(i, t, out) {
      drift(i, t, out);
      // A spark runs the length of the drawing about every six seconds. The
      // distance to it wraps around the outline, so it never jumps.
      const d = Math.abs(order[i] - ((t * 0.16) % 1));
      const near = Math.min(d, 1 - d);
      return 1 + 0.5 * Math.exp(-(near * near) / 0.0006);
    },
    camera: L.mobile
      ? { p: [-0.3, 0.3, 17.8], t: [0, 0.15, 0] }
      : { p: [-0.8, 0.4, 17.6], t: [0.35, 0.05, 0] },
    forge: null,
    transit: "orbit",
    glow: 0.6,
    order,
  };
}

/**
 * `count` points on an even lattice over the filled cells of a pixel grid,
 * centred, in rows (y up), with the row each point sits in and the spacing.
 */
function sampleCells(grid: string[], cellW: number, count: number) {
  const rows = grid.length;
  const width = grid[0].length * cellW;
  const filled = (x: number, y: number) => grid[Math.floor(y)]?.[Math.floor(x / cellW)] === "#";
  let pts: number[] = [];
  let step = 1;
  // The widest lattice that still yields enough points gives the most even set.
  for (; step > 0.05; step *= 0.97) {
    pts = [];
    const dy = step * 0.866;
    for (let y = dy / 2, k = 0; y < rows; y += dy, k++) {
      // Offset every other row: a hexagonal lattice reads smoother than a square one.
      for (let x = step / 2 + (k % 2 ? step / 2 : 0); x < width; x += step) {
        if (filled(x, y)) pts.push(x, y);
      }
    }
    if (pts.length / 2 >= count) break;
  }
  const have = pts.length / 2;
  const xy = new Float32Array(count * 2);
  const row = new Uint8Array(count);
  for (let k = 0; k < count; k++) {
    const src = Math.min(have - 1, Math.floor((k * have) / count));
    xy[k * 2] = pts[src * 2] - width / 2;
    xy[k * 2 + 1] = rows / 2 - pts[src * 2 + 1];
    row[k] = Math.floor(pts[src * 2 + 1]);
  }
  return { xy, row, step };
}

/** NOVAe: the shards settle into its e, and the cursor line under it blinks. */
function novae({ L, identity }: Ctx): Formation {
  const f = blank();
  const r = rng(89);
  const { xy, row, step } = sampleCells(NOVAE_E, NOVAE_CELL, N);
  const unit = (L.mobile ? L.halfH * 0.7 : L.halfH * 1.16) / NOVAE_E.length;
  const cx = L.mobile ? 0 : L.halfW * 0.5;
  const cy = L.mobile ? L.halfH * 0.56 : L.halfH * 0.07;
  // Lattice spacing in world units, so the shards just touch.
  const cell = step * unit;
  const cursor = new Uint8Array(N);
  const lime = new THREE.Color(LIME);
  for (let i = 0; i < N; i++) {
    f.pos.set(
      [cx + xy[i * 2] * unit + gauss(r) * cell * 0.08, cy + xy[i * 2 + 1] * unit, gauss(r) * 0.3],
      i * 3,
    );
    const tilt = gauss(r) * 0.35;
    orient(f.rot, i, Math.sin(tilt), Math.cos(tilt), gauss(r) * 0.2, r() * Math.PI * 2);
    setScale(f, i, cell * (1.45 + r() * 0.5));
    if (row[i] === NOVAE_E.length - 1) {
      // The cursor line is lime, like the e in the headline.
      cursor[i] = 1;
      f.col.set([lime.r, lime.g, lime.b], i * 3);
      f.heat[i] = 0.9;
    } else {
      setColour(f, i, identity);
      f.heat[i] = 0.5 + r() * 0.35;
    }
  }
  const drift = wobble(f.pos, cell * 0.16, 1, 91);
  return {
    ...f,
    animate(i, t, out) {
      drift(i, t, out);
      if (!cursor[i]) return 1;
      // A soft blink, on and off about every 1.4 seconds.
      const on = Math.min(1, Math.max(0, Math.sin((t * Math.PI) / 0.7) * 1.6 + 0.5));
      return 0.3 + 0.7 * on;
    },
    camera: L.mobile
      ? { p: [-0.3, 0.3, 17.8], t: [0, 0.15, 0] }
      : { p: [-0.9, 0.5, 17.6], t: [0.3, 0.05, 0] },
    forge: null,
    transit: "orbit",
    glow: 0.45,
  };
}

/** The fork: two streams, one to each door. */
function fork({ L, identity, shared }: Ctx): Formation {
  const f = blank();
  const r = rng(97);
  const H = L.halfH;
  const W = L.halfW;
  const P0: Vec3 = [0, -H * 1.35, -1];
  const params = new Float32Array(N * 4);
  // Control and end points per side, built once: `curve` runs per shard per frame.
  const ends = [-1, 1].map((side) => ({
    P1: (L.mobile ? [side * W * 0.95, -H * 0.05, 0] : [side * W * 0.12, -H * 0.15, 0]) as Vec3,
    P2: (L.mobile ? [side * W * 0.62, H * 1.35, -1.5] : [side * W * 1.25, H * 1.3, -2]) as Vec3,
  }));
  const curve = (side: number, s: number, out: number[]) => {
    const { P1, P2 } = ends[side < 0 ? 0 : 1];
    const a = (1 - s) * (1 - s);
    const b = 2 * (1 - s) * s;
    const c = s * s;
    out[0] = a * P0[0] + b * P1[0] + c * P2[0];
    out[1] = a * P0[1] + b * P1[1] + c * P2[1];
    out[2] = a * P0[2] + b * P1[2] + c * P2[2];
    out[3] = 2 * (1 - s) * (P1[0] - P0[0]) + 2 * s * (P2[0] - P1[0]);
    out[4] = 2 * (1 - s) * (P1[1] - P0[1]) + 2 * s * (P2[1] - P1[1]);
  };
  const tmp = [0, 0, 0, 0, 0];
  const spread = L.mobile ? 0.22 : 0.4;
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1;
    const s0 = r();
    params.set([side, s0, gauss(r) * spread, gauss(r) * 0.7], i * 4);
    curve(side, s0, tmp);
    const len = Math.hypot(tmp[3], tmp[4]) || 1;
    const nx = -tmp[4] / len;
    const ny = tmp[3] / len;
    f.pos.set(
      [
        tmp[0] + nx * params[i * 4 + 2],
        tmp[1] + ny * params[i * 4 + 2],
        tmp[2] + params[i * 4 + 3],
      ],
      i * 3,
    );
    orient(f.rot, i, tmp[3], tmp[4], 0, r() * 6.28);
    setScale(f, i, (L.mobile ? 0.1 : 0.15) + r() * 0.12);
    setColour(f, i, identity);
    f.heat[i] = 0.7 + r() * 0.3;
  }
  return {
    ...f,
    animate(i, t, out) {
      void t;
      const side = params[i * 4];
      const flow = side < 0 ? shared.flowL : shared.flowR;
      const s = (params[i * 4 + 1] + flow * 0.05) % 1;
      curve(side, s, tmp);
      const len = Math.hypot(tmp[3], tmp[4]) || 1;
      const off = params[i * 4 + 2];
      out[0] = tmp[0] + (-tmp[4] / len) * off;
      out[1] = tmp[1] + (tmp[3] / len) * off;
      out[2] = tmp[2] + params[i * 4 + 3];
      return Math.min(1, Math.sin(Math.PI * s) * 1.6);
    },
    camera: L.mobile
      ? { p: [0, -0.2, 18.4], t: [0, 0, 0] }
      : { p: [0, -0.5, 18.4], t: [0, -0.2, 0] },
    forge: null,
    transit: "split",
  };
}

const BUILDERS: Record<FormationName, (ctx: Ctx) => Formation> = {
  forge,
  year,
  connect,
  build,
  ship,
  field,
  record,
  handshake,
  novae,
  fork,
};

export function buildFormation(name: FormationName, ctx: Ctx): Formation {
  return BUILDERS[name](ctx);
}
