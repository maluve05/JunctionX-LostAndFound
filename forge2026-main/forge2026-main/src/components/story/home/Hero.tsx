import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { watchStir } from "../eggs";
import { stage } from "../stage";
import { Roll } from "../Roll";
import { HeroDoodles } from "./HeroDoodles";

/**
 * Chapter one: what FORGe is, in one look. The forge on screen is the mark in
 * three dimensions. It is live: tap or click it and the hammer comes down and
 * sparks fly; keep swinging and the metal heats up and every blow lands
 * harder, and every third swing forges a doodle into the open space beside
 * it (HeroDoodles.tsx). Drag sideways to turn it. The page scrolls normally
 * over it (the zone only claims horizontal drags).
 */
export function Hero() {
  const zone = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  // A secret (eggs.ts): stir the cursor round the anvil and it turns.
  useEffect(() => (zone.current ? watchStir(zone.current) : undefined), []);

  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    let id = -1;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let dragging = false;

    const down = (e: PointerEvent) => {
      id = e.pointerId;
      startX = lastX = e.clientX;
      startY = e.clientY;
      dragging = false;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        dragging = true;
        el.setPointerCapture(e.pointerId);
      }
      if (dragging) {
        stage.spin(e.clientX - lastX);
        lastX = e.clientX;
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      if (dragging) stage.release();
      else if (Math.hypot(e.clientX - startX, e.clientY - startY) < 10)
        stage.strike({ x: e.clientX, y: e.clientY });
      dragging = false;
    };
    const cancel = () => {
      id = -1;
      if (dragging) stage.release();
      dragging = false;
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, []);

  return (
    <section id="top" data-scene="forge" data-chapter="FORGe" className="hero relative">
      {/* Where the forge stands; it claims taps and sideways drags only. */}
      <div
        ref={zone}
        aria-hidden="true"
        className="forge-zone"
        data-cursor="Swing"
        data-enter="zoom"
      >
        {/* Lazy: on a phone this build is hidden, and a hidden lazy image never loads. */}
        <img
          src="/brand/anvil-symbol.webp"
          alt=""
          width={425}
          height={345}
          loading="lazy"
          className="forge-fallback"
        />
      </div>

      <HeroDoodles />

      <div ref={inner} className="shell hero-inner" data-enter="zoom">
        <h1 className="hero-title h1">
          <span className="line">
            <span>Portugal&rsquo;s</span>
          </span>{" "}
          <span className="line">
            <span>biggest hackathon.</span>
          </span>
        </h1>
        <div className="mt-7 grid grid-cols-1 gap-6 border-t border-white/12 pt-6 md:mt-9 lg:grid-cols-12 lg:items-center">
          <p className="hero-enter max-w-[36ch] text-base leading-relaxed text-white/75 md:text-lg lg:col-span-5">
            Builders from Portugal and beyond. One weekend in Lisbon, during Web Summit week,
            November 2026.
          </p>
          <div className="hero-enter hero-enter-2 flex gap-3 lg:col-span-7 lg:justify-end">
            <Link to="/builders" data-cursor="Apply" data-glyph="build" className="btn btn-light">
              <Roll>Apply to build</Roll>
              <ArrowRightIcon size={16} weight="bold" className="arrow" aria-hidden="true" />
            </Link>
            <Link
              to="/partners"
              data-cursor="Partner"
              data-glyph="partner"
              className="btn btn-ghost"
            >
              <Roll>Partner with FORGe</Roll>
            </Link>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => stage.strike()}
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-24 focus:z-50 btn btn-light btn-sm"
      >
        Swing the hammer
      </button>
    </section>
  );
}
