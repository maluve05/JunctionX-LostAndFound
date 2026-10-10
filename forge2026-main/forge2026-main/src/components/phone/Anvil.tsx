import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, HandTapIcon } from "@phosphor-icons/react";
import {
  ANVIL,
  HAMMER_HANDLE,
  HAMMER_HEAD,
  HAMMER_PIVOT,
  LOGO_SHARDS,
  MIST,
} from "../story/scene/mark";
import { isNight, NIGHT_TAPS, nightShift } from "./eggs";
import { haptic } from "./haptic";
import { strikes } from "./story";

/*
  The phone's forge: the FORGe mark, drawn from its own traced paths so it
  stays sharp at any size, and live. Tap it and the hammer swings, the anvil
  gives, the mark's shards jump out and settle back, and a spray of sparks
  and a ring fly off the face. No fire. Blows in quick succession heat the
  glow behind it. Every strike is counted on this device, and the line under
  the anvil answers the count, so it is worth coming back to.

  Everything moves with the Web Animations API on transforms and opacity, and
  nothing moves between strikes.
*/

/** The mark's box in its own units: hammer tip to anvil foot, widest shard to widest shard. */
const VIEW = { x: -136, y: -212, w: 254, h: 327 };
/** The anvil face (the shards' origin) as a share of that box, for the ring and sparks. */
const FACE = { x: -VIEW.x / VIEW.w, y: -VIEW.y / VIEW.h };
/** From tap to contact, in ms. */
const CONTACT = 230;
const SPARKS = 14;
const SPARK_COLOURS = ["#ffffff", "#c4b8ff", "#d6ff42", "#c4b8ff", "#8f78ff"];
/** The night shift's sparks (eggs.ts): the same roles in its neon. */
const NIGHT_SPARKS = ["#ffffff", "#3cefff", "#ff4fd8", "#3cefff", "#b18cff"];

function line(n: number, welcome: boolean, night: boolean): { text: string; apply?: boolean } {
  if (night) return { text: `${n} strikes. Night shift.` };
  if (welcome) return { text: `Welcome back. ${n} ${n === 1 ? "strike" : "strikes"} so far.` };
  if (n <= 0) return { text: "Tap the anvil" };
  if (n === 1) return { text: "Again." };
  if (n === 2) return { text: "Harder." };
  if (n < 5) return { text: "That’s the spirit." };
  if (n < 8) return { text: "Now you’re forging." };
  if (n < 12) return { text: "Sparks suit you." };
  if (n < 25) return { text: "You’d fit right in.", apply: true };
  if (n < 50) return { text: `${n} strikes. The anvil remembers you.` };
  if (n < 100) return { text: `${n}. Save some for November.` };
  return { text: `${n} strikes. Legend.` };
}

/** Rotate the hammer about the end of its handle, in the mark's units. */
const swing = (deg: number, dy = 0) =>
  `translate(${HAMMER_PIVOT.x}px, ${HAMMER_PIVOT.y + dy}px) rotate(${deg}deg) translate(${-HAMMER_PIVOT.x}px, ${-HAMMER_PIVOT.y}px)`;

/** Squash the anvil from its foot. */
const squash = (sx: number, sy: number) =>
  `translate(0px, 111px) scale(${sx}, ${sy}) translate(0px, -111px)`;

export function Anvil() {
  const box = useRef<HTMLDivElement>(null);
  const hammer = useRef<SVGGElement>(null);
  const anvil = useRef<SVGPathElement>(null);
  const shards = useRef<(SVGPathElement | null)[]>([]);
  const ring = useRef<HTMLSpanElement>(null);
  const flash = useRef<HTMLSpanElement>(null);
  const heat = useRef<HTMLSpanElement>(null);
  const sparks = useRef<HTMLSpanElement>(null);
  const combo = useRef({ n: 0, last: -10 });
  const cool = useRef(0);
  const [count, setCount] = useState(0);
  const [welcome, setWelcome] = useState(false);
  const [night, setNight] = useState(false);

  useEffect(() => {
    const n = strikes.get();
    if (n > 0) {
      setCount(n);
      setWelcome(true);
    }
    // Back on the cover after the night shift came on: it is still night.
    if (isNight()) setNight(true);
    return () => window.clearTimeout(cool.current);
  }, []);

  const strike = () => {
    const n = strikes.get() + 1;
    strikes.set(n);
    setCount(n);
    setWelcome(false);
    haptic(12);
    // A secret (eggs.ts): every 150th tap changes shift, to the night or back.
    if (n % NIGHT_TAPS === 0) {
      const on = !isNight();
      nightShift(on);
      setNight(on);
    }

    const now = performance.now() / 1000;
    combo.current.n = now - combo.current.last < 1.2 ? combo.current.n + 1 : 1;
    combo.current.last = now;
    const power = Math.min(combo.current.n, 6);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
    hammer.current?.animate(
      [
        { transform: swing(0), easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
        { transform: swing(16, -8), offset: 0.3, easing: "cubic-bezier(0.6, 0, 1, 1)" },
        { transform: swing(-30, 8), offset: 0.46, easing: "ease-out" },
        { transform: swing(-22, 4), offset: 0.6, easing: "ease-in-out" },
        { transform: swing(0) },
      ],
      { duration: 500 },
    );
    anvil.current?.animate(
      [
        { transform: squash(1, 1) },
        { transform: squash(1 + 0.02 * power, 1 - 0.035 * power), offset: 0.25 },
        { transform: squash(1, 1) },
      ],
      { duration: 320, delay: CONTACT, easing: ease },
    );

    const kick = 9 + power * 3;
    shards.current.forEach((el, i) => {
      if (!el) return;
      const a = (LOGO_SHARDS[i].angle * Math.PI) / 180;
      const d = kick * (0.7 + Math.random() * 0.6);
      const x = Math.sin(a) * d;
      const y = -Math.cos(a) * d;
      const r = (Math.random() - 0.5) * 30;
      el.animate(
        [
          { transform: "none" },
          { transform: `translate(${x}px, ${y}px) rotate(${r}deg)`, offset: 0.28 },
          { transform: `translate(${-x * 0.12}px, ${-y * 0.12}px)`, offset: 0.62 },
          { transform: "none" },
        ],
        { duration: 700, delay: CONTACT, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" },
      );
    });

    ring.current?.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0.9 },
        { transform: `translate(-50%, -50%) scale(${1.3 + power * 0.12})`, opacity: 0 },
      ],
      { duration: 620, delay: CONTACT, easing: ease },
    );
    flash.current?.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.2 }, { opacity: 0 }], {
      duration: 420,
      delay: CONTACT,
      easing: "ease-out",
    });

    const flying = sparks.current;
    if (flying) {
      const w = box.current?.offsetWidth || 220;
      Array.from(flying.children).forEach((el, i) => {
        // A fan thrown up and out, a few skimming low to the sides.
        const low = i % 5 === 0;
        const a = low
          ? (i % 2 ? -0.1 : Math.PI + 0.1) + (Math.random() - 0.5) * 0.3
          : -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        const d = w * (0.28 + Math.random() * 0.3) * (1 + power * 0.08);
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        const deg = (a * 180) / Math.PI;
        (el as HTMLElement).animate(
          [
            { transform: `rotate(${deg}deg) scaleX(0.4)`, opacity: 1 },
            {
              transform: `translate(${x * 0.8}px, ${y * 0.8}px) rotate(${deg}deg) scaleX(1)`,
              opacity: 1,
              offset: 0.55,
            },
            {
              transform: `translate(${x}px, ${y + w * 0.08}px) rotate(${deg + 20}deg) scaleX(0.3)`,
              opacity: 0,
            },
          ],
          { duration: 480 + Math.random() * 260, delay: CONTACT, easing: "ease-out" },
        );
      });
    }

    // The glow behind the mark heats with a run of blows and cools after.
    const h = heat.current;
    if (h) {
      h.style.opacity = String(Math.min(1, (power - 1) * 0.24));
      window.clearTimeout(cool.current);
      cool.current = window.setTimeout(() => {
        h.style.opacity = "0";
      }, 1300);
    }
  };

  const said = line(count, welcome, night);

  return (
    <div className="ph-forge">
      <div ref={box} className="ph-anvil">
        <span className="ph-anvil-glow" aria-hidden="true" />
        <span ref={heat} className="ph-anvil-heat" aria-hidden="true" />
        <button
          type="button"
          className="ph-anvil-hit"
          aria-label="Strike the anvil"
          onClick={strike}
        >
          <svg
            viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
            className="ph-mark"
            aria-hidden="true"
          >
            <g ref={hammer} className="ph-mark-part" fill={MIST}>
              <path d={HAMMER_HEAD} fillRule="evenodd" />
              <path d={HAMMER_HANDLE} />
            </g>
            {LOGO_SHARDS.map((s, i) => (
              <path
                key={s.d}
                ref={(el) => {
                  shards.current[i] = el;
                }}
                d={s.d}
                fill={s.fill}
                className="ph-mark-shard"
              />
            ))}
            <path ref={anvil} d={ANVIL} fill={MIST} fillRule="evenodd" className="ph-mark-part" />
          </svg>
          <span
            className="ph-anvil-face"
            style={{ left: `${FACE.x * 100}%`, top: `${FACE.y * 100}%` }}
            aria-hidden="true"
          >
            <span ref={flash} className="ph-anvil-flash" />
            <span ref={ring} className="ph-anvil-ring" />
            <span ref={sparks} className="ph-sparks">
              {Array.from({ length: SPARKS }, (_, i) => (
                <i
                  key={i}
                  style={{
                    background: (night ? NIGHT_SPARKS : SPARK_COLOURS)[i % SPARK_COLOURS.length],
                  }}
                />
              ))}
            </span>
          </span>
        </button>
      </div>
      <p className="ph-anvil-line" aria-live="polite">
        {count === 0 && !welcome && <HandTapIcon size={16} aria-hidden="true" />}
        <span>{said.text}</span>
        {said.apply && (
          <Link to="/builders" hash="apply" className="ph-anvil-apply">
            Apply
            <ArrowRightIcon size={13} weight="bold" aria-hidden="true" />
          </Link>
        )}
      </p>
    </div>
  );
}
