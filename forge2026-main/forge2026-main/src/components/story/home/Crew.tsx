import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowLeftIcon, ArrowRightIcon, LinkedinLogoIcon } from "@phosphor-icons/react";
import { CREW } from "../content";
import { stage } from "../stage";

/**
 * Chapter four: the people behind it, as a row you move yourself. Scrolling
 * the page never moves it: swipe a trackpad or a phone sideways, drag it with
 * the mouse, use the arrows or the keyboard. The card nearest the middle turns
 * to face you and comes up to colour.
 *
 * The curve is drawn per card with `perspective()` inside the card's own
 * transform. No ancestor keeps a shared 3D space, so every card stays on its
 * own layer for clicks, and every portrait opens that person's LinkedIn.
 */
export function Crew() {
  const rail = useRef<HTMLUListElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const [edge, setEdge] = useState<"start" | "middle" | "end">("start");

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    const curve = !stage.reduced;
    let raf = 0;
    let lastEdge = "";
    let near = -1;

    const update = () => {
      raf = 0;
      const max = el.scrollWidth - el.clientWidth;
      const p = max > 0 ? el.scrollLeft / max : 0;
      if (thumb.current) {
        const share = max > 0 ? el.clientWidth / el.scrollWidth : 1;
        thumb.current.style.width = `${(share * 100).toFixed(2)}%`;
        thumb.current.style.transform = `translateX(${((p * (1 - share)) / share) * 100}%)`;
      }
      const e = p < 0.01 ? "start" : p > 0.99 ? "end" : "middle";
      if (e !== lastEdge) {
        lastEdge = e;
        setEdge(e);
      }
      const mid = el.scrollLeft + el.clientWidth / 2;
      const half = el.clientWidth / 2 || 1;
      let best = Infinity;
      let nearest = -1;
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const off = (c.offsetLeft + c.offsetWidth / 2 - mid) / half;
        if (Math.abs(off) < best) {
          best = Math.abs(off);
          nearest = i;
        }
        if (!curve) continue;
        const a = Math.max(-1.3, Math.min(1.3, off));
        c.style.transform = `perspective(1100px) rotateY(${(-a * 16).toFixed(2)}deg) translateY(${(a * a * 16).toFixed(1)}px) scale(${(1 - Math.min(1, Math.abs(a)) * 0.05).toFixed(3)})`;
      }
      if (nearest !== near) {
        if (near >= 0) delete cards[near].dataset.near;
        cards[nearest].dataset.near = "";
        near = nearest;
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    el.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();

    // Mouse drag, with a flick that carries on and settles on a card.
    let dragging = false;
    let moved = 0;
    let startX = 0;
    let startLeft = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;

    const settle = () => {
      const target = el.scrollLeft - velocity * 420;
      const snap = cards.reduce((bestLeft, c) => {
        const left = c.offsetLeft - parseFloat(getComputedStyle(el).scrollPaddingLeft || "0");
        return Math.abs(left - target) < Math.abs(bestLeft - target) ? left : bestLeft;
      }, Number.POSITIVE_INFINITY);
      const max = el.scrollWidth - el.clientWidth;
      gsap.to(el, {
        scrollLeft: Math.max(0, Math.min(max, snap)),
        duration: 0.9,
        ease: "power3.out",
        onComplete: () => {
          el.style.scrollSnapType = "";
        },
      });
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      dragging = true;
      moved = 0;
      startX = lastX = e.clientX;
      startLeft = el.scrollLeft;
      lastT = performance.now();
      velocity = 0;
      gsap.killTweensOf(el);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved < 6) return;
      if (!el.dataset.dragging) {
        el.dataset.dragging = "";
        // Snapping would fight the hand; it comes back once the flick settles.
        el.style.scrollSnapType = "none";
      }
      el.scrollLeft = startLeft - dx;
      const now = performance.now();
      velocity = (e.clientX - lastX) / Math.max(1, now - lastT);
      lastX = e.clientX;
      lastT = now;
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      if (el.dataset.dragging !== undefined) {
        delete el.dataset.dragging;
        settle();
      }
    };
    // A drag is not a click: swallow the click that ends one.
    const click = (e: MouseEvent) => {
      if (moved >= 6) {
        e.preventDefault();
        e.stopPropagation();
      }
      moved = 0;
    };

    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    el.addEventListener("click", click, true);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("click", click, true);
      gsap.killTweensOf(el);
    };
  }, []);

  const step = (dir: 1 | -1) => {
    const el = rail.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    el.scrollBy({ left: dir * (card.offsetWidth + gap) * 2, behavior: "smooth" });
  };

  return (
    <section id="crew" data-chapter="The crew" className="crew relative py-24 md:py-32">
      <div data-scene="field" className="scene-marker" />
      <div data-enter="swing" className="crew-inner">
        <div className="shell flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 data-split className="h2 max-w-[14ch]">
              Run by people who <span className="text-lilac">build.</span>
            </h2>
            <p data-rise className="lead mt-5">
              The team organising FORGe 2026. Every face opens their LinkedIn.
            </p>
          </div>
          <div data-rise className="crew-controls flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={edge === "start"}
              aria-label="Previous people"
              data-cursor="Back"
              className="round-btn"
            >
              <ArrowLeftIcon size={20} weight="bold" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={edge === "end"}
              aria-label="Next people"
              data-cursor="More"
              className="round-btn"
            >
              <ArrowRightIcon size={20} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>

        <ul
          ref={rail}
          className="crew-rail"
          tabIndex={0}
          aria-label="The FORGe 2026 team. Scroll sideways to see everyone."
          data-cursor="Drag"
        >
          {CREW.map((m) => (
            <li key={m.photo} className="crew-card">
              <a
                href={m.linkedin}
                target="_blank"
                rel="noreferrer noopener"
                draggable={false}
                aria-label={`${m.name}, ${m.role}. LinkedIn profile, opens in a new tab.`}
                data-cursor="LinkedIn"
                data-glyph="linkedin"
                className="crew-link"
              >
                <img
                  src={`/team/${m.photo}.webp`}
                  alt=""
                  width={720}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="crew-photo"
                />
                <span className="crew-shade" aria-hidden="true" />
                {/* Where the LinkedIn scene plays on hover (Glyphs.tsx). */}
                <span className="crew-scene" data-glyph-host aria-hidden="true" />
                <span className="crew-in" aria-hidden="true">
                  <LinkedinLogoIcon size={18} weight="fill" />
                </span>
                <span className="crew-text">
                  <span className="block text-[17px] font-semibold leading-snug tracking-[-0.01em] text-white">
                    {m.name}
                  </span>
                  <span className="mt-1 block text-[13px] leading-snug text-white/70">
                    {m.role}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="shell">
          <div className="crew-progress" aria-hidden="true">
            <span ref={thumb} className="crew-thumb" />
          </div>
        </div>
      </div>
    </section>
  );
}
