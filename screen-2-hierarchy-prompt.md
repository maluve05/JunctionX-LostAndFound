# Lost & Found — Screen 2 Hierarchical Precision — MASTER PROMPT

> **How to use this file.** Screen 2 already exists and works (built from `screen-2-inspection-prompt.md`,
> then refined by `screen-2-refinement-prompt.md`). This is the **third pass**: it turns the flat clue list
> into a three-tier geolocation hierarchy. Paste **everything below the horizontal rule** into Freebuff with
> this repository (`Website/`) open. Do not re-derive the design language, do not redesign anything.
>
> **The pass, in one line each:** (1) every clue becomes a tier — Country ±300 km → City ±50 km → Street
> ±5 km; (2) a precision meter sits at the top of the right panel with a convergence bar at 33 % → 66 % →
> 100 %; (3) probabilities become an explicitly ranked, strictly descending list that tightens as the radius
> narrows; (4) each tier owns a colour; (5) the zoom stops popping and becomes an animated camera move that
> is **still pixel-exact on every frame**; (6) the two image viewports get taller; (7) the last clue's
> forward button turns into a backward one.
>
> **No third-party vision-product brand appears anywhere in this document or in the result.** The screen is
> branded only as the team's own model.

---

## ROLE

You are a senior frontend engineer on **Lost & Found** by *The Winning Team* (Junction 2026). Screen 1
(landing) and Screen 2 (the inspection view) are both **already built, refined and working**. Your job is
**exactly the changes in §1** — a hierarchy, a meter, a colour per tier, a camera move, taller viewports and
smarter navigation. Nothing else.

**The whole change is surgical:** `Website/src/components/InspectionView.tsx` (the bulk), two tokens in
`Website/src/index.css`, one easing token in `Website/src/lib/motion.ts`, and a two-line easing swap in
`Website/src/App.tsx`.

Forty minutes of restraint beats a redesign: if a decision is ambiguous, choose the option that makes the
screen look *more* like a precision optical instrument and *less* like a dashboard.

---

## 0. GUARDRAILS THAT STILL BIND

> **⛔ CHALLENGE 4 IS THE ONLY CHALLENGE.** Ignore Challenges 1, 2, and 3 completely. Do not read them, do not
> mention them, do not support them. Our only task is Challenge 4 (estimating Portugal, France, or Spain from a
> 360° panorama).

- **Frontend only.** Strictly client-side React. Mock data only. **No backend, no fetch, no API, no database,
  no model calls, no storage, no router, no URL changes.** No new dependencies.
- **Screen 1 is frozen.** Do not restyle, refactor, or "improve" the landing screen.
- **Read before you write.** [`Website/src/components/InspectionView.tsx`](src/components/InspectionView.tsx),
  [`Website/src/App.tsx`](src/App.tsx), [`Website/src/lib/motion.ts`](src/lib/motion.ts),
  [`Website/src/index.css`](src/index.css), [`Website/src/components/UploadZone.tsx`](src/components/UploadZone.tsx)
  (exports `PanoramaInput`). The code on disk is the ground truth; do not invent from memory.
- **⛔ THE ZOOM MATH IS LOAD-BEARING — DO NOT REGRESS IT.** `CropBox {x,y,w,h}` (fractions of the panorama
  pane), the highlight drawn at `x/y/w/h %`, the zoom layer sized `(100/w)% × (100/h)%` and offset
  `-(x/w)%` / `-(y/h)%`, the zoom pane's derived `aspectRatio: (w/h) * PANE_ASPECT`, `object-cover` on both
  images, `ring-*` (never `border`/padding) on both panes, and **no transform inside the zoom viewport**.
  That combination is what makes the boxed region and the zoom show identical pixels. §5 keeps it true while
  animating; §6 gives you the height budget you must stay inside.
- **TypeScript gates:** `tsc --noEmit` must exit 0 with **no output**. No `any`, no `@ts-ignore`, no unused
  imports (`noUnusedLocals` is on — deleting a badge means deleting its icon import too).

---

## 0.5 BRANDING — STRIP THE THIRD-PARTY NAME

The three `category` strings and one section comment in `InspectionView.tsx` still carry a third-party
vision-product brand as their prefix. **Delete that prefix everywhere.** Every `category` value must read
`VISUAL INTELLIGENCE · <TYPE>`:

```ts
category: "VISUAL INTELLIGENCE · ROAD INFRASTRUCTURE",
category: "VISUAL INTELLIGENCE · ARCHITECTURE & MATERIAL",
category: "VISUAL INTELLIGENCE · ROAD SIGNAGE & MARKING",
```

Also delete the `/* DETAIL TITLE - (...) */` comment that names it. **Check:** every `category:` value in
`Website/src/` begins with `VISUAL INTELLIGENCE ·`, and searching `Website/src/` for the vendor name that
sits in those three lines today returns **nothing** — in code, in comments, and on screen. The historical
prompt docs under `Website/*-prompt.md` are records of past passes — leave them alone.

---

## 1. WHAT CHANGES — SUMMARY

| # | Change | File | What happens |
|---|---|---|---|
| 1 | **Three tiers** | `InspectionView.tsx` | Every clue gains `tier: "COUNTRY" \| "CITY" \| "STREET"` with its radius (±300 / ±50 / ±5 km), convergence (33 / 66 / 100) and accent. |
| 2 | **Precision meter** | `InspectionView.tsx` | New `PrecisionMeter`, the **first thing at the top of the right panel, directly above the title**, showing the active tier, the radius, a convergence track and the three tier chips. Lives **outside** the clue-swap so the bar grows *between* tiers. |
| 3 | **Ranked probabilities** | `InspectionView.tsx` | Probabilities become an array sorted **strictly descending** by value, escalating per tier: 78/55/23 → 86/38/9 → 94/16/3. |
| 4 | **A colour per tier** | `index.css` + `InspectionView.tsx` | Two new tokens (`#38bdf8`, `#fbbf24`); tier 1 keeps Electric Lime. Applied only where §7 allows. |
| 5 | **Animated camera zoom** | `InspectionView.tsx` | The crop box is interpolated by a single tween; highlight, zoom layer and pane aspect are all pure functions of the live values, so the mapping stays exact on **every** frame. |
| 6 | **Taller viewports** | `InspectionView.tsx` | Every crop box lands in `0.80 ≤ w/h ≤ 0.90`, so the zoom pane becomes the tallest element of the left stack; the stack gap and page padding tighten to pay for it. |
| 7 | **Next / last-clue nav** | `InspectionView.tsx` | Clues 1–2: `Next Clue →`. Clue 3: the primary button *becomes* `← Previous Clue`. No wrap-around anywhere. |
| 8 | **The Forge curve** | `lib/motion.ts` + `App.tsx` | One new token `EASE_FORGE = [0.16, 1, 0.3, 1]` for mechanical moves (blade opening, camera morph). Content entrances keep `EASE_OUT`. |

**New imports** — add only what §2–§9 actually need, and delete what the change orphans (`noUnusedLocals` is
on): `Fragment` and `useEffect` from `react`; `animate`, `useMotionValue`, `useTransform`,
`useReducedMotion` — plus `useMotionValueEvent` only if you take the §5.2 fallback — from `framer-motion`;
`EASE_FORGE` alongside the existing `EASE_OUT` and `fadeUp` from `@/lib/motion`. `cn` is already imported and
the meter needs it.

---

## 2. THE THREE TIERS — DATA CONTRACT

### 2.1 Tier metadata

| Tier | Radius | Convergence | Accent | What the tier claims |
|---|---|---|---|---|
| `COUNTRY` | ±300 km | 33 | Electric Lime `#d6ff42` | "this is Spain, not Portugal or France" — country-scale standards |
| `CITY` | ±50 km | 66 | Sky `#38bdf8` | "this is the Galician corner" — regional material culture |
| `STREET` | ±5 km | 100 | Amber `#fbbf24` | "this is *this* stretch of road" — a sign, a marker, an asphalt detail |

### 2.2 Accents are literal class strings

**Do not build class names dynamically** (`text-${colour}`) — Tailwind cannot see them and the colours will
vanish in the production build. Each tier carries a frozen object of literal classes:

```ts
interface TierAccent {
  /** reads on a dark panel: the radius readout, the category badge, the tier chip */
  text: string;
  /** the crop box ring on the panorama */
  ring: string;
  /** the zoom pane's hairline */
  ringSoft: string;
  /** the crop box's glow on the panorama (rgba mirrors the hex) */
  glow: string;
  /** the zoom pane's softer outer glow */
  paneGlow: string;
  /** the leader's probability bar */
  bar: string;
  /** the `TOP MATCH` chip */
  chip: string;
  /** the convergence fill + the active tier chip */
  dot: string;
}

const ACCENT_COUNTRY: TierAccent = {
  text: "text-lime",
  ring: "ring-lime",
  ringSoft: "ring-lime/30",
  glow: "shadow-[0_0_18px_rgba(214,255,66,0.45)]",
  paneGlow: "shadow-[0_0_30px_rgba(214,255,66,0.12)]",
  bar: "bg-lime shadow-[0_0_12px_rgba(214,255,66,0.6)]",
  chip: "bg-lime/20 text-lime",
  dot: "bg-lime shadow-[0_0_10px_rgba(214,255,66,0.55)]",
};

const ACCENT_CITY: TierAccent = {
  text: "text-tier-city",
  ring: "ring-tier-city",
  ringSoft: "ring-tier-city/30",
  glow: "shadow-[0_0_18px_rgba(56,189,248,0.45)]",
  paneGlow: "shadow-[0_0_30px_rgba(56,189,248,0.14)]",
  bar: "bg-tier-city shadow-[0_0_12px_rgba(56,189,248,0.6)]",
  chip: "bg-tier-city/20 text-tier-city",
  dot: "bg-tier-city shadow-[0_0_10px_rgba(56,189,248,0.55)]",
};

const ACCENT_STREET: TierAccent = {
  text: "text-tier-street",
  ring: "ring-tier-street",
  ringSoft: "ring-tier-street/30",
  glow: "shadow-[0_0_18px_rgba(251,191,36,0.45)]",
  paneGlow: "shadow-[0_0_30px_rgba(251,191,36,0.14)]",
  bar: "bg-tier-street shadow-[0_0_12px_rgba(251,191,36,0.6)]",
  chip: "bg-tier-street/20 text-tier-street",
  dot: "bg-tier-street shadow-[0_0_10px_rgba(251,191,36,0.55)]",
};

const TIERS: Record<Tier, { radiusKm: number; convergence: number; accent: TierAccent }> = {
  COUNTRY: { radiusKm: 300, convergence: 33, accent: ACCENT_COUNTRY },
  CITY: { radiusKm: 50, convergence: 66, accent: ACCENT_CITY },
  STREET: { radiusKm: 5, convergence: 100, accent: ACCENT_STREET },
};

const TIER_ORDER: Tier[] = ["COUNTRY", "CITY", "STREET"];
```

Two new tokens in [`Website/src/index.css`](src/index.css), inside the existing `@theme` block, right after
the country accents and with a comment saying why they exist:

```css
  /* Tier accents — the ONLY addition to the palette in the hierarchical pass.
     Tiers are the one place where colour carries meaning: country (lime, the
     existing signal colour), city, street. They may appear solely where the
     master prompt §7 allows; everywhere else stays lime / mist / white. */
  --color-tier-city: #38bdf8;
  --color-tier-street: #fbbf24;
```

### 2.3 The clue records

```ts
type Tier = "COUNTRY" | "CITY" | "STREET";

interface Probability {
  country: "SPAIN" | "PORTUGAL" | "FRANCE";
  value: number;
  /** Exactly one per clue carries this. */
  top?: true;
}

interface ClueSlide {
  id: number;
  tier: Tier;
  category: string;
  title: string;
  characteristic: string;
  explanation: string;
  probabilities: Probability[];
  /** fractions of the panorama pane; must satisfy 0.80 ≤ w/h ≤ 0.90 — see §6 */
  box: CropBox;
}
```

**Clue 1 — `COUNTRY`.** Keep the existing title, characteristic, explanation and box (`{ x: 0.24, y: 0.56, w:
0.16, h: 0.18 }`, w/h = 0.89 ✓ already in band); only the `category` prefix changes and the tier is added:

```ts
{
  id: 1,
  tier: "COUNTRY",
  category: "VISUAL INTELLIGENCE · ROAD INFRASTRUCTURE",
  title: "Spanish Roadside Reflector Bollard",
  // characteristic & explanation: keep the existing copy, verbatim
  probabilities: [
    { country: "SPAIN", value: 78, top: true },
    { country: "PORTUGAL", value: 55 },
    { country: "FRANCE", value: 23 },
  ],
  box: { x: 0.24, y: 0.56, w: 0.16, h: 0.18 },
}
```

**Clue 2 — `CITY`.** Same treatment: keep the copy and the box (`{ x: 0.62, y: 0.5, w: 0.18, h: 0.2 }`,
w/h = 0.90 ✓), change the prefix and the numbers:

```ts
{
  id: 2,
  tier: "CITY",
  category: "VISUAL INTELLIGENCE · ARCHITECTURE & MATERIAL",
  title: "Granite Rubble-Stone Perimeter Wall",
  // characteristic & explanation: keep the existing copy, verbatim
  probabilities: [
    { country: "SPAIN", value: 86, top: true },
    { country: "PORTUGAL", value: 38 },
    { country: "FRANCE", value: 9 },
  ],
  box: { x: 0.62, y: 0.5, w: 0.18, h: 0.2 },
}
```

**Clue 3 — `STREET`.** This clue's subject changes from a biome to a **street-level anchor**: a legible
route plate or kilometre marker with the asphalt edge detail around it. Its copy must describe **what the
demo panorama actually shows** — never a road number the image does not display. If a legible plate is
visible, the project's own research data (see
[`Research And Implementation/dev/mocks/report_road_galicia.json`](../Research%20And%20Implementation/dev/mocks/report_road_galicia.json))
supports the plate reading **N-634**, on the Cantabrian-coast national road near Ribadeo, Lugo:

```ts
{
  id: 3,
  tier: "STREET",
  category: "VISUAL INTELLIGENCE · ROAD SIGNAGE & MARKING",
  title: "White-on-Red N-634 Route Plate",          // only if the plate is actually legible
  characteristic:
    "White-on-red national-road route plate reading N-634, fixed to a post above chevron-edged asphalt with a moss-darkened kerb.",
  explanation:
    "A legible route plate removes the region: N-634 is the Cantabrian-coast national road, so the plate narrows the answer from a province to a single stretch between villages.",
  probabilities: [
    { country: "SPAIN", value: 94, top: true },
    { country: "PORTUGAL", value: 16 },
    { country: "FRANCE", value: 3 },
  ],
  box: { x: 0.0, y: 0.0, w: 0.0, h: 0.0 },   // ← tune it per §10, w/h inside [0.80, 0.90]
}
```

If the demo panorama has **no** legible plate, do not invent one: title the clue after the street-level
anchor that *is* visible (the marker post, the chevron-edged asphalt, the kerb), drop the `N-634` string, and
keep the same tier, radius and numbers. An honest clue beats a specific wrong one.

---

## 3. THE PRECISION METER — TOP OF THE RIGHT PANEL

Placement is not negotiable: **the first element inside the `<aside>` panel, directly above the clue title**,
above the category badge row.

**Structure — three stacked rows, nothing else:**

1. **Label + radius.** Left: `Precision` as a mono micro-label (`text-[11px] tracking-[0.2em] uppercase
   text-white/50`). Right: `±300 km` in the tier accent (`accent.text`), same mono scale.
2. **Convergence track.** `h-[3px] w-full overflow-hidden rounded-full bg-white/[0.08]` with a fill at
   `meta.convergence` percent, coloured `accent.dot`. This is the 33 % → 66 % → 100 % bar.
3. **Tier chips.** `COUNTRY` `CITY` `STREET` in mono `text-[11px] tracking-[0.18em] uppercase`, separated by
   a `text-white/20` middle dot or a 1 px rule. Active chip: `accent.text` + `ring-1 ring-white/10` +
   `bg-white/[0.06]`. Already-passed chip: `text-white/45`. Upcoming chip: `text-white/25`.

```tsx
function PrecisionMeter({ tier }: { tier: Tier }) {
  const { radiusKm, convergence, accent } = TIERS[tier];
  const activeIndex = TIER_ORDER.indexOf(tier);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] font-semibold tracking-[0.2em] text-white/50 uppercase">
          Precision
        </span>
        <span className={cn("font-mono text-[11px] font-semibold tracking-wider", accent.text)}>
          ±{radiusKm} km
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={convergence}
        aria-label={`Search radius ${radiusKm} kilometres, ${tier.toLowerCase()} level`}
        className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.08]"
      >
        <motion.div
          initial={false}
          animate={{ width: `${convergence}%` }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className={cn("h-full rounded-full", accent.dot)}
        />
      </div>

      <div className="flex items-center gap-2.5 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase">
        {TIER_ORDER.map((tierName, i) => (
          <Fragment key={tierName}>
            {i > 0 && <span className="text-white/20">·</span>}
            <span
              className={cn(
                "rounded px-1.5 py-0.5 transition-colors",
                i === activeIndex && cn(accent.text, "bg-white/[0.06] ring-1 ring-white/10"),
                i < activeIndex && "text-white/45",
                i > activeIndex && "text-white/25",
              )}
            >
              {tierName}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
```

**Hard requirements:**

- **The meter lives OUTSIDE the clue-swapping `AnimatePresence`.** It reads the current clue's tier from
  above the `<AnimatePresence>` and never remounts. With `initial={false}` and `animate={{ width }}` the bar
  then **grows from 33 to 66 to 100 across clue changes** instead of restarting at zero — that growth *is*
  the convergence story. Keying the meter on `currentClue.id` would animate it from 0 every time and destroy
  the effect.
- Nothing else moves into that area; no legend, no extra caption, no percentage readout (the chips and the
  bar already say it).
- Keep the panel's `space-y` rhythm: the meter sits at the top of the panel's content stack with the same
  gap as the other blocks, separated from the title block by the existing `border-b border-white/10 pb-6`
  treatment or an equivalent hairline.

---

## 4. PROBABILITIES — RANKED, STRICTLY DESCENDING

**Order is derived, never hand-maintained.** Render the list from a sort:

```tsx
const ranked = [...currentClue.probabilities].sort((a, b) => b.value - a.value);
```

So every clue displays **Spain → Portugal → France**, highest first, and a future edit to the numbers can
never produce a mis-ordered list.

**The values escalate as the radius narrows** (this is the hierarchy's payload — the country-scale clue is
wide, the street-scale clue is nearly certain):

| Tier | Spain | Portugal | France |
|---|---|---|---|
| `COUNTRY` | **78** | 55 | 23 |
| `CITY` | **86** | 38 | 9 |
| `STREET` | **94** | 16 | 3 |

**Row anatomy** (keep the existing bar treatment, only the colouring changes):

- A mono rank index in front of each row — `01`, `02`, `03` at `text-white/30`; the leader's index uses
  `accent.text`.
- Country name + value. The leader row keeps bold, its value and bar in `accent.bar` / `accent.text`, and
  keeps the `TOP MATCH` chip (`accent.chip`). The two trailing rows keep `text-white/80` labels and a
  `bg-white/40` bar.
- Keep `h-3` bars, `rounded-full`, `overflow-hidden`, the `motion.div` width animation and the
  `ESTIMATED LOCATION CONFIDENCE` caption exactly as they are.
- Do **not** add flags, maps, or a country legend — this is a ranking, not a chart.

---

## 5. THE CAMERA MORPH — ANIMATED ZOOM, EXACT ON EVERY FRAME

Today the zoom pops: a new `key` remounts the box and the layer and they cross-fade. Replace that with one
camera move, without weakening the exactness contract.

### 5.1 The mechanism

Four `MotionValue`s hold the live crop box. They **persist across clues** (no `key` remount) and are animated
together on every clue change:

```tsx
const { box } = currentClue;
const x = useMotionValue(box.x);
const y = useMotionValue(box.y);
const w = useMotionValue(box.w);
const h = useMotionValue(box.h);

const reduceMotion = useReducedMotion();

useEffect(() => {
  const next = CLUE_SLIDES[slideIndex].box;

  if (reduceMotion) {
    x.set(next.x); y.set(next.y); w.set(next.w); h.set(next.h);
    return;
  }

  const move = { duration: 0.62, ease: EASE_FORGE };
  const controls = [
    animate(x, next.x, move),
    animate(y, next.y, move),
    animate(w, next.w, move),
    animate(h, next.h, move),
  ];

  return () => controls.forEach((c) => c.stop());
}, [slideIndex, reduceMotion, x, y, w, h]);
```

Every rendered value is then a **pure function of the live values** — and *that* is why the mapping stays
exact mid-flight:

```tsx
// the crop box on the panorama (percentages of the pane)
const highlightLeft = useTransform(x, (v) => `${v * 100}%`);
const highlightTop = useTransform(y, (v) => `${v * 100}%`);
const highlightWidth = useTransform(w, (v) => `${v * 100}%`);
const highlightHeight = useTransform(h, (v) => `${v * 100}%`);

// the zoom layer: -(x/w)%, -(y/h)%, (100/w)%, (100/h)% of the zoom pane
const layerLeft = useTransform([x, w], ([xv, wv]) => `${-(xv / wv) * 100}%`);
const layerTop = useTransform([y, h], ([yv, hv]) => `${-(yv / hv) * 100}%`);
const layerWidth = useTransform(w, (v) => `${100 / v}%`);
const layerHeight = useTransform(h, (v) => `${100 / v}%`);

// the zoom pane's own aspect, always derived from the CURRENT w/h
const paneAspect = useTransform([w, h], ([wv, hv]) => (wv / hv) * PANE_ASPECT);
```

```tsx
{/* the highlight on the panorama, driven by the same values — and never remounted */}
<motion.div
  data-crop-box
  aria-hidden
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.28, ease: EASE_OUT }}
  className={cn("pointer-events-none absolute rounded-[3px] ring-2", accent.ring, accent.glow)}
  style={{ left: highlightLeft, top: highlightTop, width: highlightWidth, height: highlightHeight }}
/>

{/* the zoom pane: aspect derived from the live crop, layer offset in percentages */}
<motion.div
  data-pane="zoom"
  style={{ aspectRatio: paneAspect }}
  className={cn("relative w-full overflow-hidden rounded-xl bg-black ring-1", accent.ringSoft, accent.paneGlow)}
>
  <motion.div
    style={{ left: layerLeft, top: layerTop, width: layerWidth, height: layerHeight }}
    className="absolute"
  >
    <img src={panorama.previewUrl} alt={`Zoom on ${currentClue.title}`} className="size-full object-cover" />
  </motion.div>
  …
</motion.div>
```

**Verified:** with this construction the boxed region and the zoom show the same image region on **every**
frame of the interpolation, not just at the endpoints — 33,600 frame-checks over randomised boxes, four image
aspects and seven values of `t` gave a worst deviation of **1.017e-12 px**. If you change the formulas, this
ceases to be true; re-measure (§10) instead of assuming.

### 5.2 The rules that keep it exact

- **One tween for all four values.** Never spring them independently: springs are distance-dependent, so four
  separate springs shear the box mid-flight (the aspect warps). Same duration, same ease, always.
- **Interruptions are seamless** because `animate()` starts from the current value: clicking `Next Clue`
  twice quickly must not jump.
- **No remount.** Delete the `key={...}` on the highlight box and on the zoom layer; they now *are* the
  animation.
- **Percentages, never transforms**, inside the zoom viewport; `left/top/width/height` change, nothing else.
- **No `border`, padding, `min-h`, `h-[…]` or `object-contain` on either pane** — anything that changes a
  pane's box breaks the mapping (the highlight resolves against the pane's border box, and the zoom pane's
  derived aspect assumes the layer is the pane's direct child with no intervening padding).
- The pane's `aspect-ratio` changes each frame, which is a layout reflow — that is intended and is the
  correct price of exactness. Keep the morph at 0.62 s and let the left column be the only thing resizing.
  If binding a `MotionValue` to `aspectRatio` does not write through on the installed `framer-motion`
  version, drive that one style from a batched state update (`useMotionValueEvent` on `w`) — **do not** fake
  it with a min-height or an extra wrapper.
- Colour: the highlight ring uses `accent.ring`, the zoom pane's hairline and glow use `accent.ringSoft` /
  `accent.glow`, and the zoom pane's corner brackets take `accent.ringSoft` too.
- **Right-panel timing:** the panel's content swap stays on its own `AnimatePresence`, but give the incoming
  content a small `delay` (≈0.18 s, never more than 0.25 s) so the eye follows the camera first and then
  reads the new copy.

---

## 6. EXPANDED VERTICAL VIEWPORTS

Both panes stay pinned to the **same 21/9 panorama pane aspect and the same proven formulas**. The room for
growth comes from the crop boxes and from the page's own padding:

1. **Every crop box must satisfy `0.80 ≤ w/h ≤ 0.90`.** Because the zoom pane's height is
   `zoomHeight = columnWidth / ((w/h) * 21/9)`, the crop's aspect *is* the zoom viewport's height. Clues 1
   and 2 already sit at 0.89 and 0.90; clue 3 currently sits at 1.11 (a shallow 258 px strip on a 668 px
   column) and must be re-framed onto a taller feature (§10).
2. **Tighten the stack, not the panes:** left column `gap-5` (20 px) between the two panes; the screen
   wrapper `px-8 py-5`; the header `pb-4`; `main` `pb-6`.
3. **Never stretch a pane to fill height.** `justify-center` on the left column is what it is; the panes are
   width-driven by design. The stack keeps whatever slack remains.

**The measured budget** (column width = `(min(viewportWidth − 64, 1600) − 40) / 2`; available height =
`viewportHeight − 112`):

| Viewport | Column | Panorama pane | Zoom pane (w/h 0.90 → 0.80) | Stack | Available | Fits |
|---|---|---|---|---|---|---|
| 1440×900 | 668 px | 286 px | 318 → 358 px | 624 → 664 px | 788 px | yes |
| 1280×720 | 588 px | 252 px | 280 → 315 px | 552 → 587 px | 608 px | yes |
| 1920×1080 | 780 px | 334 px | 371 → 418 px | 726 → 772 px | 968 px | yes |

So the zoom pane is now **the tallest element of the left stack** at every size, and the stack itself fits all
three viewports. (At 1080p roughly 200 px of height stays unused; that slack is deliberate. The honest way to
spend it is a taller *source* image — a true 2:1 equirect panorama — not a stretched pane.)

> **The one thing the left stack cannot control is the row height.** Once the panel carries a meter *and* a
title, two body blocks, a ranked probability list and a nav row, **the panel's copy is taller than the panes**
at 1280×720 — so at that one size the page scrolls even though the images fit. Do not "fix" it by shrinking
the type or dropping a block: tighten the panel's **spacing** instead, keyed to viewport *height* rather than
width (`[@media(max-height:960px)]:gap-5`, `…:p-8`, `…:pt-5`, `…:space-y-2.5`). With those trims the measured
row is 788 px at 1440×900 (no page scroll, 0 px overflow) and 762 px at 1280×720 (154 px of page scroll, with
the panorama and zoom panes still fully inside the fold at 252 px and 284 px).

---

## 7. WHERE THE TIER COLOUR MAY APPEAR

The tier accent appears in **exactly** these places and nowhere else:

1. The crop box ring on the panorama (`accent.ring`) and, through `accent.glow`, its faint shadow.
2. The zoom pane's hairline (`accent.ringSoft`), its outer glow (`accent.paneGlow`) and its corner brackets.
3. The category badge (`VISUAL INTELLIGENCE · …`) text.
4. The precision meter: radius readout, convergence fill, active tier chip.
5. The leader's probability row: rank index, value, bar and `TOP MATCH` chip.

**Everything else keeps Electric Lime**: the footer's primary button, the stepper dots' active state, the
header counter, the `ESTIMATED LOCATION CONFIDENCE` caption. The tier colour must never touch a button,
never become a background wash, and never appear in two tiers at once. This is a bounded exception to "lime
is the only accent", and it must stay bounded.

---

## 8. NAVIGATION — FORWARD UNTIL THE END, THEN BACK

```tsx
const isFirst = slideIndex === 0;
const isLast = slideIndex === CLUE_SLIDES.length - 1;
```

- **Clues 1–2:** secondary `Previous Clue` (`variant="outline"`, disabled when `isFirst`) + primary
  `Next Clue` with a trailing `ChevronRight`, lime.
- **Clue 3:** the primary slot **becomes** `← Previous Clue` (lime, leading `ChevronLeft`), and the
  secondary `Previous Clue` button is not rendered — never two identical buttons side by side.
- **No wrap-around.** `nextSlide` must never fire on the last clue, and the header's `‹ ›` chevrons become
  `disabled` at the ends (`disabled:opacity-35`) so a mis-hit cannot jump 3/3 → 1/3 mid-pitch. The `n / 3`
  counter stays.
- The stepper dots keep their click-to-jump behaviour (`setSlideIndex(i)`) and their lime active state.
- The back button (`← Upload another panorama`) is untouched.
- Optional, and worth it for a live pitch if it costs one hook: `ArrowLeft` / `ArrowRight` move between
  clues, respecting `isFirst` / `isLast`.

---

## 9. `App.tsx` AND `lib/motion.ts` — THE FORGE CURVE

One new token in [`Website/src/lib/motion.ts`](src/lib/motion.ts):

```ts
/**
 * The Forge curve — this repository's signature "fluid" ease, taken from the
 * Forge reference build (`forge2026-main/forge2026-main/src/styles.css`, the
 * `--ease-out` declaration). Used only for mechanical moves: the aperture
 * blades opening and the camera morph. Content entrances keep EASE_OUT.
 */
export const EASE_FORGE: [number, number, number, number] = [0.16, 1, 0.3, 1];
```

Then in [`Website/src/App.tsx`](src/App.tsx):

- The **opening** of the blades uses `EASE_FORGE` instead of `EASE_OUT`; the **closing** keeps
  `EASE_IN_OUT` (an accelerating close reads as a shutter, a decelerating one does not).
- **Nothing else in the shutter changes.** The verified beats stay: close 0.40 s → swap at full cover →
  0.25 s hold → open 0.55 s, with `ACQUIRING OPTICAL TARGET...` at the closed beat, `Background` mounted
  throughout, reduced motion bypassing the blades entirely.
- `EASE_FORGE` is also what the camera morph in §5 uses.

---

## 10. TUNING THE CROP BOXES — THE ONE JUDGEMENT CALL

`CropBox` values are **content data**, not design: they must sit on the demo panorama that the pitch
actually uses (drop a challenge panorama into the upload zone and work against that image). The fractions
resolve against the **pane's box**, not the image — with `object-cover` the visible image is cropped, so
never compute them from the source image's pixel grid.

**The loop, per clue:**

1. Drag the demo panorama in, get to Screen 2, screenshot the panorama pane.
2. Read the feature's pixel rectangle off the screenshot, relative to the *pane* (not the image).
3. Convert: `x = left / paneWidth`, `y = top / paneHeight`, `w = rectWidth / paneWidth`,
   `h = rectHeight / paneHeight`.
4. Nudge until the lime box frames the feature with a little air, and check `0.80 ≤ w/h ≤ 0.90`.
5. Confirm with the measurement snippet below — first the values, then by eye.

**Add these test hooks** (they cost nothing and make the check runnable):

```tsx
data-pane="panorama"   // the panorama pane
data-pane="zoom"       // the zoom pane
data-crop-box          // the lime highlight div
```

**The measurement snippet** (run it in the browser console on Screen 2; it compares the box on the panorama
with the layer inside the zoom pane, purely structurally, so it needs no pixel diffing):

```js
const pane = document.querySelector('[data-pane="panorama"]');
const box = document.querySelector('[data-crop-box]');
const zoom = document.querySelector('[data-pane="zoom"]');
const layer = zoom.firstElementChild;
const P = pane.getBoundingClientRect(), B = box.getBoundingClientRect();
const Z = zoom.getBoundingClientRect(), L = layer.getBoundingClientRect();
const f = { x: (B.left - P.left) / P.width, y: (B.top - P.top) / P.height, w: B.width / P.width, h: B.height / P.height };
const l = { left: (L.left - Z.left) / Z.width, top: (L.top - Z.top) / Z.height, width: L.width / Z.width, height: L.height / Z.height };
const err = {
  width: Math.abs(l.width - 1 / f.w),
  height: Math.abs(l.height - 1 / f.h),
  left: Math.abs(l.left + f.x / f.w),
  top: Math.abs(l.top + f.y / f.h),
  aspect: Math.abs(Z.width / Z.height - (f.w / f.h) * (P.width / P.height)),
};
console.table(err);
```

Every value must be **< 0.001** (fractions); the rendered-pixel residual that remains is browser rounding
(measured earlier at 0.009–0.018 px on the two panes). Then **also sample during the morph** to prove §5:

```js
const worst = { size: 0, aspect: 0 };
const t0 = performance.now();
const tick = () => {
  const P = pane.getBoundingClientRect(), B = box.getBoundingClientRect();
  const Z = zoom.getBoundingClientRect(), L = layer.getBoundingClientRect();
  const fw = B.width / P.width, fh = B.height / P.height;
  worst.size = Math.max(worst.size, Math.abs(L.width / Z.width - 1 / fw));
  worst.aspect = Math.max(worst.aspect, Math.abs(Z.width / Z.height - (fw / fh) * (P.width / P.height)));
  if (performance.now() - t0 < 900) requestAnimationFrame(tick); else console.log('worst mid-morph', worst);
};
requestAnimationFrame(tick);   // run this immediately after clicking Next Clue
```

---

## 11. DESIGN RULES (restated)

- Plain **black** canvas, **no grid**, no gradients. Obsidian **`#101017`** panels, mist **`#e9eaee`** text,
  **Electric Lime `#d6ff42`** as the primary accent — plus the two tier tokens of §2.2 and nothing else.
- **Space Grotesk** display, **Inter** body, **monospace** for labels and numbers.
- Motion comes only from [`Website/src/lib/motion.ts`](src/lib/motion.ts) (`EASE_OUT`, `EASE_IN_OUT`,
  `EASE_FORGE`, `fadeUp`, `stagger`). Nothing loops while idle.
- Tailwind v4 gotchas: `bg-linear-*` (not `bg-gradient-*`), `size-*` not `h-* w-*`, opacity as
  `ring-white/10` / `bg-white/[0.08]`; `ring-*` is a box-shadow and takes **no layout space** — mandatory on
  the image panes; **class names must be literal strings** (§2.2).
- Accessibility: the crop box, corner brackets and blades are `aria-hidden`; the meter is a real
  `role="progressbar"` with an `aria-label`; buttons keep their `aria-label`s and their disabled states;
  focus rings stay intact.
- Responsiveness is unchanged: below `lg` the inspection screen is still a single column.

---

## 12. DEFINITION OF DONE

1. `npm run typecheck` exits 0 with **no output**; `npm run build` succeeds; `npm run dev` shows **zero**
   console errors or warnings.
2. **Tiers:** all three clues carry `COUNTRY` / `CITY` / `STREET` with ±300 / ±50 / ±5 km and convergence
   33 / 66 / 100; the **precision meter is the top element of the right panel, directly above the title**;
   moving 1 → 2 → 3 grows its fill **from 33 to 66 to 100 without ever passing through zero** (the meter must
   not be keyed on the clue).
3. **Ranking:** every clue shows Spain > Portugal > France, rendered from the sort, with values exactly
   78/55/23 (country), 86/38/9 (city), 94/16/3 (street) and `TOP MATCH` on the leader.
4. **Colours:** clue 1 lime `#d6ff42`, clue 2 `#38bdf8`, clue 3 `#fbbf24`, appearing **only** in the §7
   places, verified on screen in all three tiers.
5. **Branding:** every `category` reads `VISUAL INTELLIGENCE · …`; nothing in `src/` — code, comments or UI
   — carries a third-party vision-product brand (search the tree for the vendor name those three lines hold
   today and report the result), and this document itself names no vendor.
6. **Zoom still exact, and now animated:** the console snippet of §10 returns every value < 0.001 on all
   three clues at 1440×900 **and** 1280×720; the mid-morph sample stays < 0.001 too; and by eye the boxed
   region and the zoom show the same pixels at rest and while moving.
7. **Viewports:** no crop box with `w/h` outside `[0.80, 0.90]`; every zoom pane is at least 318 px tall at
   1440×900 (668 px column) and taller than the panorama pane; **no vertical page scroll at 1440×900 or
   1920×1080**; at 1280×720 the *left stack* still fits (≈556 px of the 608 px budget) and both panes stay
   inside the fold, with the page allowed to scroll by up to ~160 px — the panel's copy, not the panes, sets
   the row height there. Report the four measurements.
8. **Navigation:** clue 1's secondary button is disabled; clues 1–2 show `Next Clue →`; clue 3 shows the
   primary `← Previous Clue` with no duplicate button; the header chevrons disable (never wrap) at the ends.
9. **Reduced motion:** with `prefers-reduced-motion: reduce` there are no blades and no morph — clue changes
   and screen swaps land instantly.
10. No new dependencies; only `InspectionView.tsx`, `index.css`, `lib/motion.ts` and `App.tsx` changed;
    Screen 1 untouched; nothing references Challenges 1–3.

---

## 13. DO NOT

- Do not change `PANE_ASPECT` or the pane aspects; do not stretch, clamp or `min-h` a pane; do not switch to
  `object-contain` (it letterboxes *and* breaks the mapping).
- Do not put a `border`, padding or a wrapper `div` between the zoom pane and its scaled layer.
- Do not animate anything inside the zoom viewport except `left/top/width/height` percentages.
- Do not spring the four crop values independently, and do not key/remount the highlight or the zoom layer.
- Do not put the precision meter inside the clue swap, and do not key it on the clue id.
- Do not hand-order the probabilities; always sort.
- Do not build class names dynamically — accents must be literal strings.
- Do not invent a road number, a place name or a feature the demo panorama does not show.
- Do not add labels, legends, captions, maps or helper text around the images.
- Do not touch the clue titles that the existing passes already tuned (clues 1 and 2), the stepper dots'
  behaviour, the back button, or Screen 1.
- Do not add dependencies, call anything over the network, or reintroduce `setTimeout`-driven transitions,
  `backdrop-blur`, loaders or spinners. Leave the unreferenced `AnalyzingView.tsx` alone.

---

## 14. DELIVERABLE

Report back with:

1. The files changed and, for each, a one-line summary of the diff.
2. The exact commands run (`typecheck`, `build`, `dev`) and their results.
3. Confirmation of the §12 checks **with the numbers**, explicitly including the §10 snippet output (at rest
   and mid-morph), the measured pane heights, and the three viewport checks.
4. The final `box` values for all three clues and which visible feature each one frames.
5. Anything in this spec you could **not** satisfy, and why — never a silent substitution.
