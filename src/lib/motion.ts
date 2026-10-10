/**
 * Shared motion tokens.
 *
 * The screen uses one vocabulary only: things rise 14-18px and fade in, in a
 * staggered order, with a long soft ease-out. Nothing loops, nothing bounces.
 */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** The aperture shutter closing: accelerates into full cover. Opening uses `EASE_FORGE`. */
export const EASE_IN_OUT: [number, number, number, number] = [0.55, 0, 0.35, 1];

/**
 * The Forge curve — this repository's signature "fluid" ease, taken from the
 * Forge reference build (`forge2026-main/forge2026-main/src/styles.css`, the
 * `--ease-out` declaration). Used only for mechanical moves: the aperture
 * blades opening and the camera morph. Content entrances keep `EASE_OUT`.
 */
export const EASE_FORGE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Parent: staggers its `fade-up` children, top to bottom. */
export const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.085,
      delayChildren: 0.06,
    },
  },
};

/** Child: the one entrance used across the screen. */
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT },
  },
};

/** Child: a slower fade, for large surfaces that should not move much. */
export const fadeIn = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.6, ease: EASE_OUT },
  },
};
