import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { fx } from "./fx";
import { interactions } from "./interact";
import { perf } from "./perf";
import type { StoryScene } from "./scene/StoryScene";
import type { FormationName } from "./scene/names";

/*
  The stage: one owner for everything that moves.

  - Lenis smooths wheel scrolling (touch keeps native momentum).
  - GSAP's ticker is the only animation loop. It drives Lenis, ScrollTrigger
    and the WebGL scene in the same frame, so nothing competes for time.
  - The 3D scene is imported lazily after first paint; the page is complete and
    readable without it, and without JavaScript at all.

  Pages talk to the stage through `useStoryPage`: they declare their formation
  sequence (data-scene) and their chapters (data-chapter), and the stage keeps
  the scene and the progress UI in step with the scroll.

  Reduced motion: no smoothing, no scene, no reveals. Chapters still track so
  the progress UI works.
*/

export type Chapter = { id: string; label: string };
type Snapshot = { chapters: Chapter[]; active: number };

const EMPTY: Snapshot = { chapters: [], active: 0 };

function webgl2Available() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

class Stage {
  reduced = false;
  lenis: Lenis | null = null;
  private scene: StoryScene | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private started = false;
  private loading = false;
  private sequence: FormationName[] = ["forge"];
  private target = 0;
  private introWanted = false;
  private snap: Snapshot = EMPTY;
  private listeners = new Set<() => void>();
  private progressListeners = new Set<(i: number, p: number) => void>();
  private resizeTimer = 0;
  /** Frame pacing: time gathered since the scene last drew, and the last sign of life. */
  private pending = 0;
  private lastActive = 0;
  private covers = new Set<string>();
  /** Governor: slow frames in a row while everything should be running at full rate. */
  private slow = 0;
  private combo = 0;
  private lastStrike = -10;
  private introHeld = false;
  private pages = 0;
  private popped = false;
  /**
   * Has a page said what its story is, and has the scene been shown? Until a
   * page declares its formations the scene isn't drawn: a scene that loaded
   * first used to show the home page's forge and then morph into the page's
   * own formation, which looked half built.
   */
  private declared = false;
  private shown = false;

  /* ── lifecycle ───────────────────────────────────────────────────── */

  start(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    if (this.started) return;
    this.started = true;

    gsap.registerPlugin(ScrollTrigger, SplitText);
    ScrollTrigger.config({ ignoreMobileResize: true });
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Back and Forward keep their place; every other page change starts at the top.
    window.addEventListener("popstate", () => (this.popped = true));
    perf.init();
    interactions.start();
    if (this.reduced) return;

    this.lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // A finger already has momentum; smoothing it feels like lag.
      syncTouch: false,
      // Sideways gestures over a row that scrolls sideways (the crew) go to
      // that row, not to the page.
      allowNestedScroll: true,
      autoRaf: false,
    });
    this.lenis.on("scroll", ScrollTrigger.update);
    // Signs of life: the scene draws every frame for a moment after any of these.
    const wake = () => (this.lastActive = performance.now());
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("pointerdown", wake, { passive: true });
    window.addEventListener("touchmove", wake, { passive: true });
    gsap.ticker.add(this.tick);
    gsap.ticker.lagSmoothing(0);

    window.addEventListener("resize", this.onResize);

    const load = () => void this.loadScene();
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: object) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(load, { timeout: 700 });
    else window.setTimeout(load, 120);

    if (import.meta.env.DEV) this.exposeDevTools();
  }

  /**
   * Development only (compiled out of production): hooks for inspecting the
   * story from the console, including in a background tab where the browser
   * stops sending animation frames. `advance(seconds)` steps the scroll
   * triggers and the scene by hand.
   */
  private exposeDevTools() {
    let clock = 1000;
    (window as unknown as Record<string, unknown>).__forgeStage = this;
    (window as unknown as Record<string, unknown>).__forgeDev = {
      gsap,
      ScrollTrigger,
      stage: this,
      fx,
      interactions,
      perf,
      advance: (seconds = 1, fps = 60) => {
        const dt = 1 / fps;
        ScrollTrigger.update();
        for (let i = 0; i < Math.round(seconds * fps); i++) {
          clock += dt;
          this.scene?.frame(clock, dt, this.target);
          fx.frame(dt);
          interactions.step(dt);
        }
        return this.scene?.debug();
      },
      intro: () => this.scene?.playIntro(),
      /** Jump to a scroll position and let everything settle there, frames and all. */
      go: (y: number, seconds = 2.5) => {
        const dev = (window as unknown as { __forgeDev: { advance: (s: number) => unknown } })
          .__forgeDev;
        if (this.lenis) this.lenis.scrollTo(y, { immediate: true, force: true });
        else window.scrollTo(0, y);
        ScrollTrigger.update();
        const tl = gsap.globalTimeline;
        for (let k = 0; k < 3; k++) {
          dev.advance(seconds / 3);
          tl.totalTime(tl.totalTime() + seconds);
        }
        document.getAnimations().forEach((a) => {
          try {
            if (a.effect?.getTiming().iterations !== Infinity) a.finish();
          } catch {
            // Animations that cannot finish are left running.
          }
        });
        return { y: Math.round(window.scrollY), ...this.scene?.debug() };
      },
    };
  }

  private tick = (time: number, deltaMs: number) => {
    this.lenis?.raf(time * 1000);
    const scene = this.scene;
    if (!scene || !this.shown || document.hidden) return;
    // Nothing to draw while something covers the whole screen (the intro, a story).
    if (this.covers.size) {
      this.pending = 0;
      return;
    }
    this.pending += deltaMs / 1000;
    // Idle phones draw at a lower rate; anything moving gets every frame.
    const active = scene.busy() || performance.now() - this.lastActive < 800;
    if (!active && this.pending < 1 / perf.q.idleFps - 0.004) return;
    // Lenis measures pixels per frame; per second reads the same at any refresh rate.
    scene.setVelocity((this.lenis?.velocity ?? 0) / Math.max(deltaMs / 1000, 1 / 240));
    scene.frame(time, this.pending, this.target);
    this.pending = 0;
    if (active) this.govern(deltaMs);
  };

  /**
   * If frames keep arriving late while the scene should be running at full
   * rate, step quality down (perf.ts). Two seconds of it, not one hiccup.
   */
  private govern(deltaMs: number) {
    if (perf.tier === "high" && !perf.coarse) return;
    this.slow = deltaMs > 30 ? this.slow + 1 : Math.max(0, this.slow - 2);
    if (this.slow > 60) {
      this.slow = 0;
      perf.degrade();
    }
  }

  /** Something covers the whole screen, so the scene can stop drawing (the intro, stories). */
  cover(reason: string, on: boolean) {
    if (on) this.covers.add(reason);
    else this.covers.delete(reason);
  }

  /** Build every formation of this page while nothing is happening. */
  private warm() {
    const scene = this.scene;
    if (!scene) return;
    const queue = [...new Set(this.sequence)];
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: object) => number };
    const next = () => {
      const name = queue.shift();
      if (!name || this.scene !== scene) return;
      scene.build(name);
      if (queue.length) {
        if (w.requestIdleCallback) w.requestIdleCallback(next, { timeout: 1200 });
        else window.setTimeout(next, 60);
      }
    };
    next();
  }

  private async loadScene() {
    if (!this.canvas || this.scene || this.loading) return;
    if (!webgl2Available()) return;
    this.loading = true;
    try {
      const { createStoryScene } = await import("./scene/StoryScene");
      const scene = await createStoryScene(this.canvas, perf.q);
      perf.gpu(scene.gpu);
      scene.setQuality(perf.q);
      perf.onChange((q) => this.scene?.setQuality(q));
      scene.setSequence(this.sequence);
      scene.onImpact(this.impact);
      // A theme chosen before the scene arrived (the night shift).
      if (this.palette) scene.setPalette(this.palette);
      if (this.beat) scene.setBeat(this.beat);
      this.scene = scene;
      this.maybeIntro();
      this.warm();
      this.reveal();
    } catch (err) {
      console.warn("[FORGe] The 3D scene could not start; the page works without it.", err);
    } finally {
      this.loading = false;
    }
  }

  /** The mouse, in client pixels; the scene leans toward it and its shards give way. */
  pointer(x: number, y: number, active: boolean) {
    this.scene?.setPointer(
      (x / window.innerWidth) * 2 - 1,
      (y / window.innerHeight) * 2 - 1,
      active,
    );
  }

  /** A click or tap at a point: the shards around it are thrown clear. */
  burst(x: number, y: number, power = 1) {
    this.scene?.burst((x / window.innerWidth) * 2 - 1, (y / window.innerHeight) * 2 - 1, power);
  }

  private onResize = () => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.scene?.resize(), 160);
  };

  /* ── the page's story ───────────────────────────────────────────── */

  /**
   * A page has just mounted. Moving to a new page (a link, not Back or
   * Forward, and not to a #section) starts it at the top, instead of at
   * wherever the last page was scrolled to. The first page of a visit is
   * left to the browser.
   */
  enterPage() {
    const first = this.pages++ === 0;
    const popped = this.popped;
    this.popped = false;
    if (first || popped || window.location.hash) return;
    this.lenis?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
  }

  setSequence(seq: FormationName[]) {
    this.declared = true;
    this.sequence = seq.length ? seq : ["forge"];
    this.target = 0;
    this.scene?.setSequence(this.sequence);
    this.warm();
    this.reveal();
  }

  /** Show the scene once it has loaded and the page has declared its story, whichever comes last. */
  private reveal() {
    const scene = this.scene;
    if (!scene || !this.declared || this.shown) return;
    this.shown = true;
    // One frame now, so textures and buffers are on the GPU before the canvas fades in.
    scene.frame(0, 1 / 60, this.target);
    document.documentElement.dataset.stage = "live";
  }

  setTarget(t: number) {
    this.target = t;
  }

  /** The home page asks for the opening; it plays only on a fresh load at the top. */
  wantIntro() {
    if (this.scene) return;
    this.introWanted = true;
    this.maybeIntro();
  }

  /**
   * The loading intro holds the scene's opening until it opens onto the
   * page, so the two strikes land one after the other rather than at once.
   */
  holdIntro(held: boolean) {
    this.introHeld = held;
    this.maybeIntro();
  }

  private maybeIntro() {
    if (!this.scene || !this.introWanted || this.introHeld) return;
    this.introWanted = false;
    if (window.scrollY < 40) this.scene.playIntro();
  }

  /**
   * Strike the anvil. Blows in quick succession land harder (and the metal
   * heats up). Returns how many in a row this makes. Without the 3D scene
   * (no WebGL), the sparks still fly from `at`.
   */
  strike(at?: { x: number; y: number }) {
    const now = performance.now() / 1000;
    this.combo = now - this.lastStrike < 1.25 ? this.combo + 1 : 1;
    this.lastStrike = now;
    // Every swing counts (the hero's doodles are forged by them), even one the
    // next swing cuts short before it lands.
    window.dispatchEvent(new CustomEvent("forge:strike", { detail: { combo: this.combo } }));
    const power = 1 + Math.min(this.combo - 1, 6) * 0.3;
    if (this.scene) this.scene.strike(power);
    else if (at) this.impact(at.x, at.y, 280, power);
    return this.combo;
  }

  /** The hammer meets the anvil at (x, y) on screen. */
  private impact = (x: number, y: number, size: number, power: number) => {
    // The opening's own blow (nobody clicked) skips the white flash: the
    // loading intro has only just flashed.
    const clicked = performance.now() / 1000 - this.lastStrike < 1.5;
    fx.strike(x, y, size, power, { flash: clicked });
    window.dispatchEvent(
      new CustomEvent("forge:impact", { detail: { x, y, power, combo: this.combo } }),
    );
    // A knock in the hand, where phones can.
    if (window.matchMedia("(pointer: coarse)").matches && "vibrate" in navigator) {
      try {
        navigator.vibrate(power > 1.5 ? [22, 40, 30] : 26);
      } catch {
        // Vibration is a nicety; some browsers refuse it.
      }
    }
  };

  spin(dx: number) {
    this.scene?.spin(dx);
  }

  release() {
    this.scene?.release();
  }

  private palette: readonly string[] | null = null;
  private beat = 0;

  /** Recolour the shards (see StoryScene.setPalette), or back with null. */
  setPalette(hexes: readonly string[] | null) {
    this.palette = hexes;
    this.scene?.setPalette(hexes);
  }

  /** Shards pulse on a beat at this tempo, or stop at 0. */
  setBeat(bpm: number) {
    this.beat = bpm;
    this.scene?.setBeat(bpm);
  }

  /** Turn the forge once round. */
  twirl() {
    this.scene?.twirl();
  }

  setBias(b: number) {
    this.scene?.setBias(b);
  }

  get live() {
    return !!this.scene;
  }

  scrollTo(target: string | HTMLElement | number) {
    if (this.lenis) {
      this.lenis.scrollTo(target, { duration: 1.5 });
      return;
    }
    if (typeof target === "number") window.scrollTo({ top: target });
    else {
      const el = typeof target === "string" ? document.querySelector(target) : target;
      el?.scrollIntoView();
    }
  }

  /* ── chapters (for the progress UI) ─────────────────────────────── */

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

  setChapters(chapters: Chapter[]) {
    this.snap = { chapters, active: 0 };
    this.emit();
  }

  setActive(i: number) {
    if (i === this.snap.active) return;
    this.snap = { ...this.snap, active: i };
    this.emit();
  }

  /** Per-frame chapter progress goes straight to listeners, never through React state. */
  onProgress(fn: (i: number, p: number) => void) {
    this.progressListeners.add(fn);
    return () => {
      this.progressListeners.delete(fn);
    };
  }

  emitProgress(i: number, p: number) {
    this.progressListeners.forEach((fn) => fn(i, p));
  }
}

export const stage = new Stage();
