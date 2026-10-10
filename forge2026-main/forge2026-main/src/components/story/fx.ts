import { gsap } from "gsap";
import { PALETTE, Particles, nightSparks } from "./particles";
import { perf } from "./perf";

/*
  The FX layer: one transparent canvas over the whole page (and over the
  loading intro). A press on open space sends a ring out from it, and a
  strike of the anvil throws a fountain of sparks with a shockwave. Cold
  sparks in the brand's colours: no fire.

  It sleeps when nothing is in the air: GSAP's ticker only calls it while
  particles are alive, and the canvas is cleared once when the last one dies.
  Nothing here runs for reduced motion.
*/

class Fx {
  readonly p = new Particles();
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private dpr = 1;
  private running = false;
  private coarse = false;
  /** The soft light behind a blow or a ripple. */
  private glowHex = "#c4b8ff";
  reduced = false;

  /** The night shift's colours, or the day's. */
  setNight(on: boolean) {
    nightSparks(on);
    this.glowHex = on ? "#3cefff" : "#c4b8ff";
  }

  mount(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.coarse = window.matchMedia("(pointer: coarse)").matches;
    perf.init();
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  unmount() {
    window.removeEventListener("resize", this.resize);
    gsap.ticker.remove(this.tick);
    this.running = false;
    this.p.clear();
    this.canvas = null;
    this.ctx = null;
  }

  private resize = () => {
    const c = this.canvas;
    if (!c) return;
    // Sparks are thin and fast; phones get fewer pixels to fill.
    this.dpr = Math.min(
      window.devicePixelRatio || 1,
      perf.tier === "low" ? 1 : this.coarse ? 1.5 : 2,
    );
    c.width = Math.round(window.innerWidth * this.dpr);
    c.height = Math.round(window.innerHeight * this.dpr);
  };

  private wake() {
    if (this.running || !this.ctx) return;
    this.running = true;
    gsap.ticker.add(this.tick);
  }

  private tick = (_time: number, deltaMs: number) => {
    this.frame(Math.min(deltaMs / 1000, 1 / 20));
  };

  /** One frame. Public so the dev tools can step it in a background tab. */
  frame(dt: number) {
    const ctx = this.ctx;
    const c = this.canvas;
    if (!ctx || !c) return;
    this.p.step(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.p.draw(ctx);
    if (this.p.count === 0 && this.running) {
      gsap.ticker.remove(this.tick);
      this.running = false;
    }
  }

  /** Scale particle counts to what the device can take (perf.ts). */
  private n(count: number) {
    return Math.max(1, Math.round(count * perf.q.fx));
  }

  /** A press on open space: a ring spreads from the point touched. No sparks. */
  ripple(x: number, y: number) {
    if (this.reduced || !this.ctx) return;
    this.p.ring(x, y, 4, 46, 0.55, 1.6, PALETTE.lilac);
    this.p.glow(x, y, 44, this.glowHex, 0.35, 0.5);
    this.wake();
  }

  /**
   * The anvil is struck at (x, y). `size` is the forge's height on screen in
   * pixels; `power` grows as strikes land in quick succession. White, lilac
   * and lime sparks, the mark's shards and a shockwave: no fire, no heat.
   */
  strike(x: number, y: number, size: number, power = 1, opts: { flash?: boolean } = {}) {
    if (this.reduced || !this.ctx) return;
    const k = Math.max(0.55, Math.min(1.6, size / 320));
    const pw = Math.min(power, 3);
    const big = Math.max(window.innerWidth, window.innerHeight);

    // The light of the blow: a short, cool flash around the face.
    if (opts.flash !== false) this.p.flash(x, y, 300 * k * (1 + pw * 0.2), 0.5 + pw * 0.06, 0.26);
    this.p.glow(x, y, 240 * k, this.glowHex, 0.4, 0.55);

    // A fountain up and out, and a low spray skimming sideways.
    const cold = [PALETTE.white, PALETTE.lilac, PALETTE.lime, PALETTE.lilac, PALETTE.iris];
    this.p.spray(x, y, {
      n: this.n(110 + pw * 50),
      speed: [420 * k, (1500 + pw * 300) * k],
      angle: -Math.PI / 2,
      spread: Math.PI * 1.15,
      life: [0.5, 1.3],
      width: [1.2, 3],
      grav: 1500,
      drag: 1.2,
      trail: 0.03,
      colours: cold,
    });
    for (const side of [0, Math.PI]) {
      this.p.spray(x, y, {
        n: this.n(24 + pw * 10),
        speed: [600 * k, 1600 * k],
        angle: side - (side ? -0.12 : 0.12),
        spread: 0.45,
        life: [0.35, 0.8],
        width: [1, 2.2],
        grav: 900,
        drag: 1.8,
        trail: 0.028,
        colours: cold,
      });
    }

    // The mark's own language: crystal shards knocked loose.
    this.p.shards(x, y, this.n(12 + pw * 5), [380 * k, 1100 * k], undefined, [4 * k, 10 * k]);

    // Shockwaves racing out along the ground.
    this.p.ring(x, y, 12, 240 * k * (1 + pw * 0.3), 0.55, 5, PALETTE.white);
    this.p.ring(x, y, 20, 520 * k * (1 + pw * 0.3), 0.95, 3, PALETTE.lilac);
    if (pw >= 2) this.p.ring(x, y, 30, big * 0.9, 1.25, 2, PALETTE.lime);
    this.wake();
  }
}

export const fx = new Fx();
