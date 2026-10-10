# Lost & Found — Screen 3: Below the Two-Column Breakpoint

## Context

Screen 3 (`Website/src/components/ResultsView.tsx`) is built and shipped: six ranked candidates on the left, the same six places on a dark Leaflet map on the right, the panorama dissolving into the map on entry, and a `map-halo` / `map-grid` field behind the panel.

It is a **desktop composition only**. The grid is `grid-cols-1 lg:grid-cols-[430px_minmax(0,1fr)]`, so below 1024 px the two columns stack — nine hundred-odd pixels of list and card, then a 340 px map band, then the back button — which is **taller than a laptop viewport**. Measured at 900 × 800: 301 px of vertical scroll, and the map (the point of the screen) sits below the fold.

Your single deliverable is `Website/src/components/ResultsView.tsx`, plus whatever narrow-viewport rules `Website/src/index.css` genuinely needs. **Do not change the desktop composition**: at `lg` and above the screen must measure exactly as it does today.

---

## What to Build

### Narrow layout (below `lg`)

```
┌──────────────────────────────────────────────────────┐
│  MOST PROBABLE COORDINATES (BY ORDER)                │
│   01 Galicia, Spain             86%                  │
│   ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁               │
│   … six rows, tighter padding, one bar each …        │
│  ┌────────────────────────────────────────────────┐  │
│  │ ◉ MOST PROBABLE  Galicia, Spain   43.010,−8.170│  │  ← winner card, one line
│  └────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│                                                      │
│                 FULL-WIDTH MAP                       │  ← fills the rest
│                                                      │
├──────────────────────────────────────────────────────┤
│  [ ← Back to Clues ]                                 │  ← full width
└──────────────────────────────────────────────────────┘
```

**The rule is one viewport, no scroll.** The screen becomes a viewport-locked column
(`h-dvh` at narrow only, `min-h-0` all the way down the flex chain) whose second grid
row is `minmax(0, 1fr)`, so the map absorbs whatever height the list leaves. If the
content genuinely cannot fit (below ~720 px tall at this width), the App wrapper — which is
`overflow-x-hidden`, so its `overflow-y` computes to `auto` — becomes the scroll container
and everything stays reachable. Verified at 1000 × 560, where the 160 px floor binds: the
wrapper scrolls 141 px and the button ends fully visible (bottom 552 of 560). That is the
fallback, not the design.

### What collapses on narrow, and why

| Element | Narrow behaviour | Reasoning |
|---|---|---|
| Ranking rows | Tighter padding, smaller label type, same three lines | The rows are the answer; they stay. Compact, not hidden. |
| Winner card's three tiles (flag / city / coords) | Hidden (`max-lg:hidden`); the same facts move into the card's single header line | Three stacked tiles cost ~150 px for three short strings. |
| Panorama film-strip | Hidden (`max-lg:hidden`) | A 36 px decorative toggle that eats a row of the budget, and its "peek" is a desktop flourish. |
| Map | Full width, `flex-1`, floor raised to `min-h-[160px]` | It is the hero of the screen, not the afterthought. The floor is deliberately low: 160 px keeps 1000 × 720 (the narrowest, shortest window in the target range) free of any scroll, and only binds when the window is shorter than that. |
| Back button | Full width (`max-lg:w-full`) | Touch target, and it reads as the screen's exit. |

Everything above is done with `max-lg:` variants and **one** narrow-only coords span
inside the winner card. No second component, no `useMediaQuery`, no markup fork.

---

## Design Constraints

- **No new dependencies, no `matchMedia` in JS.** This is a CSS-composition problem.
- **Desktop must not move.** `lg` keeps `grid-cols-[430px_minmax(0,1fr)]`, the row
  padding, the three-card tiles, the film strip, and the centred, `size="lg"` button.
- Colours come from the token palette (`text-lime`, `bg-surface-2`, …) — never a hex literal.
- Narrow spacing uses the same rhythm as everywhere else: `px-5 py-4`, `gap-3`, not ad-hoc numbers.
- The `map-halo`'s negative insets must not create horizontal overflow; the app wrapper is
  `overflow-x-hidden`, so they clip — keep it that way.
- Reduced motion is unaffected: nothing here adds an animation.

---

## File Checklist

| File | Change |
|---|---|
| `Website/src/components/ResultsView.tsx` | Viewport-locked narrow layout, compact rows, one-line winner card, hidden strip, full-width button |
| `Website/src/index.css` | One line: `@source not "../*-prompt.md"`, so no prompt doc can feed the class scan (see below). Every narrow rule itself is a Tailwind variant. |

---

## Verification

1. `npm run typecheck` and `npm run build` both exit 0.
2. At **900 × 800**: zero vertical scroll, zero horizontal overflow, six rows, the map
   full width with all six pins inside the aura, the back button full width.
3. At **1024 × 800** (the breakpoint edge): still the two-column grid, zero scroll of either kind.
4. At **1280 × 720** and **1440 × 900**: the desktop composition is unchanged — same row
   alignment against the winner card, same six rows, same map box, no scroll.
5. The reveal choreography still runs at narrow widths: panorama dissolves, pins land, camera
   pulls back, one scan sweep.
6. Console clean on entry and after a row click.

---

## Found while verifying

The candidate popup was **clipped** at narrow widths. The card is ~134 px tall while a
narrow map is ~250 px, and it opens above its pin (`offset: [0, -10]`) — at zoom 9 the pin
sits mid-frame, so the card's top ~41 px hung past the panel's `overflow-hidden` edge.
Two changes fix it, both in `ResultsView.tsx`:

- the popup binds with `autoPan: true, autoPanPadding: [18, 18]` — off was right on a
  792 px desktop map and wrong the moment the map got short;
- a row click now opens the card on `moveend` (with a 950 ms timer as backstop, because
  `moveend` never fires when the camera was already there), so Leaflet's auto-pan runs
  after our `flyTo` instead of against it.

Verified at 900 × 800: rows 1, 3, 6 and a direct marker click all land the card fully
inside the map — its 134 px box starts 18 px below the map's top edge and ends 152 px in,
inside a 248 px map.

### Prompt docs were inflating the stylesheet

This file is a document, and Tailwind's automatic source detection scans `.md` files, so
the class names in its code fences were being compiled into the shipped CSS. The repo
already guarded one doc by hand (`@source not "../lost-and-found-forge-prompt.md"`); one
line now covers all of them. Measured: **88,872 → 82,240 bytes** (18.19 → 17.70 kB gzip),
with the app unchanged — the landing screen, the clue screen and this screen all render and
measure identically after the cut.
