import { useEffect, type RefObject } from "react";
import { phoneStory } from "./story";

/*
  Wires a phone page up. Declared in the markup, like the wide build:

    data-ph-chapter="The weekend"   a chapter: the top bar names it, the
                                    Next button moves to it, and reading it
                                    is remembered
    data-ph-rise                    a block that settles into place (a short
                                    fade and lift) as it scrolls into view;
                                    with the class ph-stagger, its children
                                    step in one after another instead

  Blocks already on screen when the page opens are left alone, and words are
  never animated: whole blocks only.
*/

export function usePhonePage(ref: RefObject<HTMLElement | null>, page: string) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const unmount = phoneStory.mount(page, root);

    let rise: IntersectionObserver | null = null;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const fold = window.innerHeight * 0.96;
      const waiting = Array.from(root.querySelectorAll<HTMLElement>("[data-ph-rise]")).filter(
        (el) => el.getBoundingClientRect().top > fold,
      );
      rise = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const el = e.target as HTMLElement;
            el.dataset.phRise = "in";
            rise?.unobserve(el);
            // Once it has settled, hand its transform back to its own styles
            // (a press, say), which the reveal's slower transition would drag.
            window.setTimeout(() => {
              if (el.dataset.phRise === "in") el.dataset.phRise = "done";
            }, 1500);
          }
        },
        { rootMargin: "0px 0px -6% 0px" },
      );
      for (const el of waiting) {
        el.dataset.phRise = "wait";
        rise.observe(el);
      }
    }

    return () => {
      rise?.disconnect();
      unmount();
    };
  }, [ref, page]);
}
