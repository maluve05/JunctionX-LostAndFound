import { useEffect, useRef } from "react";
import { ShardCursor, type CursorState } from "@/components/story/shardCursor";

/*
  The FORGe cursor on the application form and the review page: the same
  crystal shard as the story (shardCursor.ts, styles.css "cursor"), tip on
  the pointer, with a tag naming what a click does (data-cursor="Label").

  The story drives its cursor from interact.ts on the stage's GSAP ticker.
  These pages run neither, so this drives the shard on its own: the page's
  only animation loop, which also stops whenever the pointer leaves the
  window or the tab is hidden. Mouse only, and never with reduced motion,
  where the system cursor stays. In text fields the shard steps aside for the
  caret, as it does on the story pages.
*/

const PRESSABLE =
  "a, button, summary, label, select, [role='button'], [role='tab'], [role='radio'], [data-cursor]";
const FIELD = "input:not([type='checkbox']):not([type='radio']):not([type='file']), textarea";

export function PlainCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const tag = tagRef.current;
    if (!canvas || !tag) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return;

    const shard = new ShardCursor(canvas, tag);
    const root = document.documentElement;
    root.dataset.shardCursor = "";

    let raf = 0;
    let last = 0;
    let idle: number | undefined;

    const loop = (now: number) => {
      shard.frame((now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    const run = () => {
      window.clearTimeout(idle);
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const pause = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const paint = (el: Element | null) => {
      const target = el?.closest(`${FIELD}, ${PRESSABLE}`) ?? null;
      let state: CursorState = "idle";
      let label = "";
      if (target) {
        if (target.matches(FIELD)) state = "field";
        else {
          state = "press";
          label =
            (target as HTMLElement).dataset.cursor ??
            target.closest<HTMLElement>("[data-cursor]")?.dataset.cursor ??
            "";
        }
      }
      shard.setState(state, label);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      shard.move(e.clientX, e.clientY);
      run();
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = e.target instanceof Element ? e.target : null;
      // Inside an iframe (Turnstile) the page gets no more pointer events, so
      // the shard waits outside and the frame shows its own cursor.
      if (el?.tagName === "IFRAME") {
        shard.hide();
        return;
      }
      paint(el);
    };
    const onLeave = () => {
      shard.hide();
      paint(null);
      // Let the shard fade, then stop drawing.
      window.clearTimeout(idle);
      idle = window.setTimeout(pause, 600);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button === 0) shard.pressDown();
    };
    const onUp = () => shard.pressUp();
    const onVisibility = () => (document.hidden ? pause() : undefined);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    root.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      pause();
      window.clearTimeout(idle);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      delete root.dataset.shardCursor;
    };
  }, []);

  return (
    <div className="cursor" aria-hidden="true">
      <canvas ref={canvasRef} className="cursor-shard" />
      <span ref={tagRef} className="cursor-tag" />
    </div>
  );
}
