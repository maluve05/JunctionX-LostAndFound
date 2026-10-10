import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/*
  How chapters hand over to each other, calmly: a seam line draws itself at
  each boundary, and each chapter fades and lifts into place in step with the
  scroll (forwards and backwards). The data-enter kinds (zoom, depth, wipe,
  swing, portal, blinds, doors) all get this same entrance now; zoom fades
  the hero out as you leave it.

  The CSS for each rests at its finished state, so without JavaScript, or with
  reduced motion (none of this is set up), everything is simply there.
*/

const GLYPHS = "<>/\\[]{}=+*#01ABCDEFXZ";

/** Decode a label from noise into its text. */
export function scramble(el: HTMLElement) {
  const final = el.dataset.text ?? el.textContent ?? "";
  el.dataset.text = final;
  const start = performance.now();
  const duration = Math.min(900, 300 + final.length * 40);
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const settled = Math.floor(t * final.length);
    let out = final.slice(0, settled);
    for (let i = settled; i < final.length; i++) {
      out += final[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = final;
  };
  requestAnimationFrame(step);
}

export function setupTransitions(root: HTMLElement) {
  // Seams: the line draws itself across as you reach the boundary. The label
  // just sits there (it used to decode itself from noise; moving type is out).
  root.querySelectorAll<HTMLElement>(".seam").forEach((seam) => {
    const line = seam.querySelector(".seam-line");
    if (!line) return;
    gsap.fromTo(
      line,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { trigger: seam, start: "top bottom", end: "top 55%", scrub: true },
      },
    );
  });

  // Entrances. Every kind now makes the same calm entrance, a fade and a
  // short lift in step with the scroll; the hero fades as you leave it. The
  // shutters, iris and laser rest open (their finished CSS state).
  root.querySelectorAll<HTMLElement>("[data-enter]").forEach((el) => {
    const section = (el.closest("section") as HTMLElement | null) ?? el;
    if (el.dataset.enter === "zoom") {
      gsap.to(el, {
        autoAlpha: 0,
        y: -40,
        ease: "none",
        scrollTrigger: { trigger: section, start: "top top", end: "bottom 10%", scrub: 0.4 },
      });
      return;
    }
    if (el.dataset.enter === "blinds" || el.dataset.enter === "portal") return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 36 },
      {
        autoAlpha: 1,
        y: 0,
        ease: "none",
        scrollTrigger: { trigger: section, start: "top bottom", end: "top 45%", scrub: 0.6 },
      },
    );
  });
}
