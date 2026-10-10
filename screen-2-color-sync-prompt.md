# Lost & Found — Screen 2 Colour Signal & Insight Cards — MASTER PROMPT

> **How to use this file.** Screen 2 already exists and works (built from `screen-2-inspection-prompt.md`,
> then refined by `screen-2-refinement-prompt.md`, then given its hierarchy by `screen-2-hierarchy-prompt.md`).
> This is the **fourth pass**. Paste **everything below the horizontal rule** into Freebuff with this
> repository (`Website/`) open. Do not re-derive the design language, do not redesign anything.
>
> **The pass, in one line each:** (1) the active clue's colour stops being a garnish and becomes the screen's
> **signal** — one clue colour drives twelve bindings, from the crop box to the primary button, and it is
> verified against the DOM; (2) clue 3's colour becomes **vibrant orange `#f97316`** (it is amber `#fbbf24`
> today); (3) the two paragraphs (`CHARACTERISTIC:` / `EXPLANATION:`) and their headings are **deleted** and
> replaced by a **2 × 2 grid of four compact obsidian insight cards** per clue; (4) the last clue gains a
> primary **`Reveal Final Results →`** button wired to a new optional **`onViewResults`** prop — which
> **supersedes** the hierarchy pass's rule that the last clue's primary button becomes a backward one.
>
> **No third-party vision-product brand appears anywhere in this document or in the result.** The screen is
> branded only as the team's own model.

---

## ROLE

You are a senior frontend engineer on **Lost & Found** by *The Winning Team* (Junction 2026). Screen 1
(landing) and Screen 2 (the inspection view) are both **already built, refined and working**. Your job is
**exactly the changes in §1** — one colour signal bound everywhere, four insight cards per clue, one new
action on the last clue. Nothing else.

**The whole change is surgical:** `Website/src/components/InspectionView.tsx` (the bulk),
three token lines in `Website/src/index.css`, and a four-line prop wiring in `Website/src/App.tsx`.
`lib/motion.ts` is **not touched** in this pass.

Forty minutes of restraint beats a redesign: if a decision is ambiguous, choose the option that makes the
screen look *more* like a precision optical instrument and *less* like a dashboard.

---

## 0. GUARDRAILS THAT STILL BIND

> **⛔ CHALLENGE 4 IS THE ONLY CHALLENGE.** Ignore Challenges 1, 2, and 3 completely. Do not read them, do not
> mention them, do not support them. Our only task is Challenge 4 (estimating Portugal, France, or Spain from a
> 360° panorama).

- **Frontend only.** Strictly client-side React. Mock data only. **No backend, no fetch, no API, no database,
  no model calls, no storage, no router, no URL changes.** **No new dependencies** — every icon in §3 is
  already in the installed `lucide-react`.
- **Screen 1 is frozen.** Do not restyle, refactor, or "improve" the landing screen. Colours stay lime-only
  there.
- **Read before you write.** [`Website/src/components/InspectionView.tsx`](src/components/InspectionView.tsx),
  [`Website/src/App.tsx`](src/App.tsx), [`Website/src/index.css`](src/index.css),
  [`Website/src/lib/motion.ts`](src/lib/motion.ts), [`Website/src/components/ui/button.tsx`](src/components/ui/button.tsx),
  [`Website/src/components/UploadZone.tsx`](src/components/UploadZone.tsx) (exports `PanoramaInput`). The code
  on disk is the ground truth; do not invent from memory.
- **⛔ THE ZOOM MATH IS LOAD-BEARING — DO NOT REGRESS IT.** `CropBox {x,y,w,h}` (fractions of the panorama
  pane), the highlight drawn at `x/y/w/h %`, the zoom layer sized `(100/w)% × (100/h)%` and offset
  `-(x/w)%` / `-(y/h)%`, the zoom pane's derived `aspectRatio: (w/h) * PANE_ASPECT`, `object-cover` on both
  images, `ring-*` (never `border`/padding) on both panes, the four-box `0.80 ≤ w/h ≤ 0.90` band, and **no
  transform inside the zoom viewport**. This pass changes the *colour* of those elements and nothing else
  about them.
- **This pass changes no crop box, no percentage, no clue title, no radius, no tier and no copy that §3 does
  not explicitly rewrite.**
- **TypeScript gates:** `tsc --noEmit` must exit 0 with **no output**. No `any`, no `@ts-ignore`, no unused
  imports (`noUnusedLocals` is on — deleting a block means deleting its icon imports too).

---

## 0.5 THE COLOUR RULE THIS PASS REWRITES

The hierarchy pass allowed the clue colour in five places and insisted **everything else keeps Electric
Lime** (its §7 and §11). **This pass supersedes both.** The rule is now:

> **The active clue's colour is the inspection screen's signal.** Every element that carries emphasis —
> the target rectangle, the magnified viewport, the meter, the header badge, the insight cards, the leading
> probability row and the primary action — binds to `currentClue.accent`. It is **never more than one clue
> colour at a time**, and everything with no emphasis role stays mist / white / hairline grey.

The bounded list is §2.4. Nothing outside it may take a clue colour. Screen 1 stays lime-only.

---

## 1. WHAT CHANGES — SUMMARY

| # | Change | File | What happens |
|---|---|---|---|
| 1 | **Vibrant orange for clue 3** | `index.css` | `--color-tier-street` becomes `#f97316`, plus a `-strong` tint `#fb923c` for the button hover and the soft glows. Amber `#fbbf24` is gone from the screen. |
| 2 | **One accent object, twelve slots** | `InspectionView.tsx` | `TierAccent` grows to `ClueAccent`: badge wash, card hairline, solid control, corner brackets and the existing ring / glow / bar / chip / fill slots — all literal class strings. |
| 3 | **Colour bound everywhere** | `InspectionView.tsx` | Crop box, zoom pane, both corner-bracket sets, meter fill + radius + active chip, clue badge, insight cards, leader row, `TOP MATCH` chip, primary buttons, active stepper dot. One hue at a time, and it **cross-fades** over the 0.62 s camera move instead of snapping. |
| 4 | **Insight cards** | `InspectionView.tsx` | `characteristic` / `explanation` and their two JSX blocks are **deleted**; every clue gains `insights: Insight[]` — exactly four — rendered as a `grid-cols-2` of obsidian cards with an accent icon, a mono label and one bite-sized fact. |
| 5 | **Reveal Final Results** | `InspectionView.tsx` + `App.tsx` | New optional prop `onViewResults?: () => void`; on the last clue a primary `Reveal Final Results →` button renders in the nav row **next to** the outline `← Previous Clue` (superseding the hierarchy pass §8). |
| 6 | **Test hooks for the colour** | `InspectionView.tsx` | Thirteen `data-*` hooks so §8's probe can read every bound element without eyeballing a screenshot. |

**No new imports beyond the icons of §3** — and delete what the deletion orphans. `Fragment`, `Eye`,
`Sparkles`, `cn`, `Button`, the motion values and the camera effect all stay.

---

## 2. THE SIGNAL — ONE COLOUR PER CLUE, BOUND EVERYWHERE

### 2.1 The three colours

| Clue | Tier | Colour | Hex | Reads as |
|---|---|---|---|---|
| 1 | `COUNTRY` | Electric Lime | `#d6ff42` | the existing signal colour — the widest claim |
| 2 | `CITY` | Sky Blue | `#38bdf8` | the regional claim |
| 3 | `STREET` | Vibrant Orange | `#f97316` | the street-level claim (was amber `#fbbf24`) |

Two existing lines in [`Website/src/index.css`](src/index.css) inside `@theme` change, and one is added
(`-strong` mirrors the established `--color-lime-strong` naming):

```css
  /* Clue signal — one colour per clue, bound to the active clue across the whole
     inspection screen (colour prompt §2.4). Never more than one at a time; the
     clue's tier name and radius are always real text, so colour is never the only
     carrier of meaning. Clue 1 keeps electric lime, the repository's signal colour. */
  --color-tier-city: #38bdf8;
  --color-tier-street: #f97316;
  --color-tier-street-strong: #fb923c;
```

The comment block above those lines in `index.css` currently says tier colour "may appear solely where the
hierarchy prompt allows" — **rewrite that comment**, it is now wrong. `#fbbf24` must appear nowhere in
`Website/src/` after this pass.

### 2.2 The accent object — literal class strings only

**Do not build class names dynamically** (`text-${colour}`) — Tailwind cannot see them and the colours vanish
in the production build. Each clue carries a frozen object of literal classes:

```ts
interface ClueAccent {
  /** accent type on the panel: radius readout, badge text, card labels, leader row */
  text: string;
  /** the clue badge only: a low-alpha wash + hairline of the clue colour */
  badge: string;
  /** the insight cards' hairline — the badge wash is far too heavy for four of them */
  cardRing: string;
  /** the crop box ring on the panorama */
  ring: string;
  /** the crop box's glow */
  glow: string;
  /** the zoom pane's hairline */
  ringSoft: string;
  /** the zoom pane's softer outer glow */
  paneGlow: string;
  /** the panorama's corner brackets (the zoom pane reuses `text`) */
  corner: string;
  /** the filled controls: the primary nav button and Reveal Final Results */
  solid: string;
  /** the `TOP MATCH` chip */
  chip: string;
  /** the leader's probability bar */
  bar: string;
  /** the luminous micro-fills: the meter fill and the active stepper dot */
  fill: string;
}

const ACCENT_COUNTRY: ClueAccent = {
  text: "text-lime",
  badge: "bg-lime/10 ring-lime/25",
  cardRing: "ring-lime/20",
  ring: "ring-lime",
  glow: "shadow-[0_0_18px_rgba(214,255,66,0.45)]",
  ringSoft: "ring-lime/30",
  paneGlow: "shadow-[0_0_30px_rgba(214,255,66,0.12)]",
  corner: "text-lime/40",
  solid:
    "bg-lime text-black shadow-[0_12px_30px_-14px_rgb(214_255_66/0.6)] hover:bg-lime-strong focus-visible:ring-lime/45 active:bg-lime-strong",
  chip: "bg-lime/20 text-lime",
  bar: "bg-lime shadow-[0_0_12px_rgba(214,255,66,0.6)]",
  fill: "bg-lime shadow-[0_0_10px_rgba(214,255,66,0.55)]",
};

const ACCENT_CITY: ClueAccent = {
  text: "text-tier-city",
  badge: "bg-tier-city/10 ring-tier-city/25",
  cardRing: "ring-tier-city/20",
  ring: "ring-tier-city",
  glow: "shadow-[0_0_18px_rgba(56,189,248,0.45)]",
  ringSoft: "ring-tier-city/30",
  paneGlow: "shadow-[0_0_30px_rgba(56,189,248,0.14)]",
  corner: "text-tier-city/40",
  solid:
    "bg-tier-city text-black shadow-[0_12px_30px_-14px_rgb(56_189_248/0.6)] hover:bg-tier-city/90 focus-visible:ring-tier-city/45 active:bg-tier-city/90",
  chip: "bg-tier-city/20 text-tier-city",
  bar: "bg-tier-city shadow-[0_0_12px_rgba(56,189,248,0.6)]",
  fill: "bg-tier-city shadow-[0_0_10px_rgba(56,189,248,0.55)]",
};

const ACCENT_STREET: ClueAccent = {
  text: "text-tier-street",
  badge: "bg-tier-street/10 ring-tier-street/25",
  cardRing: "ring-tier-street/20",
  ring: "ring-tier-street",
  glow: "shadow-[0_0_18px_rgba(249,115,22,0.5)]",
  ringSoft: "ring-tier-street/35",
  paneGlow: "shadow-[0_0_30px_rgba(251,146,60,0.16)]",
  corner: "text-tier-street/45",
  solid:
    "bg-tier-street text-black shadow-[0_12px_30px_-14px_rgb(249_115_22/0.65)] hover:bg-tier-street-strong focus-visible:ring-tier-street/45 active:bg-tier-street-strong",
  chip: "bg-tier-street/20 text-tier-street",
  bar: "bg-tier-street shadow-[0_0_12px_rgba(249,115,22,0.6)]",
  fill: "bg-tier-street shadow-[0_0_10px_rgba(249,115,22,0.55)]",
};
```

The `rgba()` in a glow mirrors its hex on purpose (lime `214,255,66`; sky `56,189,248`; orange
`249,115,22`, with the softer `251,146,60` for the wide pane glow). Keep the numbers and the hexes in step.

**Why `solid` has to override five separate things.** `<Button>` with no `variant` renders the default
`primary` variant, and that variant hardcodes **lime** in five places: `bg-lime`, `text-ink`, a lime
elevation glow (`shadow-[0_12px_30px_-14px_rgb(214_255_66/0.7)]`), the base's lime focus ring
(`focus-visible:ring-lime/45`) and `active:bg-lime-strong`. Because `Button` composes them as
`cn(buttonVariants({variant, size}), className)`, a `solid` passed as `className` is the **later** class in
every one of those groups, so `twMerge` drops the primitive's value — which is why each `solid` slot above
ends with its own accent-coloured `shadow-[…]`, `focus-visible:ring-…`, `hover:…` and `active:…`.
**Measured, not assumed:** merging the real composition for the sky accent leaves
`… bg-tier-city text-black shadow-[0_12px_30px_-14px_rgb(56_189_248/0.6)] hover:bg-tier-city/90 focus-visible:ring-tier-city/45`,
with the primitive's lime `bg-lime`, lime shadow and lime focus ring all gone — but **`active:bg-lime-strong`
survives unless `solid` overrides it**, which is why the `active:` class is in the slot. Get one of these
wrong and the pressed or focused button turns lime; §8.2's `primary action` row is what catches it.

`TIERS`, `TIER_ORDER`, the radii (±300 / ±50 / ±5 km) and the convergence values (33 / 66 / 100) are
**unchanged** — the `accent` field in each `TIERS` entry is simply the object above.

### 2.3 The cross-fade — the colour moves with the camera

The camera morph takes 0.62 s. Colour must not snap on frame one. **Every accent element that lives
*outside* the clue-swapping `AnimatePresence`** — the meter fill, the radius readout, the tier chips, the
active stepper dot, the crop box, the zoom pane and its corner brackets — takes:

```
transition-[color,background-color,border-color,box-shadow] duration-500
```

so the hue eases across the move, in step with §5 of the hierarchy pass. Elements *inside* the swap (badge,
title block, insight cards, leader row, buttons) already remount with their own fade and need nothing.
Do **not** animate colour with a spring, and do not hold the old colour back with a delay.

> **Merge gotcha, read twice.** `cn()` is `twMerge(clsx(...))`, so two utilities from the same group in one
> call collapse to the **last** one — and that applies to `bg-*` (colour) *and* to `shadow-*` alike. Never
> put a `bg-*` from the accent object next to a `bg-*` of your own on the same element, and never add a
> second `shadow-[…]` to a button that already has one (a later shadow does not *add* to the earlier one, it
> replaces it). That is exactly why the badge wash is its own `badge` slot, why the cards carry only
> `cardRing`, and why the button glow lives **inside** `solid` instead of being passed alongside it. An
> insight card keeps `bg-surface-2`; the accent reaches it through the ring and the icon.

### 2.4 THE BOUND ELEMENTS — exactly these, nothing else

| # | Element | Where it is today | Now | Hook |
|---|---|---|---|---|
| 1 | Crop box ring + glow | `accent.ring` / `accent.glow` | unchanged binding | `data-crop-box` *(exists)* |
| 2 | Zoom pane hairline + glow | `accent.ringSoft` / `accent.paneGlow` | unchanged binding | `data-pane="zoom"` *(exists)* |
| 3 | **Zoom pane corner brackets** | `tone={accent.text}` | keep — now brighter: `accent.text` at full strength | — |
| 4 | **Panorama corner brackets** | `tone="text-white/25"` | **`accent.corner`** | — |
| 5 | Meter radius readout | `accent.text` | unchanged | `data-meter-radius` |
| 6 | Meter convergence fill | `accent.fill` *(was `dot`)* | unchanged, plus the cross-fade | `data-meter-fill` |
| 7 | Active tier chip | `accent.text` + `ring-white/10` + `bg-white/[0.06]` | keyword stays tinted but its **ring becomes the accent** (`accent.badge` for the wash is fine here) | `data-tier-chip` + `data-active` |
| 8 | **Clue category badge** | text only: `bg-white/[0.05] ring-white/10` + `accent.text` | **replace the white wash with `accent.badge`**, keep `accent.text` — the badge is now the header's colour anchor | `data-clue-badge` |
| 9 | **Insight cards** | *(new)* | icon + label in `accent.text`, hairline `accent.cardRing`, surface `bg-surface-2` | `data-insight-card` |
| 10 | Leader probability row | rank index, country, value, bar, `TOP MATCH` chip | unchanged bindings | `data-leader`, `data-country`, `data-bar` |
| 11 | **Primary nav button** | hardcoded `bg-lime font-semibold text-black hover:bg-lime/90` | **`accent.solid`** — it is the loudest control on the screen and it must agree with the clue | `data-action="primary"` |
| 12 | **Active stepper dot** | hardcoded `w-6 bg-lime` | **`accent.fill`** (keep the `w-6` pill growth) | `data-dot` + `data-active` |
| 13 | **Reveal Final Results** | *(new, §4)* | `accent.solid` (its shadow is already the clue-coloured glow) | `data-action="reveal-results"` |

**Deliberate restraints — do not "finish the job" on these:**

- **The display title stays mist.** `text-3xl xl:text-4xl` in a saturated hue fights the crop box for
  attention and the badge right above it already carries the colour. The clue's colour owns the *chrome*,
  the title owns the *words*.
- **Passed and upcoming tier chips stay neutral** (`text-white/45` / `text-white/25`). Giving each chip its
  own hue would put three clue colours on screen at once, which §0.5 forbids. The meter shows **one** hue:
  the active clue's.
- **Inactive stepper dots stay `bg-white/20`** for the same reason.
- The `PREVIOUS CLUE` outline button, the `CLUE n OF m` counter, the `PROBABILITY:` and
  `ESTIMATED LOCATION CONFIDENCE` captions, the `← Upload another panorama` back button and the header's
  `‹ ›` chevrons stay mist / white. The clue colour must never become a *background wash* on the panel
  itself.

---

## 3. THE INSIGHT CARDS — 2 × 2, FOUR PER CLUE

### 3.1 The data contract

The two paragraphs go away. In their place, every clue carries four facts:

```ts
import type { LucideIcon } from "lucide-react";   // type-only; the icons themselves ship in lucide-react

interface Insight {
  /** one of the icons listed in §3.2 — already installed, no new dependency */
  icon: LucideIcon;
  /** mono, uppercase, ≤ 3 words */
  label: string;
  /** one sentence, ≤ 14 words. A fact, never a sentiment. */
  fact: string;
}

interface ClueSlide {
  id: number;
  tier: Tier;
  category: string;
  title: string;
  /** exactly four, rendered 2 × 2 in this order */
  insights: Insight[];
  probabilities: Probability[];
  /** fractions of the panorama pane; 0.80 ≤ w/h ≤ 0.90 — untouched by this pass */
  box: CropBox;
}
```

`characteristic` and `explanation` are **removed from the interface and from all three records**, and the two
JSX blocks that render them are deleted. Nothing else in the records changes: ids, tiers, categories, titles,
probabilities and boxes stay byte-for-byte.

### 3.2 The copy — use it as written

All twelve facts below describe the team's actual Galician analysis
([`Research And Implementation/dev/mocks/report_road_galicia.json`](../Research%20And%20Implementation/dev/mocks/report_road_galicia.json)
and `report_text_galicia.json`). Do not rewrite them into prose.

**Clue 1 — `COUNTRY` · Spanish Roadside Reflector Bollard**

```ts
insights: [
  { icon: Ruler,      label: "Marker profile",  fact: "White cylindrical post, roughly a metre tall, square flat top." },
  { icon: Signpost,   label: "Reflector band",  fact: "One horizontal amber band on a plain white barrel." },
  { icon: Trees,      label: "Flora",           fact: "Clipped eucalyptus line behind it — a Galician timber-plot signature." },
  { icon: Compass,    label: "Excludes",        fact: "Not Portugal's black plastic delineator, nor France's red-capped post." },
],
```

**Clue 2 — `CITY` · Granite Rubble-Stone Perimeter Wall**

```ts
insights: [
  { icon: Mountain,    label: "Material",     fact: "Grey granite rubble, hand-jointed, no dressed courses anywhere." },
  { icon: Layers,      label: "Capping",      fact: "Weathered terracotta coping tiles running along the head." },
  { icon: Microscope,  label: "Patina",       fact: "Atlantic moss and lichen bloom — a wet, salt-air coast." },
  { icon: MapPin,      label: "Distribution", fact: "Galicia and Asturias over the Minho; not central or southern France." },
],
```

**Clue 3 — `STREET` · White-on-Red N-634 Route Plate**

```ts
insights: [
  { icon: Tag,         label: "Plate",     fact: "White lettering on a red field — a Spanish national-route plate." },
  { icon: Route,       label: "Route",     fact: "N-634, the Cantabrian-coast national road, Lugo into Asturias." },
  { icon: TrafficCone, label: "Roadside",  fact: "Chevron-edged asphalt with a moss-darkened kerb beneath it." },
  { icon: Crosshair,   label: "Bounds",    fact: "Narrows the answer from a province to one stretch between villages." },
],
```

Every one of those icons exists in the installed `lucide-react` (`Ruler`, `Signpost`, `Trees`, `Compass`,
`Mountain`, `Layers`, `Microscope`, `MapPin`, `Tag`, `Route`, `TrafficCone`, `Crosshair`). `Waves` does
**not** exist in this version — do not reach for it.

### 3.3 The grid and the card

`grid-cols-2` — four cards, two columns, two rows, equal heights, at **every** breakpoint (the panel is one
column below `lg` and the cards are short enough that two per row still read at 375 px). The grid sits
**where the two paragraphs sat**: after the title block, before the probability block.

```tsx
{/* INSIGHTS: four facts, 2 × 2 */}
<ul className="grid grid-cols-2 gap-3 [@media(max-height:960px)]:gap-2.5">
  {currentClue.insights.map((insight, index) => {
    const Icon = insight.icon;

    return (
      <motion.li
        key={insight.label}
        data-insight-card
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: EASE_OUT, delay: COPY_DELAY + index * 0.04 },
        }}
        className={cn(
          "flex items-start gap-2.5 rounded-xl bg-surface-2 p-3.5 ring-1",
          "shadow-[0_10px_26px_-18px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.04)]",
          "[@media(max-height:960px)]:p-3",
          accent.cardRing,
        )}
      >
        <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", accent.text)} />

        <div className="min-w-0 space-y-1">
          <p className={cn("font-mono text-[10px] font-semibold tracking-[0.18em] uppercase", accent.text)}>
            {insight.label}
          </p>
          <p className="text-[13px] leading-snug text-white/70">{insight.fact}</p>
        </div>
      </motion.li>
    );
  })}
</ul>
```

**Rules for the card:**

- **Solid obsidian, subtly shaded — not glass.** `bg-surface-2` (the existing `#14141d` token) sits one
  step above the panel's `#101017`, with a hairline ring in the clue colour, a soft downward elevation
  shadow and a 1px inset top highlight. **No** `backdrop-blur`, no gradient, no left border bar.
- **Icon top-left, label above fact, both left-aligned.** Icon `size-4`, `shrink-0`; label mono
  `text-[10px]` uppercase with the accent; fact `text-[13px]` in `text-white/70`. Never centre the text,
  never uppercase the fact.
- `min-w-0` on the text column so a long word cannot push the card wider than its cell.
- The four cards arrive **staggered by 0.04 s** behind the existing `COPY_DELAY` (0.18 s), so the eye reads
  them left-to-right after the camera lands. If `motion.li` does not typecheck against the installed
  `framer-motion`, fall back to plain `<li>` and let the parent block's single fade carry them — do **not**
  hand-roll a CSS animation, and do not add a motion library.
- Colour comes only from `accent.cardRing` + `accent.text` (§2.4). The fact text is never tinted.

---

## 4. REVEAL FINAL RESULTS — THE LAST CLUE'S PRIMARY ACTION

### 4.1 The prop contract

```tsx
export interface InspectionViewProps {
  panorama: PanoramaInput;
  onBack: () => void;
  /** Fires when the presenter asks for the final results from the last clue. */
  onViewResults?: () => void;
}
```

Optional on purpose: `InspectionView` must still work with no handler (the button then does not render), and
the results screen itself is **not** part of this pass.

### 4.2 The nav row, and what it supersedes

The hierarchy pass (§8) made the last clue's primary button turn into `← Previous Clue` and removed the
secondary. **That is superseded.** The row now reads:

| Clue | Left (dots) | Right |
|---|---|---|
| 1 | three dots, active = clue colour | disabled outline `← Previous Clue` + primary `Next Clue →` |
| 2 | three dots | outline `← Previous Clue` + primary `Next Clue →` |
| 3 | three dots | outline `← Previous Clue` + primary **`Reveal Final Results →`** |

So the last clue gets a **dedicated** primary action next to the previous control, never a second
backwards button and never a duplicate. The header's `‹ ›` chevrons keep their current behaviour
(disabled at the ends, never wrapping) and the `n / 3` counter and the dots' click-to-jump stay untouched.

```tsx
{/* Bottom Navigation: forward until the last clue, which reveals the results */}
<div className="mt-auto flex items-center justify-between gap-4 pt-4 [@media(max-height:960px)]:pt-3">
  <div className="flex items-center gap-1.5">
    {CLUE_SLIDES.map((clue, index) => (
      <button
        key={clue.id}
        type="button"
        data-dot
        data-active={slideIndex === index}
        onClick={() => setSlideIndex(index)}
        aria-label={`Go to clue ${index + 1}`}
        className={cn(
          "size-2 cursor-pointer rounded-full transition-all",
          slideIndex === index ? cn("w-6", accent.fill) : "bg-white/20 hover:bg-white/40",
        )}
      />
    ))}
  </div>

  <div className="flex shrink-0 items-center gap-2">
    <Button
      variant="outline"
      size="sm"
      data-action="prev"
      onClick={goPrev}
      disabled={isFirst}
      className="border-white/10 text-white/80 hover:bg-white/10 disabled:opacity-35"
    >
      <ChevronLeft className="size-4" />
      Previous Clue
    </Button>

    {isLast ? (
      onViewResults && (
        <Button
          size="sm"
          data-action="reveal-results"
          onClick={onViewResults}
          className={cn("font-semibold", accent.solid)}
        >
          Reveal Final Results
          <ArrowRight className="size-4" />
        </Button>
      )
    ) : (
      <Button
        size="sm"
        data-action="primary"
        onClick={goNext}
        className={cn("font-semibold", accent.solid)}
      >
        Next Clue
        <ChevronRight className="size-4" />
      </Button>
    )}
  </div>
</div>
```

- `data-action="primary"` marks whichever button occupies the primary slot, so §8's probe can find it on
  clues 1–2 and the reveal button on clue 3.
- The reveal button uses `accent.solid` — which already ends in an accent-coloured elevation glow and its
  own focus ring (§2.2).
  **Do not pass `accent.glow` next to it**: both are `shadow-[…]` utilities, so the later one would replace
  the button's elevation shadow instead of adding to it. It is the most luminous control on the screen on the
  last clue because it is the only primary action there, not because it stacks shadows.
- `ArrowRight` joins the existing lucide import; nothing else new is imported.
- **Keep `hover:bg-white/40` on the inactive dots only**, as the snippet does. It is a hover-variant
  background, so it is *not* dropped by the merge when the accent's `bg-*` is added: left on the active dot
  it would grey the clue colour out the moment the presenter's mouse crossed it.
- **No second row, no full-width button, no modal.** The nav row must not wrap: at 1280 px the panel's inner
  width is ~524 px and the two labels need ~280 px together, which fits. If it *does* wrap at any viewport,
  demote the secondary to an icon-only `←` button with `aria-label="Previous clue"` — never shrink the type
  and never let a label break onto two lines.

### 4.3 The `App.tsx` wiring

Four lines, and the handler is a **seam**, not a screen:

```tsx
  /** Screen 3 seam: the results screen is a later pass. This pass ships the
   *  button and the prop only — the handler must not navigate, fake a results
   *  screen, or log to the console. */
  const handleViewResults = () => {};

  …

  <InspectionView panorama={panorama} onBack={handleBack} onViewResults={handleViewResults} />
```

The screen state machine, the aperture shutter, the object-URL revocation and `Background` are all
**untouched**. Do not add a `"results"` member to the `Screen` union in this pass.

---

## 5. THE HEIGHT BUDGET — CARDS ARE SHORTER THAN THE PROSE THEY REPLACE

The panel's copy volume is still what sets the row height (hierarchy pass §6). Two paragraphs with two
headings ≈ 182 px become two card rows of 79 px each plus a 12 px gap ≈ 170 px, so the panel should land
**at or slightly under the 788 px it measures today at 1440×900** — i.e. still **zero page scroll at
1440×900 and 1920×1080**. Measured on this implementation: **788 px / 740 px / 968 px** at 1440×900 /
1280×720 / 1920×1080, with **0 px of page scroll at 900 and 1080** and **132 px at 1280×720** (down from
154 px — the panel is still what sets the row there, not the panes; §12 has the full record).

- Keep the existing height-aware spacing trims (`[@media(max-height:960px)]:gap-5`, `…:p-8`, `…:pt-5`,
  `…:space-y-2.5`) and extend them to the grid gap and the card padding as shown in §3.3.
- **If the panel overflows, take the space from spacing, not from type.** The fact text stays `text-[13px]`
  and the cards stay at least three lines tall; never drop a card, never pair two facts into one card, never
  `overflow-hidden` the panel.
- Report the **measured** panel height and page overflow at 1440×900, 1920×1080 and 1280×720 in the
  deliverable. A number in this document that measurement contradicts is a number to correct, not to honour.

---

## 6. ACCESSIBILITY & MOTION

- Colour is **never the only carrier of meaning** (WCAG 1.4.1): the clue's radius (`±5 km`), the tier chips
  and the insight labels are all real text. Keep them.
- Contrast of every accent on the panel (`#101017`) must be **≥ 4.5:1** — measured expectations are
  ≈ 16.5 (lime), ≈ 8.8 (sky) and ≈ 6.8 (orange). Black type on the accent buttons is ≥ 7.5:1 on all three.
  §8 has the snippet; if a tier fails, darken that tier's `text` usage rather than the copy.
- The insight grid is a real `<ul>` / `<li>`; the icons are `aria-hidden`; the label and fact are text.
- The reveal button is a real `<button>` with visible focus (the `Button` primitive's focus ring stays) and
  a plain-text label. No `aria-live`, no tooltip.
- Motion comes only from [`Website/src/lib/motion.ts`](src/lib/motion.ts) — `EASE_OUT` for the card stagger,
  the existing `EASE_FORGE` camera morph and the existing copy delay. **Nothing new loops while idle**, and
  the app-wide `MotionConfig reducedMotion="user"` keeps the reduced-motion path intact (the colour
  cross-fade is a colour transition, which is fine under reduced motion).

---

## 7. DESIGN RULES (restated)

- Plain **black** canvas, no grid, no gradients. Obsidian **`#101017`** panels, **`#14141d`** cards, mist
  **`#e9eaee`** text. Accents: lime `#d6ff42`, sky `#38bdf8`, orange `#f97316` / `#fb923c` — one clue colour
  at a time, in the §2.4 places only.
- **Space Grotesk** display, **Inter** body, **monospace** for labels, numbers and card labels.
- Tailwind v4: `bg-linear-*` (not `bg-gradient-*`), `size-*` not `h-* w-*`, opacity as `ring-white/10` /
  `bg-white/[0.08]`; `ring-*` is a box-shadow and takes **no layout space**; **class names must be literal
  strings**; and remember the `twMerge` background collision of §2.3.
- Responsiveness is unchanged: below `lg` the inspection screen is still a single column, with the cards two
  per row.

---

## 8. VERIFICATION — READ IT OFF THE DOM, NOT BY EYE

### 8.1 The hooks (add all thirteen)

| Hook | On |
|---|---|
| `data-accent={currentClue.tier}` | the screen's root `<div>` |
| `data-meter-radius` | the `±N km` readout in `PrecisionMeter` |
| `data-meter-fill` | the convergence fill `motion.div` |
| `data-tier-chip` + `data-active` | each of the three tier chips |
| `data-clue-badge` | the `VISUAL INTELLIGENCE · …` badge |
| `data-insight-card` | each of the four `<li>` cards |
| `data-leader` | the leading probability row's wrapper |
| `data-country` | the country-name `<span>` inside the leading row |
| `data-bar` | each probability bar's `motion.div` |
| `data-action="primary"` | the `Next Clue →` button |
| `data-action="prev"` | the outline `← Previous Clue` button |
| `data-action="reveal-results"` | the `Reveal Final Results →` button |
| `data-dot` + `data-active` | each stepper dot |

### 8.2 The colour probe — one run per clue, **wait 600 ms after the clue change**

The cross-fade takes 500 ms, so reading immediately gives you the *previous* clue's colour. Land on the
clue, wait, then run:

```js
(() => {
  const HEX = { COUNTRY: "#d6ff42", CITY: "#38bdf8", STREET: "#f97316" };
  // the wide zoom-pane glow uses the lighter orange tint for STREET (§2.2)
  const SOFT = { STREET: "rgba(251, 146, 60," };
  // the corner brackets are alpha-tinted, and this engine computes those as oklab(),
  // so they are checked against a reference element carrying the expected class.
  const CORNER = { COUNTRY: ["text-lime/40", "text-lime"], CITY: ["text-tier-city/40", "text-tier-city"], STREET: ["text-tier-street/45", "text-tier-street"] };
  const root = document.querySelector("[data-accent]");
  const tier = root.dataset.accent;
  const n = parseInt(HEX[tier].slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const want = { rgb: `rgb(${r}, ${g}, ${b})`, rgba: `rgba(${r}, ${g}, ${b},` };
  const read = (sel, prop) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el)[prop] : "MISSING";
  };
  const row = (name, sel, prop, glow = false) => {
    const got = read(sel, prop);
    const ok = glow
      ? [want.rgba, SOFT[tier]].filter(Boolean).some((p) => got.includes(p)) || got.includes(want.rgb)
      : got === want.rgb;
    return { element: name, expected: glow ? `${want.rgba} …)` : want.rgb, got: got.slice(0, 62), ok };
  };
  const corner = (name, sel, cls) => {
    const ref = document.createElement("div");
    ref.className = cls;
    document.body.appendChild(ref);
    const expected = getComputedStyle(ref).color;
    ref.remove();
    const got = read(sel, "borderTopColor");
    return { element: name, expected: `same as ${cls}`, got: got.slice(0, 40), ok: expected === got };
  };
  console.table([
    row("meter radius", "[data-meter-radius]", "color"),
    row("meter fill", "[data-meter-fill]", "backgroundColor"),
    row("active tier chip", "[data-tier-chip][data-active='true']", "color"),
    row("clue badge", "[data-clue-badge]", "color"),
    row("card icon", "[data-insight-card] svg", "color"),
    row("card label", "[data-insight-card] p", "color"),
    row("leader country", "[data-leader] [data-country]", "color"),
    row("leader bar", "[data-leader] [data-bar]", "backgroundColor"),
    row("primary action", "[data-action='primary'], [data-action='reveal-results']", "backgroundColor"),
    row("primary shadow", "[data-action='primary'], [data-action='reveal-results']", "boxShadow", true),
    row("active dot", "[data-dot][data-active='true']", "backgroundColor"),
    row("crop box glow", "[data-crop-box]", "boxShadow", true),
    row("zoom pane glow", "[data-pane='zoom']", "boxShadow", true),
    corner("panorama corner", "[data-pane='panorama'] span", CORNER[tier][0]),
    corner("zoom corner", "[data-pane='zoom'] span", CORNER[tier][1]),
  ]);
})();
```

**Every row must be `ok: true`, on all three clues** — fifteen rows × three clues. Report the tables. The
`primary action` and `primary shadow` rows are the ones that catch every leak in §2.2: if a clue's button
still computes to `rgb(214, 255, 66)` or casts a lime halo, the primitive's variant is still winning. Run it
**only when one clue's subtree is in the DOM** (`document.querySelectorAll('[data-clue-badge]').length === 1`)
— the panel's content swaps through `AnimatePresence`, so during a swap the outgoing button, dots and cards
are still mounted and a bare `querySelector` can read the previous clue.
(The `[data-active]` attribute renders as the string `"true"`; the selector above matches it.)

### 8.3 The grid probe

```js
(() => {
  const cards = [...document.querySelectorAll("[data-insight-card]")];
  const rects = cards.map((c) => c.getBoundingClientRect());
  console.table({
    count: cards.length,                                              // want 4
    columns: new Set(rects.map((r) => Math.round(r.left))).size,       // want 2
    rows: new Set(rects.map((r) => Math.round(r.top))).size,           // want 2
    equalWidths: new Set(rects.map((r) => Math.round(r.width))).size === 1,  // want true
    shortestCardHeight: Math.round(Math.min(...rects.map((r) => r.height))), // report
  });
})();
```

### 8.4 The reveal-button probe

1. On clues 1 and 2: `[data-action='reveal-results']` returns `null`, and `[data-action='primary']` is the
   `Next Clue →` button.
2. On clue 3: `[data-action='reveal-results']` exists with the label `Reveal Final Results`, the tab order
   still reaches both nav buttons, and the row does not wrap (its `offsetHeight` stays one line).
3. **Then** — for the duration of this check only — change the `App.tsx` seam to
   `const handleViewResults = () => console.count("view-results");`, click the button, confirm the count
   increments and the console stays free of errors, and **restore the inert seam**. Report both numbers.

### 8.5 Contrast

```js
const contrast = (fg, bg) => {
  const lum = (c) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return ((hi + 0.05) / (lo + 0.05)).toFixed(2);
};
console.table({
  lime: contrast([214, 255, 66], [16, 16, 23]),
  sky: contrast([56, 189, 248], [16, 16, 23]),
  orange: contrast([249, 115, 22], [16, 16, 23]),
});   // all must be >= 4.5
```

### 8.6 Regression checks that must still pass

- Hierarchy pass §10's crop-box snippet at rest **and** mid-morph: every value `< 0.001` on all three clues,
  at 1440×900 and 1280×720. **The colour pass must not have touched the zoom math** — prove it.
- The meter still grows 33 → 66 → 100 without passing through zero (sample the fill width through a change).
- The zoom pane is still the tallest element of the left stack; no crop box leaves `[0.80, 0.90]`.
- `prefers-reduced-motion: reduce`: no blades and no camera morph (both are driven by
  `useReducedMotion` / `MotionConfig reducedMotion="user"`). The colour cross-fade of §2.3 is **kept** — it is
  a colour change, not motion — so do not add `motion-reduce:transition-none` on that account.
- Zero console errors or warnings at every step.

---

## 9. DEFINITION OF DONE

1. `npm run typecheck` exits 0 with **no output**; `npm run build` succeeds; `npm run dev` shows **zero**
   console errors or warnings.
2. **Orange:** clue 3 is `#f97316` everywhere, the button hover is `#fb923c`, and `#fbbf24` appears nowhere
   in `Website/src/`.
3. **Signal:** the §8.2 probe returns `ok: true` for **all twelve rows on all three clues**; no element
   outside §2.4 carries a clue colour; the hue cross-fades over ~0.5 s rather than snapping. The primary
   button's background, elevation glow, hover/active state and focus ring are all the clue colour on every
   clue — **no lime leaks through** from the `Button` primitive's default variant (§2.2).
4. **Cards:** each clue renders **exactly four** cards in a **2 × 2** grid with equal widths and the §3.2 copy
   verbatim; `characteristic` and `explanation` no longer exist in the file or the interface; no paragraph
   prose survives anywhere in the panel.
5. **Results action:** `onViewResults?: () => void` exists; the last clue renders the outline
   `← Previous Clue` **and** the primary `Reveal Final Results →` in one non-wrapping row; clues 1–2 render
   no reveal button; the click probe increments its counter and throws nothing; the shipped handler stays
   inert and the `Screen` union is unchanged.
6. **Contrast:** all three clue colours ≥ 4.5:1 on `#101017` (report the three ratios).
7. **No regressions:** hierarchy pass §10's box snippet `< 0.001` at rest and mid-morph, meter grows
   33 → 66 → 100, zoom pane tallest, all crop boxes inside `[0.80, 0.90]`, no page scroll at 1440×900 or
   1920×1080 — with the measured panel height and overflow reported for all three viewports.
8. **Scope:** no new dependencies, no network, Screen 1 untouched, and only `InspectionView.tsx`,
   `index.css` and `App.tsx` changed (`lib/motion.ts` is not touched in this pass).

---

## 10. DO NOT

- Do not build class names dynamically, and do not put two `bg-*` utilities from different sources on one
  element (§2.3 — `twMerge` will silently drop one).
- Do not let two clue colours appear at once: no per-tier chip hues, no per-slide dot hues, no gradient
  between tiers, no colour blending during the morph.
- Do not put a clue colour on the display title, the panel background, the `PROBABILITY:` captions, the back
  button, the header chevrons or the `CLUE n OF m` counter.
- Do not keep `characteristic` / `explanation` "just in case", and do not render them as a collapsed
  fallback, a tooltip or a smaller paragraph.
- Do not add a fifth card, merge two facts into one card, or reorder the four.
- Do not add a results screen, a route, a modal, a state member or a fake placeholder — this pass ships the
  prop and the button only.
- Do not reintroduce `setTimeout`-driven transitions, `backdrop-blur`, loaders or spinners.
- Do not touch the crop boxes, the probabilities, the radii, the tiers, the camera morph, the aperture
  shutter, the meter's position or the clue titles.
- Do not add dependencies or call anything over the network. Leave the unreferenced `AnalyzingView.tsx`
  alone.

---

## 11. DELIVERABLE

Report back with:

1. The files changed and, for each, a one-line summary of the diff.
2. The exact commands run (`typecheck`, `build`, `dev`) and their results.
3. The §8.2 colour table for **each** clue (twelve rows each), the §8.3 grid table, the §8.4 button checks
   with both counter values, and the §8.5 contrast ratios.
4. The measured panel height and page overflow at 1440×900, 1920×1080 and 1280×720.
5. Confirmation that the hierarchy-pass zoom snippet still returns `< 0.001` at rest and mid-morph.
6. Anything in this spec you could **not** satisfy, and why — never a silent substitution.

---

## 12. MEASURED ON THIS IMPLEMENTATION — EVIDENCE, NOT REQUIREMENTS

Recorded on 2026-10-10 against the dev server at `127.0.0.1:5173`, 1440×900, with the Challenge-04 demo image
uploaded. Everything above this line is the spec; this section is what the run actually returned, kept so the
next pass can tell a regression from a coincidence.

| Check | Result |
|---|---|
| §8.2 colour probe, 15 rows × 3 clues | **45/45 `ok`** (lime / `rgb(56,189,248)` / `rgb(249,115,22)`) |
| §8.3 grid | 4 cards, 2 columns, 2 rows, equal widths, shortest card **79 px** |
| §8.4 buttons | clues 1–2: `Next Clue` only; clue 3: outline `Previous Clue` + `Reveal Final Results`, one row of **44 px**, no wrap |
| §8.4 hook fires | instrumented seam logged `view-results: 1`; the screen stayed on Screen 2, clue 3/3 |
| §8.5 contrast on `#101017` | lime **16.46**, sky **8.84**, orange **6.76** (all ≥ 4.5) |
| zoom exactness at rest | worst **0.000794** (1440×900), **0.000546** (1280×720) — all `< 0.001` |
| zoom exactness mid-morph | **109** frames sampled 3 → 2, worst size **0.000691**, aspect **0.000281**, left **0.000216**, top **0.000314** |
| box aspect band | 0.889 / 0.900 / 0.846 — inside `[0.80, 0.90]` |
| panes | panorama 286 / 252 / 334 px; zoom 322 / 298 / 395 px — the zoom pane is the tallest element everywhere |
| page overflow | **0** px at 1440×900 and 1920×1080; **132** px at 1280×720 (both panes still in the fold, the zoom pane's last ~3 px below it) |
| convergence meter | aria `33 → 66 → 100`, never through zero |
| `Button` variant leaks | clue-3 primary classes carry `bg-tier-street`, orange `shadow-[…]`, `hover:bg-tier-street-strong`, `focus-visible:ring-tier-street/45`, `active:bg-tier-street-strong` — no `bg-lime`, no lime shadow, no `active:bg-lime-strong` |
| screen-swap stability | one badge, one `aside`, 3 dots, 4 cards once settled (`AnimatePresence` overlap only during a swap) |

Two traps this run confirmed the hard way, both already handled in §2.2 and §8: the wide zoom-pane glow on
clue 3 is the **lighter** orange (`rgba(251,146,60,…)`), not the base hex, and this engine reports
alpha-tinted colours (`/40`, `/45`) as `oklab(…)`, so a hex string comparison can never match them — hence the
reference-element check for the corner brackets in §8.2.

**Not exercised:** `prefers-reduced-motion: reduce` (no media-emulation hook on this browser surface, so the
reduced-motion branch is code- and type-level only), and the clue copy's crop boxes still sit on the
Challenge-04 poster rather than an equirect panorama — the boxes and the street-tier copy become honest
together when a real panorama is uploaded.
