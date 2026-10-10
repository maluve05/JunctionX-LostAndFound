import type { Slide } from "./Stories";
import { PHOTOS_2025, RECAP_2025_URL } from "./content";

/*
  FORGe 2025 as stories to tap through (Stories.tsx): the wide build's 2025
  photo flight opens here. Composed from content.ts; no new facts.
*/

const P = PHOTOS_2025.map((ph) => ph.src);
// 0 builders at work, 1 the room, 2 mentors, 3 the night shift, 4 the finish

/** FORGe 2025 in five photographs. */
export const STORIES_2025: Slide[] = [
  { kicker: "FORGe 2025, 7 and 8 November", title: "Heads down, clock running." },
  { kicker: "The room", title: "120 builders. Every table full." },
  { kicker: "On the floor", title: "Mentors at the tables." },
  { kicker: "The night shift", title: "24 hours, straight through." },
  {
    kicker: "The finish",
    title: "30 teams. Arms up.",
    cta: { label: "See the 2025 recap", href: RECAP_2025_URL },
  },
].map((s, i) => ({ ...s, src: P[i], alt: PHOTOS_2025[i].alt }));
