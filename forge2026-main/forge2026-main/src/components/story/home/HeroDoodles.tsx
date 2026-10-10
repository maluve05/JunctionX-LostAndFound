import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRightIcon, LightningIcon } from "@phosphor-icons/react";
import { theme } from "../theme";
import { doodles, PER_DOODLE } from "./doodles";

/** What the chip says as blows pile up in quick succession. */
const HEAT = ["", "", "Again!", "Charged", "Sparking", "Surging", "Supercharged", "Overload!"];
/** On the way to the first doodle, the chip counts down the swings. */
const COUNTDOWN = ["Swing the hammer", "Two more swings", "One more swing"];

/**
 * The hero's open space, above the headline and left of the forge, where
 * swinging the hammer forges doodles (doodles.ts), and the chip beside it
 * that asks for the swings. Its three diamonds fill one per swing; the third
 * forges a doodle. It also shows the heat of a run of blows. Wide build only.
 */
export function HeroDoodles() {
  const layer = useRef<HTMLDivElement>(null);
  const garden = useRef<HTMLDivElement>(null);
  const snap = useSyncExternalStore(
    doodles.subscribe,
    doodles.getSnapshot,
    doodles.getServerSnapshot,
  );
  const nightSince = useSyncExternalStore(
    theme.subscribe,
    theme.getSnapshot,
    theme.getServerSnapshot,
  );
  const [combo, setCombo] = useState(0);
  const [teach, setTeach] = useState(false);
  const [nightNote, setNightNote] = useState(false);

  useEffect(() => {
    if (!layer.current || !garden.current) return;
    return doodles.mount(layer.current, garden.current);
  }, []);

  // A run of blows charges the chip up; it cools a moment after the last.
  useEffect(() => {
    let cool = 0;
    const onImpact = (e: Event) => {
      const { combo: n } = (e as CustomEvent<{ combo: number }>).detail;
      setCombo(n);
      window.clearTimeout(cool);
      cool = window.setTimeout(() => setCombo(0), 1600);
    };
    window.addEventListener("forge:impact", onImpact);
    return () => {
      window.clearTimeout(cool);
      window.removeEventListener("forge:impact", onImpact);
    };
  }, []);

  // When the first doodle lands, the chip says how it happened, for a moment.
  useEffect(() => {
    const left = snap.firstAt ? 3500 - (performance.now() - snap.firstAt) : 0;
    if (left <= 0) return;
    setTeach(true);
    const t = window.setTimeout(() => setTeach(false), left);
    return () => window.clearTimeout(t);
  }, [snap.firstAt]);

  // When the night shift comes on, the chip names it, for a moment.
  useEffect(() => {
    const left = nightSince ? 4000 - (performance.now() - nightSince) : 0;
    if (left <= 0) {
      setNightNote(false);
      return;
    }
    setNightNote(true);
    const t = window.setTimeout(() => setNightNote(false), left);
    return () => window.clearTimeout(t);
  }, [nightSince]);

  const step = snap.swings % PER_DOODLE;
  const heat = Math.min(combo, HEAT.length - 1);
  const hot = combo > 1 && !teach && !nightNote;
  const say = nightNote
    ? "Night shift"
    : teach
      ? "Three swings forge a doodle"
      : snap.forged === 0
        ? COUNTDOWN[step]
        : `${snap.forged} ${snap.forged === 1 ? "doodle" : "doodles"}`;

  return (
    <div ref={layer} className="hero-doodles" aria-hidden="true" data-enter="zoom">
      <div className="doodle-field">
        <div ref={garden} className="doodle-garden" />
        <span
          className="forge-chip"
          data-new={snap.swings === 0 ? "" : undefined}
          data-heat={hot ? heat : undefined}
        >
          <span className="forge-pips">
            {Array.from({ length: PER_DOODLE }, (_, i) => (
              <i key={i} data-on={i < step ? "" : undefined} />
            ))}
          </span>
          {hot ? (
            <span key={`heat-${combo}`} className="forge-say">
              <LightningIcon size={15} weight="fill" />
              <b className="tnum">&times;{combo}</b>
              {HEAT[heat]}
            </span>
          ) : (
            <span key={say} className="forge-say">
              {say}
            </span>
          )}
          <ArrowRightIcon size={15} weight="bold" className="forge-chip-to" />
        </span>
      </div>
    </div>
  );
}
