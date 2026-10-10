/*
  The FORGe mark as vector data: the anvil, the hammer and every spark, traced
  from the symbol artwork. Coordinates are the symbol's own, moved so the
  anvil face under the sparks' shared origin sits at (0, 0). SVG units, y down.

  Kept free of three.js so the loading intro can draw the mark in 2D without
  pulling the 3D engine into the first load. The flat artwork itself (nav,
  footer, favicon) is never redrawn.
*/

export const IRIS = "#5A38FF";
export const LILAC = "#C4B8FF";
export const LIME = "#D6FF42";
export const MIST = "#E9EAEE";

export type LogoShard = {
  fill: string;
  /** Direction from the anvil face, in degrees from vertical. */
  angle: number;
  d: string;
};

export const LOGO_SHARDS: LogoShard[] = [
  {
    fill: IRIS,
    angle: -36,
    d: "M-114 -112 L-90 -108 L-107 -180 L-31 -82 L-44 -81 L-16 -15 L-28 -24 Z",
  },
  {
    fill: LILAC,
    angle: 34,
    d: "M14 -19 L45 -107 L50 -95 L88 -141 L65 -69 L58 -59 L54 -66 L20 -26 Z",
  },
  { fill: IRIS, angle: 60, d: "M25 -9 L111 -87 L84 -50 L72 -37 L66 -26 Z" },
  { fill: LIME, angle: -10, d: "M-29 -123 L-26 -123 L-3 -75 L-4 -57 L-8 -59 L-15 -67 L-18 -82 Z" },
  { fill: IRIS, angle: -11, d: "M-23 -67 L-15 -63 L-4 -53 L-1 -25 L3 -28 L-1 -12 L-14 -41 Z" },
  { fill: LILAC, angle: 9, d: "M3 -30 L8 -47 L6 -29 Z" },
  { fill: LILAC, angle: 1, d: "M-6 -107 L-1 -119 L2 -120 L10 -107 L2 -92 Z" },
  { fill: LILAC, angle: -61, d: "M-130 -78 L-113 -70 L-106 -54 L-125 -64 Z" },
  { fill: LILAC, angle: -61, d: "M-84 -49 L-64 -40 L-58 -29 L-76 -36 Z" },
  { fill: LIME, angle: -73, d: "M-122 -38 L-112 -40 L-84 -23 L-120 -36 Z" },
  { fill: LILAC, angle: -19, d: "M-57 -162 L-50 -155 L-50 -144 L-58 -152 Z" },
  { fill: LIME, angle: 66, d: "M70 -31 L76 -39 L87 -36 L72 -29 Z" },
  { fill: LILAC, angle: 71, d: "M104 -35 L109 -42 L114 -39 L106 -34 Z" },
  { fill: LILAC, angle: 44, d: "M106 -110 L108 -114 L111 -115 L113 -112 L108 -107 Z" },
  { fill: LILAC, angle: -71, d: "M-48 -16 L-46 -18 L-44 -17 L-42 -14 L-44 -12 Z" },
];

export const ANVIL =
  "M-129 1 L110 1 L100 21 L61 35 L43 57 L42 67 L48 82 L63 89 L66 111 L-64 111 L-61 89 L-44 82 L-39 68 L-40 56 L-48 46 L-116 18 Z M-112 9 L-8 11.5 L-98 18 L-105 15 Z M-51 100 L5 78 L-6 101 Z";
export const HAMMER_HEAD =
  "M18 -135 L4 -144 L12 -173 L41 -206 L56 -196 Z M30 -166 L44 -182 L33 -164 Z";
export const HAMMER_HANDLE = "M35 -156 L40 -166 L63 -151 L57 -141 Z";

/** Height of the whole mark in SVG units, hammer tip to anvil foot. */
export const LOGO_HEIGHT = 317;
/** Where the hammer's handle ends: the pivot it swings from. */
export const HAMMER_PIVOT = { x: 60, y: -146 };
