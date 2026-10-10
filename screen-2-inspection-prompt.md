# Lost & Found — Screen 2 (Google Lens Inspection View) + Transition — MASTER PROMPT

> **How to use this file.** Paste **everything below the horizontal rule** into your target AI coding
> model, with this repository (`Website/`) open. It is deliberately self-contained and deliberately
> narrow: one screen, one transition, mock data only. Do not trim the guardrails.
>
> It supersedes the earlier draft (`lost-and-found-inspector-prompt.md`). Where the two disagree,
> **this file wins.**

---

## ROLE

You are a senior frontend engineer on "Lost & Found" by **The Winning Team** (Junction 2026). Screen 1
(the landing / upload screen) is **finished and shipped**. Your only job in this task is to build
**Screen 2 — the Google Lens Inspection View — and the transition that carries the user into it.**

The result must read as a **precision optical instrument**, not a dashboard: a cold black canvas, obsidian
panels, hairline rules, monospace HUD readouts, and a single electric-lime signal colour. If a decision is
ambiguous, choose the option that makes it look *more* like mission-control hardware.

---

## 0. ⛔ STOP: CHALLENGE 4 IS THE ONLY CHALLENGE

**Before anything else, internalize this:**

> **⛔ STOP: CHALLENGE 4 IS THE ONLY CHALLENGE. Ignore Challenges 1, 2, and 3 completely. Do not read
> them, do not mention them, do not support them. Our only task is Challenge 4 (estimating Portugal,
> France, or Spain from a 360° panorama).**

- Challenge 4 is *"Am I at a unique place?"* — use AI agents to identify **plausible locations of 360°
  panoramas between Portugal, Spain or France**. Fewer hints ⇒ higher score.
- There are **exactly three** candidate countries and they are always **Portugal, France, Spain**, in that
  order, every time, everywhere. Never a fourth. Never a re-ordering.
- If any file, comment, mock, or asset in the repo references Challenge 1 (UNTrace), Challenge 2 (Fresh
  Eyes on Fresh Produce), or Challenge 3 (QuantumTrace) — **leave it untouched and do not surface it in any
  UI.** We are not building those, we are not acknowledging them, they do not exist for this task.

---

## 1. MISSION — WHAT YOU BUILD

Build **exactly two things**:

1. **The transition** from Screen 1 into Screen 2 — a Forge-inspired camera-shutter / optical-target-lock
   sequence. It is a *state* (`"inspecting"`) inside `App.tsx`, **not** a router and **not** a URL change.
2. **Screen 2 (`InspectionView`)** — the two-column "Google Lens" inspection view that explains *why* the
   panorama points at one country, clue by clue.

**Screen 1 is done. Do not rebuild it, restyle it, or refactor it.** You may read it for tokens and patterns
and you may add the single new seam it needs (the transition), but the landing screen's look, copy, and
layout must come out of this task **byte-identical**.

---

## 2. CONTEXT — READ THE ARCHIVED CHATS FIRST (Entry 1 and Entry 2)

**Before writing a single line, go read the previous archived chats in this project:**

- **Entry 1** — the chat that established the **Forge-inspired design language** (the canvas backdrop, the
  obsidian + electric-lime palette, the viewfinder bracket motif, the "precision instrument" tone).
- **Entry 2** — the chat that built and refined **Screen 1** (the landing / upload screen).

These two entries are the **design authority** for this task. From them, carry forward — unchanged —
the established **design tokens, typography, component structure, and state flow**:

| Carried over from Entry 1 & Entry 2 | What it is |
|---|---|
| **Design tokens** | Plain **black** canvas (`#000000`), obsidian panels (`#101017`), mist text (`#e9eaee`), Electric Lime (`#d6ff42`). No gradients, no glass, no grid. |
| **Typography** | **Space Grotesk** for display/headings, **Inter** for body/UI, **monospace** for labels, HUD readouts and numbers. |
| **Component structure** | Dumb, prop-driven components. `LandingPage` is the only Screen-1 component that knows a screen exists. Shared primitives live in `components/ui/` (`Button` with `cva` variants); motion vocabulary lives in `lib/motion.ts`. |
| **State flow** | `App.tsx` owns the screen state and the panorama. Upload hands a `PanoramaInput` to a single `onAnalyze` callback; nothing below that knows what happens next. |

**The repository on disk is the ground truth — read it, don't invent from memory:**

- [`Website/src/App.tsx`](src/App.tsx) — owns `screen` state and the `PanoramaInput`.
- [`Website/src/index.css`](src/index.css) — the `@theme` tokens, `.panel`, `.hairline`, `.bracket`, `.bg-vignette`.
- [`Website/src/lib/motion.ts`](src/lib/motion.ts) — `EASE_OUT`, `stagger`, `fadeUp`, `fadeIn`.
- [`Website/src/components/UploadZone.tsx`](src/components/UploadZone.tsx) — exports `PanoramaInput` and owns `"Find my location"`.
- [`Website/src/components/ui/button.tsx`](src/components/ui/button.tsx) — `Button` variants `primary | outline | ghost`.
- [`Website/src/components/LandingPage.tsx`](src/components/LandingPage.tsx), `Header.tsx`, `QrCard.tsx`, `StepsStrip.tsx`, `CornerBrackets.tsx`, `Background.tsx` — the Screen-1 vocabulary to match.

If the archived chats and the on-disk code ever disagree, **match the on-disk code** and say so in your
report.

---

## 3. HARD SCOPE — FRONTEND ONLY

- ✅ **Strictly client-side React.** Tailwind v4, Framer Motion, lucide-react, the existing primitives.
- ✅ **Mock / demo data only.** The inspection clues, the characteristics, the explanations and the three
  percentages are a **client-side constant array**. That is the whole "engine" for this task.
- ✅ Reuse the uploaded panorama the user already chose (`PanoramaInput.previewUrl`) as the image in both
  viewports. The zoom is a CSS transform of that same image.
- ❌ **No backend. No fetch. No API calls. No database. No model calls. No storage** (`localStorage` /
  `sessionStorage`). No environment variables, no server, no "analysis service".
- ❌ **No router, no URL changes, no history.** The transition is a state flip in `App.tsx`.
- ❌ **No new heavy dependencies.** Everything needed is already installed — see §4.
- ❌ **Do not touch Challenges 1, 2, 3** (see §0). Do not build their screens, hints, or assets.

The whole point is that this screen is **pitch-proof**: when a judge is watching, nothing may stall, spin,
or fail. Every clue is instant and local.

---

## 4. STACK — INHERIT IT, DO NOT RE-CREATE IT

Everything below is **already installed**. Use it; add nothing.

| Concern | Already in the repo | Use it for |
|---|---|---|
| Build | Vite + React 19 + TypeScript | the app |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` (CSS-first, **no** `tailwind.config.js`) | all styling |
| Animation | `framer-motion` (`motion`, `AnimatePresence`, `MotionConfig`) | the shutter + slide swaps |
| Icons | `lucide-react` | `ArrowLeft`, `ChevronLeft`, `ChevronRight`, `ArrowDown`, `Crosshair`, `Eye`, `Sparkles` |
| Variants | `class-variance-authority` + `clsx` + `tailwind-merge` | the existing `Button` |
| Fonts | `@fontsource-variable/inter`, `@fontsource-variable/space-grotesk` | already imported in `main.tsx` |

### TypeScript rules (the build must pass `tsc --noEmit` with zero output)

- **No `any`.** No `@ts-ignore` / `@ts-expect-error` / non-null `!` to silence the compiler.
- `verbatimModuleSyntax` is on: type-only imports **must** be `import type { X } from "…"`.
- `noUnusedLocals` / `noUnusedParameters` are on: delete anything you don't use.
- Type every handler and every prop. Prefer `type` aliases; `interface` only for extendable props.
- Components are prop-driven and dumb. `InspectionView` knows the screen; nothing inside it does.

---

## 5. THE TRANSITION BLUEPRINT (Forge-inspired shutter → target lock)

This is the seam between Screen 1 and Screen 2. Define it precisely.

### 5.1 State contract — inside `App.tsx`, nowhere else

```ts
type Screen = "landing" | "inspecting";
```

- `App` owns `screen: Screen`, the chosen `panorama: PanoramaInput | null`, and a transient
  `isTransitioning: boolean`.
- `handleAnalyze(input: PanoramaInput)` — called **exactly once** by the `"Find my location"` button:
  1. store the panorama,
  2. set `isTransitioning = true` (the shutter overlay appears),
  3. after the shutter (~**350 ms**; stay inside a **350–450 ms** band), set `screen = "inspecting"` and
     `isTransitioning = false`.
- `handleBack()` — the Screen-2 return action: set `screen = "landing"` and clear the panorama. The object
  URL is revoked by the existing effect in `App.tsx`; do not leak a second one.
- Screen 1 must remain **unaware** of all of this. `LandingPage` still only calls `onAnalyze`.

### 5.2 The shutter overlay — what the user sees

An `AnimatePresence`-gated, **fixed, full-bleed, `z-50`, `pointer-events-none`** overlay:

- Base: near-opaque black (`bg-black/95`), a soft blur behind it.
- Centre content, stacked vertically, in the middle of the viewport:
  - a **pulsing electric-lime reticle** — a square/rounded `border-2 border-lime` frame with a strong lime
    glow (`shadow-[0_0_40px_rgba(214,255,66,0.6)]`) doing a `pulse`;
  - beneath it, the **exact** label, monospace, uppercase, letter-spaced:
    **`ACQUIRING OPTICAL TARGET...`** — `text-lime`, `font-mono`, bold, `tracking-[0.3em]`, small.
- Fade in/out over ~0.35 s. It must feel like a **camera shutter snapping shut and a lens locking on** —
  brief, confident, mechanical. No loader spinner, no progress bar, no "Loading…".

### 5.3 The reveal

- Screen 2 mounts through the existing `AnimatePresence mode="wait"` with a quick **fade + tiny scale**
  (`opacity 0 → 1`, `scale 0.98 → 1`, ~0.35 s, `easeOut`). It should feel like the aperture re-opening on
  the now-analysed frame — not a page navigation.
- The `Background` canvas keeps running behind everything, untouched.
- **Accessibility:** under `MotionConfig reducedMotion="user"` the shutter must not animate — switch
  screens immediately — while the label and reticle remain visible for anyone who needs the status.
  The reticle itself is decorative (`aria-hidden`); the label is real text.

---

## 6. SCREEN 2 LAYOUT — DIRECT SCHEMATIC FIDELITY

Match this schematic. Two columns on a black canvas; left = the optics, right = the intelligence.

```text
┌──────────────────────────────────────┬──────────────────────────────────────────┐
│ LEFT COLUMN                          │ RIGHT COLUMN                             │
│                                      │                                          │
│  1 ─ WHOLE IMAGE        <filename>   │  [ Google Lens · Road Infrastructure ]   │
│  ┌────────────────────────────────┐  │  CLUE 01 OF 03                           │
│  │      [ animated Lens target ]  │  │                                          │
│  │   full 360° panorama (21:9)    │  │  Spanish Roadside Reflector Bollard      │
│  └────────────────────────────────┘  │                                          │
│                 │                    │  CHARACTERISTIC:                         │
│                 ▼  (connecting)      │  [ what the vision model detected ]       │
│  2 ─ ZOOM OF SPECIFIC DETAIL   2.8X  │                                          │
│  ┌────────────────────────────────┐  │  EXPLANATION:                            │
│  │  ✛ crosshair + dashed reticle  │  │  [ why it implies PT / FR / ES ]          │
│  │  magnified optical viewport    │  │                                          │
│  │  [ OPTICAL TARGET ACQUIRED ]   │  │  PROBABILITY:                            │
│  └────────────────────────────────┘  │  PORTUGAL  55%  [==============        ] │
│                                      │  FRANCE    12%  [===                  ]  │
│  < 01 / 03 >   ← Upload another      │  SPAIN     73%  [=================    ]  │
│                                      │                 ↑ LIME + "TOP MATCH"     │
└──────────────────────────────────────┴──────────────────────────────────────────┘
```

Container rules (match Screen 1's discipline):

- Screen root: `relative z-10`, full height, padded; a centred `max-w-[1240px]` content column.
- Top header bar: `"← Upload another panorama"` ghost `Button` on the **left**, the tracked-out
  `“ THE WINNING TEAM ”` wordmark in the **centre**, the slide stepper on the **right** (§6.3).
- Main: a two-column grid — `lg:grid-cols-[1.15fr_1fr]`, wide gap, both columns top-aligned.
- Everything re-enters with the shared `fadeUp` / `stagger` vocabulary from `lib/motion.ts`.

### 6.1 Left column — the dual optical viewfinder

**A. `1 ─ WHOLE IMAGE`**
- A label row: a numbered chip `1` + `WHOLE IMAGE` (mist, mono, uppercase, tracked) on the left; the
  panorama's **file name** small and dim on the right.
- A wide panorama container: `aspect-21/9`, `rounded-xl`, `border border-white/10`, black fill, deep
  shadow. Show the **full panorama** (`object-cover`).
- Overlaid on it, **the Google Lens target box** at the currently active clue's focal coordinate — anchored
  with `left`/`top` percentages, centred via `-translate-x-1/2 -translate-y-1/2`:
  - `border-2 border-lime`, rounded corners, a lime glow, and a small **`LENS LOCK`** mono tag above it;
  - it **animates in** (opacity + scale, ~0.35 s) and **re-locks** whenever the clue changes — give it a
    `key` tied to the clue id so it re-plays;
  - add faint cold **corner brackets** inset a little from the container's corners.
- **No grid, no crosshatch overlay on the whole image** — just the target box and the corner marks.

**B. Connecting indicator**
- Between the two viewports: a short vertical hairline with a small **downward chevron/arrow** in
  `lime/70`. Subtle, optical, alive. It tells the eye "this detail comes from that spot".

**C. `2 ─ ZOOM OF SPECIFIC DETAIL / CHARACTERISTIC`**
- A label row: numbered chip `2` + the label (lime here, to signal the "active" viewport), and on the
  right a mono readout with a `Crosshair` icon: **`2.8X MAGNIFIED`** (page one of the clue's zoom value).
- A `16/9` container, `rounded-xl`, `border border-lime/30`, black, with a faint lime outer glow — it should
  look like the lens has taken over the frame.
- **The magnification is CSS, on the same `previewUrl` image:** apply
  `transform: scale(<zoom>)` with `transformOrigin: "<focus.x>% <focus.y>%"`, so it magnifies *exactly* the
  region the target box locked onto. Animate it in (small scale settle, ~0.4 s) and re-play per clue with a
  `key` tied to the clue id.
- **Optical HUD overlay** (`aria-hidden`, `pointer-events-none`), layered above the image:
  - a faint radial vignette darkening the corners;
  - **hairline crosshairs** — one horizontal, one vertical, `lime/20`, through the centre;
  - a **dashed circular reticle** centred (`border border-dashed border-lime/40`);
  - **four lime corner brackets** at the viewport corners (stronger than the ones on the whole image);
  - a bottom-left status badge: a pulsing `size-1.5` lime dot + mono uppercase
    **`OPTICAL TARGET ACQUIRED`**.

### 6.2 Right column — the Google Lens intelligence card

- One **obsidian panel**: `bg-[#101017]`, `border border-white/10`, `rounded-2xl`, generous padding,
  vertical stack with clear internal rules. No blur, no glass — flat panel, crisp hairline.
- **Header block** (separated by a bottom hairline):
  - a lime pill badge with an `Eye` icon: **`Google Lens · <Type>`** — e.g. `Google Lens · Road Infrastructure`,
    `Google Lens · Architecture & Material`, `Google Lens · Biome & Flora`;
  - next to it, a dim mono counter: **`CLUE 01 OF 03`**;
  - beneath, the large **clue title** in Space Grotesk, bold, tight tracking (e.g.
    `Spanish Roadside Reflector Bollard`).
- **`CHARACTERISTIC:`** — mono uppercase label; below it, one or two sentences describing *what the vision
  model detected* in the frame.
- **`EXPLANATION:`** — mono uppercase label; below it, the **geographical attribution logic** — *why* that
  feature implies Portugal, Spain, or France (and, where useful, why it rules the others out).
- **`PROBABILITY:`** (separated by a top hairline) — mono uppercase label; the three candidate bars, always
  in this order:
  - **PORTUGAL — 55%** — neutral, muted bar;
  - **FRANCE — 12%** — neutral, muted bar;
  - **SPAIN — 73%** — the **top match**: the bar is **Electric Lime (`#d6ff42`)** with a soft lime glow, its
    label is lime, and it carries a small **`TOP MATCH`** chip.
  - Bars are `h-2.5` rounded tracks (`bg-white/[0.08]`) with fills that **animate width from 0 → value**
    (~0.6–0.7 s) and **re-animate on every clue change**. Numbers are mono. The bar widths must equal the
    stated percentages.

### 6.3 Controls

- **Slide switcher** — `< 01 / 03 >`: `ChevronLeft` / `ChevronRight` ghost buttons flanking a mono counter,
  in the header bar (top-right), and mirrored as compact `Previous` / `Next Clue` buttons plus dot
  indicators at the bottom of the card. The active dot is a lime pill; inactive dots are dim white and
  clickable. Wrapping from the last clue returns to the first (`(prev + 1) % length`).
- **`← Upload another panorama`** — a ghost `Button` with `ArrowLeft`, top-left, calling the `onBack`
  prop to return to the landing screen (clearing the panorama). This is the **only** way back.

### 6.4 Slide data contract (mock)

```ts
type ClueSlide = {
  id: number;
  category: string;          // "Google Lens · Road Infrastructure"
  title: string;             // "Spanish Roadside Reflector Bollard"
  characteristic: string;    // what the model saw
  explanation: string;       // the geographic attribution logic
  probabilities: { portugal: number; france: number; spain: number }; // 55 / 12 / 73
  focus: { x: number; y: number; zoom: number };  // x/y in %, zoom ≈ 2.4–3.2
};
```

- Ship **exactly three** slides so the `01 / 03` stepper is real. Use the three above (road furniture,
  granite masonry, Atlantic biome) with Spain as the top match at 73% in the first slide, and keep each
  slide internally consistent (the top match should stay the lime, `TOP MATCH`-chipped bar).
- Keep the mock array in the module (or a small `lib/` file). No fetching, ever.

---

## 7. DESIGN RULES (inherit Screen 1 — do not drift)

- **Page background is plain black `#000000`. There is NO grid pattern, NO aurora, NO colored gradient.**
  The only backdrop life is the existing canvas particle field (`Background`), which stays as-is.
- **Panels:** obsidian **`#101017`**, 1px hairline **`rgb(255 255 255 / 0.08)`**, deep soft shadow, a crisp
  inner top highlight. Flat — never frosted, never glassy.
- **Type:** mist **`#e9eaee`** for text; **Space Grotesk** for display/headings; **Inter** for body/UI;
  **monospace** for every label, HUD readout, counter and coordinate.
- **Electric Lime `#d6ff42` is the one signal colour** and appears **only** on: the lens target box, the
  optical HUD (crosshair/reticle/brackets/status), the `Google Lens` badge, the active stepper state, the
  `TOP MATCH` bar and its chip, and the shutter reticle. Everything else is mist/white at low opacity on
  black. Colour is a privilege, not a default.
- **Motion:** one vocabulary from `lib/motion.ts` (`EASE_OUT`, `fadeUp`, `fadeIn`). Fades and small rises
  only. Nothing loops except the deliberate pulse on the shutter reticle and the `OPTICAL TARGET ACQUIRED`
  dot. Wrap the tree in `<MotionConfig reducedMotion="user">`.
- **Tailwind v4 gotchas:** gradients are `bg-linear-*` (not `bg-gradient-*`); use `size-*`, not `h-* w-*`;
  arbitrary opacity is `bg-white/[0.03]`; arbitrary shadows use `_` for spaces; `@theme` tokens (e.g.
  `text-lime`, `bg-surface`, `font-display`) are real utilities.
- **Accessibility:** every decorative layer (HUD, brackets, target box, reticle, dividers) gets
  `aria-hidden`; the shutter reticle is decorative while its `ACQUIRING OPTICAL TARGET...` label is text;
  stepper buttons carry `aria-label`s; body copy stays at ≥ 4.5:1 contrast on black.

---

## 8. FILE LAYOUT

Keep Screen 1 untouched except for the one seam. Add only:

```text
src/
├── App.tsx                          # + the Screen-2 seam: "inspecting" state + shutter overlay
└── components/
    ├── InspectionView.tsx           # Screen 2: header bar + two-column optical layout + controls
    └── (optional, only if it helps)
        ├── LensTargetBox.tsx        # the animated "LENS LOCK" box on the whole image
        ├── OpticalZoomViewport.tsx  # the 16:9 magnified viewport + HUD overlay
        └── ProbabilityBars.tsx      # the three animated country bars
```

Split only if it genuinely improves clarity; a single well-organized `InspectionView.tsx` is acceptable.
Do **not** create a router, a context, a store, or a service layer.

---

## 9. MOTION & TIMING CHEAT SHEET

| Beat | Duration | Easing | Notes |
|---|---|---|---|
| Shutter overlay in/out | ~0.35 s | `easeInOut` | near-opaque black + lime reticle pulse |
| Shutter hold before reveal | ~350 ms total | — | inside the 350–450 ms band |
| Screen-2 mount | ~0.35 s | `easeOut` | `opacity 0→1`, `scale 0.98→1` |
| Target box re-lock | ~0.35 s | `easeOut` | re-plays per clue via `key` |
| Zoom viewport settle | ~0.4 s | `easeOut` | `scale` from ~1.1 → 1 on the crop |
| Probability bars | ~0.6–0.7 s | `easeOut` | `width 0 → value %`, per clue |
| Card content swap | ~0.25 s | `EASE_OUT` | `AnimatePresence mode="wait"` |

---

## 10. DEFINITION OF DONE

A change is complete only when **all** of these hold:

1. `npm run typecheck` (`tsc --noEmit`) exits 0 with **no output**.
2. `npm run build` succeeds.
3. `npm run dev` serves the app with **zero console errors or warnings**.
4. From Screen 1, clicking **`Find my location`** plays the shutter (`ACQUIRING OPTICAL TARGET...`) and then
   lands on Screen 2 — **no routing, no URL change, no reload**.
5. Screen 2 shows **two columns**: the whole panorama with an animated lime **`LENS LOCK`** target box, the
   connecting indicator, and the **2.8×** magnified optical viewport with crosshairs, dashed reticle, lime
   corner brackets and the **`OPTICAL TARGET ACQUIRED`** badge.
6. The right panel shows `Google Lens · <Type>`, the clue title, **`CHARACTERISTIC:`**, **`EXPLANATION:`**,
   and **`PROBABILITY:`** bars for **Portugal 55% / France 12% / Spain 73%**, with **Spain** in Electric Lime
   and a **`TOP MATCH`** chip.
7. The stepper (`< 01 / 03 >`) moves through **three** distinct clues; switching a clue re-locks the target
   box, re-frames the zoom, swaps the card text (no layout jump) and re-animates the bars.
8. **`← Upload another panorama`** returns cleanly to Screen 1 and the panorama object URL is revoked.
9. The palette is exactly: **plain black** canvas with **no grid**, obsidian `#101017` panels, mist
   `#e9eaee` text, and Electric Lime `#d6ff42` as the only accent.
10. With `prefers-reduced-motion: reduce`, the shutter does not animate (screens switch immediately) and
    nothing translates or loops.
11. No `any`, no `@ts-ignore`, no unused locals, no new dependencies, no backend/API/DB/model calls.
12. **Nothing in the UI references Challenges 1, 2, or 3.**

---

## 11. DO NOT

- Do not build, mention, support, or "helpfully add" Challenges 1, 2, or 3. Challenge 4 is the only one.
- Do not rebuild, restyle, or refactor **Screen 1** beyond the single `App.tsx` transition seam.
- Do not add a router, a state library, a context, a service, or a URL change.
- Do not call an API, a model, a database, or any backend. The clues and percentages are **mock data**.
- Do not add a fake progress bar or a "Loading…" spinner — the shutter *is* the transition.
- Do not reintroduce the grid, frosted glass, aurora gradients, or rainbow cycling borders.
- Do not hard-code a new colour that is not in §7. Lime is the only accent.
- Do not use `localStorage`/`sessionStorage` to persist anything.
- Do not present a fourth country or reorder Portugal / France / Spain.

---

## 12. DELIVERABLE

When you are done, report back with:

1. The list of files **created or changed** (and confirm Screen 1 was not restyled).
2. The exact commands you ran and their results (`typecheck`, `build`, `dev`).
3. A short note on anything in this spec you could **not** satisfy, and why — rather than silently
   substituting your own design decision.
