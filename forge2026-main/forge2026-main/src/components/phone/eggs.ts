import { NOVAE_CELL, NOVAE_E, TRAM_SVG } from "../story/eggArt";
import { haptic } from "./haptic";

/*
  The phone's small secrets: the wide build's, in the phone's manner. Taps,
  one-off motion on transforms and opacity, nothing left running, and
  nothing on the page pointing to them.

    NOVAe's e    tap the lime e in "Built by NOVAe." and it becomes NOVAe's
                 pixel e, block by block, then turns back (PhoneHome.tsx)
    the tram     tap "Lisbon" in the footer and a tram runs along the footer's
                 top line, with a stop halfway (PhoneFooter, parts.tsx)
    night shift  every 150th tap on the cover's anvil changes shift: the four
                 colours go to the night's neon at 150, back at 300, to neon
                 at 450, and so on. The count stays on the device and the
                 night lasts until a reload, so after one the next 150th tap
                 brings it back (Anvil.tsx, phone.css)
*/

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** NOVAe's e in blocks: the logo's cells, each set to pop in along a diagonal. */
function pixelE() {
  const cols = NOVAE_E[0].length;
  const rows = NOVAE_E.length;
  let blocks = "";
  NOVAE_E.forEach((row, r) => {
    for (let c = 0; c < cols; c++) {
      if (row[c] !== "#") continue;
      const cursor = r === rows - 1 ? ' class="cursor"' : "";
      const x = (c * NOVAE_CELL + 0.07).toFixed(3);
      const w = (NOVAE_CELL - 0.14).toFixed(3);
      blocks += `<rect${cursor} x="${x}" y="${r + 0.07}" width="${w}" height="0.86" style="--d:${c + rows - 1 - r}"/>`;
    }
  });
  return `<svg viewBox="0 0 ${(cols * NOVAE_CELL).toFixed(3)} ${rows}" aria-hidden="true">${blocks}</svg>`;
}

/** Tap the e: for a moment it is NOVAe's own. */
export function playNovaeE(letter: HTMLElement) {
  if (letter.dataset.pixel !== undefined || reduced()) return;
  haptic(8);
  letter.dataset.pixel = "";
  const art = document.createElement("span");
  art.className = "ph-pixel-e";
  // Only this module's own drawing goes in here, never page input.
  art.innerHTML = pixelE();
  letter.appendChild(art);
  window.setTimeout(() => {
    art.dataset.out = "";
  }, 2300);
  // The blocks animate too; only the drawing's own fade ends it.
  art.addEventListener("animationend", (e) => {
    if (e.target !== art) return;
    art.remove();
    delete letter.dataset.pixel;
  });
}

/** Tap "Lisbon": a tram runs along the footer's top line. */
export function playTram(footer: HTMLElement) {
  if (footer.querySelector(".ph-tram") || reduced()) return;
  haptic(6);
  const tram = document.createElement("span");
  tram.className = "ph-tram";
  // Only the shared drawing goes in here, never page input.
  tram.innerHTML = TRAM_SVG;
  tram.style.setProperty("--track", `${footer.clientWidth}px`);
  footer.appendChild(tram);
  tram.addEventListener("animationend", (e) => {
    if (e.target === tram) tram.remove();
  });
}

/** Taps of the cover's anvil from one change of shift to the next. */
export const NIGHT_TAPS = 150;

export const isNight = () =>
  typeof document !== "undefined" && document.documentElement.dataset.theme === "night";

/** The night shift on or off: the neon the wide build uses (phone.css), colours only on a phone. */
export function nightShift(on: boolean) {
  const root = document.documentElement;
  if (on) root.dataset.theme = "night";
  else delete root.dataset.theme;
  haptic(40);
}
