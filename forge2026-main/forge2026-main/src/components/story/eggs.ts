import { TRAM_SVG } from "./eggArt";
import { fx } from "./fx";
import { stage } from "./stage";
import { theme } from "./theme";

/*
  Small secrets for people who poke at things. Nothing on the page points to
  them.

    stir the forge   circle the cursor round the anvil three times and it
                     turns once round (Hero.tsx)
    NOVAe's e        click the lime e in "Built by NOVAe." and the big e of
                     shards bursts and pulls itself back together (Novae.tsx)
    the tram         click "Lisbon" in the footer and a tram runs along the
                     line under it, with a stop halfway (Footer.tsx)

  And the Konami code (up up down down left right left right B A) turns the
  night shift on or off without the 150 swings, which is handy for showing it
  (theme.ts). Wide build only; nothing moves for reduced motion.
*/

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Stir the forge: three turns of the cursor round the anvil, without stopping. */
export function watchStir(zone: HTMLElement) {
  let last: number | null = null;
  let total = 0;
  let at = 0;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || reduced()) return;
    const r = zone.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height * 0.55);
    const d = Math.hypot(dx, dy);
    const now = performance.now();
    // Round the anvil: not on its centre, not far off it, and no long pauses.
    const round = d > 40 && d < Math.max(r.width, r.height) * 0.62;
    if (!round || now - at > 1200) {
      last = null;
      total = 0;
    }
    at = now;
    if (!round) return;
    const a = Math.atan2(dy, dx);
    if (last !== null) {
      let da = a - last;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      total += da;
      if (Math.abs(total) >= Math.PI * 6) {
        total = 0;
        last = null;
        stage.twirl();
        return;
      }
    }
    last = a;
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  return () => window.removeEventListener("pointermove", onMove);
}

/** NOVAe's e: the lime e in the headline sets off the big one made of shards. */
export function watchNovaeE(section: HTMLElement) {
  const onClick = (e: MouseEvent) => {
    if (!(e.target as Element | null)?.closest(".novae-e") || reduced()) return;
    // Where the novae formation stands the e: right of centre, a touch high.
    const x = window.innerWidth * 0.74;
    const y = window.innerHeight * 0.47;
    stage.burst(x, y, 2.6);
    fx.ripple(x, y);
  };
  section.addEventListener("click", onClick);
  return () => section.removeEventListener("click", onClick);
}

/** The tram: "Lisbon" in the footer sends one along the line under it. */
export function watchTram(footer: HTMLElement) {
  let running = false;
  const onClick = (e: MouseEvent) => {
    if (!(e.target as Element | null)?.closest(".egg-lisbon") || running || reduced()) return;
    const line = footer.querySelector<HTMLElement>(".footer-line");
    if (!line) return;
    running = true;
    const tram = document.createElement("span");
    tram.className = "tram";
    // Only this file's own drawing goes in here, never page input.
    tram.innerHTML = TRAM_SVG;
    tram.style.setProperty("--track", `${line.clientWidth}px`);
    line.appendChild(tram);
    // Its wheels and spark animate too; only its own run ends the ride.
    tram.addEventListener("animationend", (ev) => {
      if (ev.target !== tram) return;
      tram.remove();
      running = false;
    });
  };
  footer.addEventListener("click", onClick);
  return () => footer.removeEventListener("click", onClick);
}

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

/** The Konami code turns the night shift on or off. */
export function watchKonami() {
  const code = KONAMI.join(" ");
  let keys: string[] = [];
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    // The last ten keys, compared with the code as a whole.
    keys.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    if (keys.length > KONAMI.length) keys.shift();
    if (keys.join(" ") === code) {
      keys = [];
      theme.toggle();
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
