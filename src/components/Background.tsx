import { useEffect, useRef } from "react";

/**
 * The backdrop: a live particle field on an HTML5 canvas, over pure black.
 *
 * Cold white and electric lime motes drift slowly, wrap around the edges and
 * are pushed gently out of the cursor's way — the only ambient depth on the
 * page. Everything is drawn additively, so overlapping motes burn a little
 * brighter. It yields to `prefers-reduced-motion` with a single static frame,
 * and sleeps while the tab is hidden.
 */

/** Mist and electric lime, as raw RGB triplets for cheap alpha compositing. */
const MIST = "233,234,238";
const LIME = "214,255,66";

/** How far the cursor pushes a mote, and how hard. */
const POINTER_RADIUS = 150;
const POINTER_FORCE = 640;

type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The drift the mote relaxes back to once the cursor lets go. */
  nvx: number;
  nvy: number;
  r: number;
  lime: boolean;
  base: number;
  phase: number;
  twinkle: number;
};

/** Roughly one mote per 26,000px², floored and capped so every screen feels alive. */
function makeMotes(width: number, height: number): Mote[] {
  const count = Math.round(Math.min(90, Math.max(26, (width * height) / 26000)));
  const motes: Mote[] = [];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 20;
    motes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0,
      nvx: Math.cos(angle) * speed,
      nvy: Math.sin(angle) * speed,
      r: 0.7 + Math.random() * 1.7,
      lime: Math.random() < 0.22,
      base: 0.16 + Math.random() * 0.34,
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.5 + Math.random() * 1.1,
    });
  }

  return motes;
}

export function Background() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0, y: 0, active: false };

    let dpr = 1;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let motes = makeMotes(width, height);
    let raf = 0;
    let last = 0;
    let elapsed = 0;

    const drawMote = (m: Mote) => {
      const rgb = m.lime ? LIME : MIST;
      const twinkle = 0.65 + 0.35 * Math.sin(elapsed * m.twinkle + m.phase);
      const alpha = Math.max(0, Math.min(1, m.base * twinkle));

      // A soft halo underneath, then the solid mote on top.
      ctx.fillStyle = `rgba(${rgb},${alpha * 0.22})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${rgb},${alpha})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      for (const m of motes) drawMote(m);
      ctx.globalCompositeOperation = "source-over";
    };

    const step = (dt: number) => {
      elapsed += dt;

      for (const m of motes) {
        // Relax back to the natural drift...
        const relax = 1 - Math.exp(-0.9 * dt);
        m.vx += (m.nvx - m.vx) * relax;
        m.vy += (m.nvy - m.vy) * relax;

        // ...then get pushed gently out of the cursor's way.
        if (pointer.active) {
          const dx = m.x - pointer.x;
          const dy = m.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < POINTER_RADIUS * POINTER_RADIUS && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const push = (1 - d / POINTER_RADIUS) * POINTER_FORCE;
            m.vx += (dx / d) * push * dt;
            m.vy += (dy / d) * push * dt;
          }
        }

        m.x += m.vx * dt;
        m.y += m.vy * dt;

        // Wrap softly around the edges so the field never empties.
        if (m.x < -20) m.x = width + 20;
        else if (m.x > width + 20) m.x = -20;
        if (m.y < -20) m.y = height + 20;
        else if (m.y > height + 20) m.y = -20;
      }
    };

    const frame = (time: number) => {
      const dt = Math.min(time - last || 16, 34) / 1000;
      last = time;
      step(dt);
      draw();
      raf = window.requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf !== 0 || reduced.matches) return;
      last = performance.now();
      raf = window.requestAnimationFrame(frame);
    };

    const stop = () => {
      if (raf === 0) return;
      window.cancelAnimationFrame(raf);
      raf = 0;
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      motes = makeMotes(width, height);
      draw();
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const onMotionChange = () => {
      if (reduced.matches) {
        stop();
        draw();
      } else {
        start();
      }
    };

    resize();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", onMotionChange);
    if (!document.hidden) start();

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        style={{
          maskImage: "radial-gradient(130% 105% at 50% 42%, #000 26%, transparent 82%)",
          WebkitMaskImage: "radial-gradient(130% 105% at 50% 42%, #000 26%, transparent 82%)",
        }}
      />
      <div className="absolute inset-0 bg-vignette" />
    </div>
  );
}
