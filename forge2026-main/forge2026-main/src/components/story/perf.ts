/*
  How much this device can take.

  Phones get a lighter show than laptops, and budget Android phones the
  lightest: fewer pixels in the 3D scene, less glow, calmer camera moves, no
  frosted glass, fewer sparks, and a frame rate that drops while nothing is
  moving. Nothing is taken out of the story; it just costs less to tell.

  The first guess comes from the device (touch screen, cores, memory, data
  saver, the graphics chip). A governor in the stage then watches real frame
  times and steps quality down if the phone still struggles.
*/

export type Tier = "high" | "mid" | "low";

export type Quality = {
  tier: Tier;
  /** Render resolution of the 3D scene, as a device pixel ratio. */
  dpr: number;
  /** Multisampled edges: only where pixels are cheap. */
  aa: boolean;
  /** Glow sprites: 2 on every shard, 1 on hot shards only, 0 none. */
  glow: 0 | 1 | 2;
  /** How far camera moves, lens kicks and shakes go (1 = full). */
  motion: number;
  /** Frames per second for the scene while nothing is moving. */
  idleFps: number;
  /** Particle counts in the FX layer (1 = full). */
  fx: number;
};

type Nav = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
};

function qualityFor(tier: Tier, deviceDpr: number): Quality {
  switch (tier) {
    case "high":
      // Calm on purpose: the scene sits behind the words, not in front.
      return {
        tier,
        dpr: Math.min(deviceDpr, 1.75),
        aa: true,
        glow: 1,
        motion: 0.6,
        idleFps: 60,
        fx: 1,
      };
    case "mid":
      return {
        tier,
        dpr: Math.min(deviceDpr, 1.35),
        aa: true,
        glow: 1,
        motion: 0.55,
        idleFps: 30,
        fx: 0.6,
      };
    case "low":
      return { tier, dpr: 1, aa: false, glow: 0, motion: 0.4, idleFps: 24, fx: 0.35 };
  }
}

/** Graphics chips that struggle with a full-screen 3D scene. */
const WEAK_GPU =
  /Mali-(T\d|G(3|5|6[0-8]|7[0-2])\d?\b)|Adreno \(TM\) ([2-5]\d\d|6[0-2]\d)|PowerVR|Vivante|VideoCore/i;

class Perf {
  tier: Tier = "high";
  coarse = false;
  q: Quality = qualityFor("high", 1);
  private deviceDpr = 1;
  private listeners = new Set<(q: Quality) => void>();
  private started = false;

  init() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    const nav = navigator as Nav;
    this.coarse = window.matchMedia("(pointer: coarse)").matches;
    this.deviceDpr = window.devicePixelRatio || 1;
    const cores = nav.hardwareConcurrency || 4;
    // Only Chrome reports memory; elsewhere assume a capable device.
    const memory = nav.deviceMemory ?? 8;
    const android = /Android/i.test(nav.userAgent);
    const saveData = !!nav.connection?.saveData;
    const slowNet = /(^|-)2g$/.test(nav.connection?.effectiveType ?? "");
    const small = Math.min(window.screen.width, window.screen.height) < 600;

    let tier: Tier = "high";
    if (this.coarse || small) tier = "mid";
    if (saveData || slowNet || memory <= 2 || (android && (cores <= 4 || memory <= 4)))
      tier = "low";
    this.set(tier);
  }

  /** A second opinion from the graphics chip, once the scene has a context. */
  gpu(renderer: string) {
    if (this.tier !== "low" && this.coarse && WEAK_GPU.test(renderer)) this.set("low");
  }

  /** One step down, when the governor sees the device struggling. Returns false at the floor. */
  degrade() {
    if (this.tier === "low") return false;
    this.set(this.tier === "high" ? "mid" : "low");
    return true;
  }

  onChange(fn: (q: Quality) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(tier: Tier) {
    this.tier = tier;
    this.q = qualityFor(tier, this.deviceDpr);
    document.documentElement.dataset.tier = tier;
    this.listeners.forEach((fn) => fn(this.q));
  }
}

export const perf = new Perf();
