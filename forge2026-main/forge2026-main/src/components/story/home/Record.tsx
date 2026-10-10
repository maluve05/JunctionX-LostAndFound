import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRightIcon, PlayIcon } from "@phosphor-icons/react";
import { PHOTOS_2025, RECAP_2025_URL, SPONSORS_2025 } from "../content";
import { STORIES_2025 } from "../highlights";
import { Stories } from "../Stories";
import { Seam } from "../Seam";
import { SponsorLogo } from "../SponsorLogo";
import { Roll } from "../Roll";

/*
  Chapter five: we have done this before. Scrolling flies you through the
  first FORGe: its photographs hang at different depths and pass you one by
  one, while the numbers of that weekend are said one at a time. Behind them,
  exactly 120 shards stay lit, in 30 teams of four. Tap anywhere in the
  flight and the photographs open as stories, starting from the nearest.
*/

/** Where each photograph hangs, as a share of the stage width and height. */
const HANG = [
  { x: -0.22, y: -0.12 },
  { x: 0.24, y: 0.1 },
  { x: -0.2, y: 0.16 },
  { x: 0.22, y: -0.14 },
  { x: 0, y: 0 },
];

const CAPTIONS = [
  { big: "7 and 8 November 2025.", small: "The first FORGe." },
  { big: "120 builders.", small: "From across Portugal." },
  { big: "30 teams.", small: "Each around a real problem." },
  { big: "24 hours.", small: "Straight, from sketch to demo." },
];

const GAP = 1150;

export function Record() {
  const wrap = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const caps = useRef<HTMLDivElement>(null);
  /** The photograph nearest you in the flight: stories open there. */
  const nearest = useRef(0);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    // Phones skip the fly-through: they get the tap-to-watch card instead.
    mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
      const el = wrap.current;
      const w = world.current;
      const c = caps.current;
      if (!el || !w || !c) return;
      const photos = Array.from(w.children) as HTMLElement[];
      const depth = GAP * (photos.length - 1);

      const apply = (p: number) => {
        const vw = w.clientWidth;
        const vh = w.clientHeight;
        const travel = p * (depth + 700);
        let best = -Infinity;
        for (let i = 0; i < photos.length; i++) {
          const z = -i * GAP - 700 + travel;
          const last = i === photos.length - 1;
          // Fade in from the far dark, fade out just before it passes you.
          const inA = Math.min(1, Math.max(0, (z + 4300) / 1900));
          const outA = last ? 1 : 1 - Math.min(1, Math.max(0, (z - 120) / 420));
          const h = HANG[i % HANG.length];
          const zz = last ? Math.min(z, 0) : z;
          photos[i].style.transform =
            `translate3d(${(h.x * vw).toFixed(1)}px, ${(h.y * vh).toFixed(1)}px, ${zz.toFixed(1)}px)`;
          photos[i].style.opacity = (inA * outA).toFixed(3);
          if (inA * outA > 0.25 && zz > best) {
            best = zz;
            nearest.current = i;
          }
          // Nearest on top, even where the browser flattens the 3D context.
          photos[i].style.zIndex = String(Math.round(10000 + zz));
        }
        const k = Math.min(CAPTIONS.length - 1, Math.floor(p * CAPTIONS.length * 1.02));
        if (c.dataset.cap !== String(k)) c.dataset.cap = String(k);
      };

      const st = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => apply(self.progress),
        onRefresh: (self) => apply(self.progress),
      });
      return () => {
        st.kill();
        for (const ph of photos) {
          ph.style.transform = "";
          ph.style.opacity = "";
        }
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <section id="edition-2025" data-chapter="2025" className="relative">
      <Seam label="2025" />
      <div data-scene="record" className="scene-marker" />

      <div ref={wrap} className="flight-wrap relative">
        <div className="flight" data-enter="portal">
          <span className="portal-ring" aria-hidden="true" />
          <div ref={world} className="flight-world">
            {PHOTOS_2025.map((ph) => (
              <figure key={ph.src} className="flight-photo">
                <img
                  src={ph.src}
                  alt={ph.alt}
                  width={ph.w}
                  height={ph.h}
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            ))}
          </div>
          <div ref={caps} data-cap="0" className="flight-captions shell">
            {CAPTIONS.map((cap, i) => (
              <p key={cap.big} className="flight-caption" data-i={i}>
                <span className="block text-[15px] text-white/70 md:text-base">{cap.small}</span>
                <span className="mt-2 block h2">{cap.big}</span>
              </p>
            ))}
          </div>
          {/* Outside the 3D world, so taps always land (see CLAUDE.md). */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            data-cursor="View"
            className="flight-tap"
            onClick={() => setOpen(nearest.current)}
          />
          <button
            type="button"
            data-cursor="View"
            data-glyph="photos"
            className="btn btn-ghost btn-sm flight-view"
            onClick={() => setOpen(nearest.current)}
          >
            <PlayIcon size={14} weight="fill" aria-hidden="true" />
            <Roll>Tap to see the photos</Roll>
          </button>
        </div>
      </div>
      {open !== null && (
        <Stories
          slides={STORIES_2025}
          start={open}
          name="FORGe 2025"
          onClose={() => setOpen(null)}
        />
      )}

      <div className="relative py-24 md:py-32">
        <div className="shell">
          <h2 data-split className="h2 max-w-[13ch]">
            We have done this <span className="text-coral">before.</span>
          </h2>
          <p data-rise className="lead mt-6">
            The first FORGe brought 120 builders together for 24 hours straight. These partners
            backed it.
          </p>
          <a
            data-rise
            href={RECAP_2025_URL}
            target="_blank"
            rel="noreferrer noopener"
            data-cursor="Recap"
            data-glyph="recap"
            className="btn btn-ghost mt-9"
          >
            <Roll>See the 2025 recap</Roll>
            <ArrowUpRightIcon size={16} weight="bold" className="arrow-diag" aria-hidden="true" />
          </a>
        </div>

        <div data-rise className="marquee mt-16" aria-label="Partners of FORGe 2025">
          {[0, 1].map((copy) => (
            <ul key={copy} className="marquee-track" aria-hidden={copy === 1 ? true : undefined}>
              {SPONSORS_2025.map((s) => (
                <li key={s.name} className="marquee-item">
                  <SponsorLogo
                    file={s.logo}
                    name={copy === 1 ? "" : s.name}
                    className="h-7 w-auto max-w-[150px] object-contain md:h-8"
                    fallback={
                      <span className="text-[15px] font-medium text-white/70">{s.name}</span>
                    }
                  />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
