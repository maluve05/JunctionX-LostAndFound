/*
  The names of the story's formations, on their own so that pages can declare
  their sequence without importing three.js. Everything that needs three.js
  is loaded lazily, after the page is on screen.
*/

export const FORMATION_NAMES = [
  "forge",
  "year",
  "connect",
  "build",
  "ship",
  "field",
  "record",
  "handshake",
  "novae",
  "fork",
] as const;

export type FormationName = (typeof FORMATION_NAMES)[number];

export const isFormation = (s: string | undefined): s is FormationName =>
  !!s && (FORMATION_NAMES as readonly string[]).includes(s);
