import { useEffect, useLayoutEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { stage } from "./stage";
import { interactions } from "./interact";
import { setupTransitions } from "./transitions";
import { isFormation, type FormationName } from "./scene/names";

/*
  Wires a page into the stage. Everything is declared in the markup:

    data-scene="build"      this element starts a formation; the shards morph
                            to it while its top crosses the middle of the screen
    data-chapter="2025"     a chapter for the progress UI, labelled
    data-split              a headline that settles in line by line
    data-rise               a block that rises in when it scrolls into view
    data-enter="…"          a chapter entrance (see transitions.ts)

  Elements already on screen when the page opens are not hidden to animate
  back in, so nothing that is visible ever blinks.
*/

function setupReveals(root: HTMLElement) {
  const fold = window.innerHeight * 0.92;
  const below = (el: HTMLElement) => el.getBoundingClientRect().top > fold;

  // Headlines settle in as whole lines: a short fade and lift, nothing more.
  // Letters never move on their own (the team found moving type distracting).
  root.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
    if (!below(el)) return;
    SplitText.create(el, {
      type: "lines",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 28,
          autoAlpha: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.06,
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }),
    });
  });

  const rise = Array.from(root.querySelectorAll<HTMLElement>("[data-rise]")).filter(below);
  if (rise.length) {
    gsap.set(rise, { y: 48, autoAlpha: 0 });
    ScrollTrigger.batch(rise, {
      start: "top 92%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          y: 0,
          autoAlpha: 1,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.08,
          overwrite: true,
          // Hand the transform back to CSS, where tilt and hover live.
          clearProps: "transform",
        }),
    });
  }
}

export function useStoryPage(ref: RefObject<HTMLElement | null>, opts: { intro?: boolean } = {}) {
  const { intro = false } = opts;

  // Before the first paint of the new page, so it never shows mid-scroll.
  useLayoutEffect(() => stage.enterPage(), []);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger, SplitText);

    const ctx = gsap.context(() => {
      // 1. The formation sequence, and scroll progress through it.
      const markers = Array.from(root.querySelectorAll<HTMLElement>("[data-scene]")).filter((el) =>
        isFormation(el.dataset.scene),
      );
      stage.setSequence(markers.map((el) => el.dataset.scene as FormationName));
      const progress = new Float32Array(markers.length);
      const push = () => {
        let sum = 0;
        for (let i = 1; i < progress.length; i++) sum += progress[i];
        stage.setTarget(sum);
      };
      // A move never starts above the top of the page: when a short hero
      // leaves the next chapter's marker on screen at load (a tall window),
      // the move begins with the first scroll instead of the first formation
      // opening half undone.
      const moved = (self: ScrollTrigger) => {
        const from = Math.max(self.start, 0);
        const span = self.end - from;
        return span > 1 ? Math.min(Math.max((self.scroll() - from) / span, 0), 1) : self.progress;
      };
      markers.forEach((el, i) => {
        if (i === 0) return;
        ScrollTrigger.create({
          trigger: el,
          start: "top 78%",
          end: "top 22%",
          onUpdate: (self) => {
            progress[i] = moved(self);
            push();
          },
          onRefresh: (self) => {
            progress[i] = moved(self);
            push();
          },
        });
      });

      // 2. Chapters, for the rail and the story bar.
      const chapters = Array.from(root.querySelectorAll<HTMLElement>("[data-chapter]"));
      stage.setChapters(
        chapters.map((el, i) => ({ id: el.id || `chapter-${i}`, label: el.dataset.chapter ?? "" })),
      );
      chapters.forEach((el, i) => {
        ScrollTrigger.create({
          trigger: el,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (self) => {
            if (self.isActive) stage.setActive(i);
          },
          onUpdate: (self) => stage.emitProgress(i, self.progress),
          onRefresh: (self) => stage.emitProgress(i, self.progress),
        });
      });

      // 3. Reveals, letters and chapter entrances.
      if (!stage.reduced) {
        setupReveals(root);
        setupTransitions(root);
      }
    }, root);

    if (intro) stage.wantIntro();
    stage.lenis?.resize();
    // Layout settles after fonts and images; measure again once it has.
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    const late = window.setTimeout(() => ScrollTrigger.refresh(), 900);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(late);
      root
        .querySelectorAll<HTMLElement>("[data-split], [data-proximity]")
        .forEach((el) => interactions.unregister(el));
      ctx.revert();
      stage.setChapters([]);
    };
  }, [ref, intro]);
}
