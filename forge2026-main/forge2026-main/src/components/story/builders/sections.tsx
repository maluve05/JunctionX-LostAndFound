import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { PHASES, RECAP_2025_URL, RECORD } from "../content";
import { stage } from "../stage";
import { Roll } from "../Roll";

/** The weekend as a route: three stops on one line, drawn as you arrive. */
export function WeekendTrack() {
  const ref = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || stage.reduced) return;
    gsap.registerPlugin(ScrollTrigger);
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 80%",
      end: "bottom 55%",
      scrub: 0.5,
      onUpdate: (self) => el.style.setProperty("--tl", self.progress.toFixed(4)),
    });
    return () => st.kill();
  }, []);

  return (
    <section id="weekend" data-chapter="The weekend" className="relative py-24 md:py-36">
      <div data-scene="connect" className="scene-marker" />
      <div className="shell">
        <h2 data-split className="h2 max-w-[14ch]">
          One weekend, <span className="text-sky">three moves.</span>
        </h2>
        <ol ref={ref} className="track mt-14 md:mt-20">
          {PHASES.map((p, i) => (
            <li
              key={p.title}
              data-rise
              className="track-stop spot"
              style={{ "--i": i } as React.CSSProperties}
            >
              <span className="track-dot" aria-hidden="true" />
              <h3 className="track-word">{p.title}</h3>
              <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-white/65">
                {p.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** A number that counts up once it scrolls into view. */
function Count({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const match = value.match(/^(\d+)(.*)$/);
    if (!el || !match || stage.reduced) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    gsap.registerPlugin(ScrollTrigger);
    const target = Number(match[1]);
    const suffix = match[2];
    const n = { v: 0 };
    el.textContent = `0${suffix}`;
    const tween = gsap.to(n, {
      v: target,
      duration: 1.6,
      ease: "power3.out",
      onUpdate: () => {
        el.textContent = `${Math.round(n.v)}${suffix}`;
      },
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      el.textContent = value;
    };
  }, [value]);

  return (
    <span ref={ref} className="tnum">
      {value}
    </span>
  );
}

/** 2025 in its own numbers, with the way to the full recap. */
export function Numbers2025() {
  return (
    <section id="record" data-chapter="2025" className="relative py-24 md:py-36">
      <div data-scene="record" className="scene-marker" />
      <div className="shell">
        <h2 data-split className="h2 max-w-[12ch]">
          2025, in <span className="text-coral">numbers.</span>
        </h2>
        <dl className="numbers mt-12 md:mt-16">
          {RECORD.map((r) => (
            // Term first for the markup; the column is reversed so the number leads.
            <div key={r.label} data-rise className="number">
              <dt className="number-label">{r.label}</dt>
              <dd className="number-value">
                <Count value={r.value} />
              </dd>
            </div>
          ))}
        </dl>
        <a
          data-rise
          href={RECAP_2025_URL}
          target="_blank"
          rel="noreferrer noopener"
          data-cursor="Recap"
          data-glyph="recap"
          className="btn btn-ghost mt-12"
        >
          <Roll>See the 2025 recap</Roll>
          <ArrowUpRightIcon size={16} weight="bold" className="arrow-diag" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

/** The last push: back up to the form. */
export function FinalCall() {
  return (
    <section id="your-move" data-chapter="Your move" className="relative py-28 md:py-40">
      <div data-scene="ship" className="scene-marker" />
      <div className="shell">
        <h2 data-split className="h2">
          One room.
          <br />
          One weekend.
          <br />
          <span className="text-lime">Your move.</span>
        </h2>
        <a
          data-rise
          href="#apply"
          onClick={(e) => {
            e.preventDefault();
            stage.scrollTo("#apply");
          }}
          data-cursor="Apply"
          data-glyph="access"
          className="btn btn-light mt-12"
        >
          <Roll>Get early access</Roll>
          <ArrowUpIcon size={16} weight="bold" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
