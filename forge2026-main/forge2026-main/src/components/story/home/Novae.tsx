import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { NOVAE_TIMELINE, NOVAE_URL, NOVAE_VALUES } from "../content";
import { Seam } from "../Seam";
import { Roll } from "../Roll";
import { watchNovaeE } from "../eggs";

/**
 * Chapter six: who builds FORGe. The shards settle into NOVAe's own e, and its
 * path so far draws itself as you read, ending on the edition that is coming.
 */
export function Novae() {
  const line = useRef<HTMLOListElement>(null);
  const section = useRef<HTMLElement>(null);

  // A secret (eggs.ts): the lime e in the headline sets off the shards' e.
  useEffect(() => (section.current ? watchNovaeE(section.current) : undefined), []);

  useEffect(() => {
    const el = line.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const items = Array.from(el.querySelectorAll<HTMLElement>(".tl-item"));
    const set = (p: number) => {
      el.style.setProperty("--tl", p.toFixed(4));
      items.forEach((item, i) => {
        const on = p >= i / (items.length - 1) - 0.02;
        if (on) item.dataset.on = "";
        else delete item.dataset.on;
      });
    };
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      end: "bottom 45%",
      scrub: 0.4,
      onUpdate: (self) => set(self.progress),
      onRefresh: (self) => set(self.progress),
    });
    return () => st.kill();
  }, []);

  return (
    <section ref={section} id="novae" data-chapter="NOVAe" className="relative">
      <Seam label="NOVAe" />
      <div data-scene="novae" className="scene-marker" />
      {/* Shutter: dark slats over the first screen that open as it arrives. */}
      <div data-enter="blinds" className="blinds" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="blind" />
        ))}
      </div>
      <div className="shell pb-10 pt-[50svh] md:pt-[46svh] lg:pt-[20svh]">
        <div className="lg:max-w-[46%]">
          <img
            data-rise
            src="/brand/novae/logo-long-white.webp"
            alt="NOVAe"
            loading="lazy"
            className="h-10 w-auto object-contain md:h-12"
          />
          <h2 data-split className="h2 mt-8">
            Built by{" "}
            <span className="whitespace-nowrap">
              NOVA<span className="novae-e">e</span>.
            </span>
          </h2>
          <p data-rise className="lead mt-6">
            The student startup hub at NOVA IMS, Lisbon. NOVAe ran the first FORGe in 2025 and is
            building this one.
          </p>
          <ul data-rise className="mt-10 space-y-5">
            {NOVAE_VALUES.map((v) => (
              <li key={v.title} className="value-row">
                <span className="text-lg font-semibold tracking-[-0.02em] text-white">
                  {v.title}
                </span>
                <span className="text-[15px] leading-relaxed text-white/60">{v.line}</span>
              </li>
            ))}
          </ul>
          <div data-rise className="mt-10 flex flex-wrap gap-3">
            <a
              href={NOVAE_URL}
              target="_blank"
              rel="noreferrer noopener"
              data-cursor="Visit"
              data-glyph="novae"
              className="btn btn-light"
            >
              <Roll>Visit NOVAe</Roll>
              <ArrowUpRightIcon size={16} weight="bold" className="arrow-diag" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      <div className="shell pb-16 pt-14 md:pb-36">
        <h3 className="sr-only">NOVAe so far</h3>
        <ol ref={line} className="timeline">
          {NOVAE_TIMELINE.map((item) => (
            <li
              key={item.when}
              className="tl-item"
              data-next={"next" in item && item.next ? "" : undefined}
            >
              <span className="tl-dot" aria-hidden="true" />
              <span className="tl-when">{item.when}</span>
              <span className="tl-what">{item.what}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
