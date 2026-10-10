import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { IntroPlayer } from "./intro";
import { layout } from "../layout";
import { stage } from "./stage";

/**
 * The loading intro (see intro.ts): the forge heats while the page loads, the
 * hammer strikes, and the screen shatters open onto the page. It plays once
 * per visit to the site (a full load, whatever the page), never on moves
 * between pages, never for reduced motion, and never on a phone turned
 * sideways after the page opened. It is in the server's HTML so it covers
 * the page from the first paint; if the script never runs, CSS takes it away
 * after a few seconds. `?intro=0` skips it.
 */
export function ForgeIntro() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = root.current;
    const c = canvas.current;
    if (!el || !c) return;
    const html = document.documentElement;
    const skip =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      new URLSearchParams(window.location.search).get("intro") === "0" ||
      // Opened on a phone and turned sideways since: the page is already here.
      layout.first === "phone";
    if (skip) {
      setGone(true);
      return;
    }

    // Hold the page's own entrances (and the scene's opening) until the reveal.
    html.dataset.intro = "on";
    el.dataset.js = "";
    stage.holdIntro(true);
    // The 3D scene doesn't draw behind the intro: one thing at a time on the GPU.
    stage.cover("intro", true);

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      delete html.dataset.intro;
      stage.cover("intro", false);
      stage.holdIntro(false);
    };
    const player = new IntroPlayer(el, c, {
      ready: () => stage.live,
      onReveal: reveal,
      onDone: () => setGone(true),
    });

    const tick = (_t: number, deltaMs: number) => player.frame(deltaMs / 1000);
    gsap.ticker.add(tick);
    const poke = () => player.poke();
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) poke();
    };
    el.addEventListener("pointerdown", poke);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", poke, { passive: true });
    window.addEventListener("resize", player.layout);
    if (import.meta.env.DEV)
      (window as unknown as { __forgeIntro?: IntroPlayer }).__forgeIntro = player;

    return () => {
      gsap.ticker.remove(tick);
      el.removeEventListener("pointerdown", poke);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", poke);
      window.removeEventListener("resize", player.layout);
      reveal();
    };
  }, []);

  if (gone) return null;
  return (
    <div ref={root} className="intro" data-phase="heat" data-cursor="Strike" aria-hidden="true">
      <canvas ref={canvas} className="intro-canvas" />
      <p className="intro-status">Heating the forge</p>
    </div>
  );
}
