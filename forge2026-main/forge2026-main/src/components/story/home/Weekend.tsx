import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PHASES } from "../content";
import { Seam } from "../Seam";
import { stage } from "../stage";

/** Where in the chapter's scroll each step sits, as a share of it. */
const STOPS = [0.16, 0.5, 0.84];

/**
 * Chapter three: how the weekend works, one move at a time. A laser scans the
 * chapter in; then the stage holds while you scroll through three steps. Each
 * word turns over to the next and the shards act it out behind: a network
 * (connect), teams of five raising crystals (build), everything launching
 * (ship). The step names at the foot are buttons: each jumps to its step.
 *
 * The scene markers sit at the scroll offsets where each step takes over, so
 * the morph and the word change happen together.
 */
export function Weekend() {
  const wrap = useRef<HTMLElement>(null);
  const board = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    const b = board.current;
    if (!el || !b) return;
    gsap.registerPlugin(ScrollTrigger);
    const set = (p: number) => {
      const step = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
      if (b.dataset.step !== String(step)) b.dataset.step = String(step);
      b.style.setProperty("--p", p.toFixed(4));
    };
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => set(self.progress),
      onRefresh: (self) => set(self.progress),
    });
    return () => st.kill();
  }, []);

  const jump = (i: number) => {
    const el = wrap.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    // Past the last step: on to the next chapter.
    const at =
      i < STOPS.length ? STOPS[i] * (el.offsetHeight - window.innerHeight) : el.offsetHeight;
    stage.scrollTo(top + at);
  };

  /** Touch screens: a tap anywhere on the board moves to the next step. */
  const tapNext = (e: React.MouseEvent) => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if ((e.target as Element).closest("button, a")) return;
    jump(Number(board.current?.dataset.step ?? 0) + 1);
  };

  return (
    <section ref={wrap} id="weekend" data-chapter="The weekend" className="relative h-[380svh]">
      <Seam label="The weekend" />
      <div data-scene="connect" className="scene-marker" />
      <div data-scene="build" className="scene-marker" style={{ top: "143svh" }} />
      <div data-scene="ship" className="scene-marker" style={{ top: "237svh" }} />

      <div
        ref={board}
        data-step="0"
        data-enter="wipe"
        onClick={tapNext}
        className="weekend sticky top-0 h-[100svh] overflow-clip"
      >
        <div className="shell flex h-full flex-col justify-between pb-[calc(env(safe-area-inset-bottom)+112px)] pt-28 md:pb-14 md:pt-32">
          <h2 className="h3 max-w-[16ch]">
            One weekend, <span className="text-sky">three moves.</span>
          </h2>

          <div className="weekend-steps max-md:mb-8 max-md:mt-auto">
            {PHASES.map((phase, i) => (
              <div key={phase.title} className="weekend-step" data-i={i}>
                <p className="weekend-word" aria-hidden="true">
                  {phase.title}.
                </p>
                <h3 className="sr-only">{phase.title}</h3>
                <p className="weekend-body">{phase.body}</p>
              </div>
            ))}
          </div>

          <ol className="weekend-progress" aria-label="Steps">
            {PHASES.map((phase, i) => (
              <li key={phase.title} style={{ "--i": i } as React.CSSProperties}>
                <button
                  type="button"
                  onClick={() => jump(i)}
                  data-cursor={phase.title}
                  data-glyph={["connect", "build", "ship"][i]}
                  className="weekend-jump"
                >
                  <span className="weekend-track" aria-hidden="true">
                    <span className="weekend-fill" />
                  </span>
                  <span className="weekend-label">{phase.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
