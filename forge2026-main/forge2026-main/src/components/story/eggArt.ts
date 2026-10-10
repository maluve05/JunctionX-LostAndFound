/*
  Drawings for the small secrets, free of three.js and GSAP so both builds
  can use them (story/eggs.ts on wide screens, phone/eggs.ts on phones).
*/

/*
  NOVAe's e, as its logo draws it: a pixel e over a cursor line, traced cell by
  cell from /brand/novae/logo-long-white.webp. The logo's cells are a little
  wider than tall (6.1 by 5.3), and the e keeps that. The 3D scene sets its
  shards in it (formations.ts); on phones the letter turns into it.
*/
export const NOVAE_E = [
  "...#####...",
  "..#######..",
  ".##.....##.",
  ".#..###..#.",
  "##.#####.##",
  "##.......##",
  "##.......##",
  ".#.#######.",
  ".#..#####..",
  ".##........",
  "..#######..",
  "...#####...",
  "...........",
  ".#########.",
];
export const NOVAE_CELL = 6.1 / 5.3;

/** A Lisbon tram, drawn like the hero's doodles: body, windows, door, wheels, pole. */
export const TRAM_SVG =
  '<svg viewBox="0 0 72 44" aria-hidden="true">' +
  '<path d="M4 14h60v20H4ZM9 14v-4h50v4M11 19h9v7h-9ZM24 19h9v7h-9ZM37 19h9v7h-9ZM52 19h7v15"/>' +
  '<path d="M38 10 50 2m-3 0h7"/>' +
  '<circle cx="16" cy="37" r="3.5"/><circle cx="52" cy="37" r="3.5"/>' +
  '<path class="tram-spark" d="M54 2h.01"/>' +
  "</svg>";
