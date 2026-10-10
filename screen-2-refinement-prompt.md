# Lost & Found — Screen 2 Refinement — MASTER PROMPT

> **How to use this file.** Screen 2 already exists and works (built from `screen-2-inspection-prompt.md`).
> This is a **surgical refinement pass**, not a rebuild. Paste **everything below the horizontal rule**
> into Freebuff with this repository (`Website/`) open. Everything you need is in this document and on
> disk — do not re-derive the design language, do not redesign anything.
>
> **Four refinements, nothing else:** (1) strip all clutter text around the two images, (2) make the zoom
> mathematically pixel-exact, (3) replace the clunky shutter with a real cinematic aperture transition,
> (4) expand the right panel to a true 50/50 split.

---

## ROLE

You are a senior frontend engineer on **Lost & Found** by *The Winning Team* (Junction 2026). Screen 1 (landing)
and Screen 2 (the Google Lens inspection view) are both **already built and working**. Your job in this task is
**exactly four refinements** to Screen 2 and its entry transition.

**The whole change is surgical: `Website/src/components/InspectionView.tsx`, `Website/src/App.tsx`, and one new
easing token in `Website/src/lib/motion.ts`. Nothing else.**

Forty minutes of restraint beats a redesign: if a decision is ambiguous, choose the option that makes the screen
look *more* like a precision optical instrument and *less* like a dashboard.

---

## 0. GUARDRAILS THAT STILL BIND

> **⛔ CHALLENGE 4 IS THE ONLY CHALLENGE.** Ignore Challenges 1, 2, and 3 completely. Do not read them, do not
> mention them, do not support them. Our only task is Challenge 4 (estimating Portugal, France, or Spain from a
> 360° panorama).

- **Frontend only.** Strictly client-side React. Mock data only. **No backend, no fetch, no API, no database,
  no model calls, no storage, no router, no URL changes.** No new dependencies.
- **Screen 1 is frozen.** Do not restyle, refactor, or "improve" the landing screen. The only seam you may
  touch is the transition state machine inside `App.tsx`.
- **Design tokens are frozen** — plain black canvas (no grid), obsidian `#101017` panels, mist `#e9eaee` text,
  Electric Lime `#d6ff42` as the single accent. Space Grotesk / Inter / monospace as established.
- **Read before you write.** [`Website/src/components/InspectionView.tsx`](src/components/InspectionView.tsx),
  [`Website/src/App.tsx`](src/App.tsx), [`Website/src/lib/motion.ts`](src/lib/motion.ts),
  [`Website/src/index.css`](src/index.css), [`Website/src/components/UploadZone.tsx`](src/components/UploadZone.tsx)
  (exports `PanoramaInput`). The code on disk is the ground truth; do not invent from memory.
- **TypeScript gates:** `tsc --noEmit` must exit 0 with **no output**. No `any`, no `@ts-ignore`, no unused
  imports (`noUnusedLocals` is on — deleting a badge means deleting its icon import too).

---

## 1. THE FOUR REFINEMENTS — SUMMARY

| # | Refinement | File | What changes |
|---|---|---|---|
| 1 | **Remove label clutter around images** | `InspectionView.tsx` | Delete every text badge, numbered label row, HUD readout, status tag, crosshair and bouncing arrow around the two image panes. Images only. |
| 2 | **Pixel-exact zoom** | `InspectionView.tsx` | Replace `focus {x,y,zoom}` + `transform: scale()` with a normalized crop box `{x,y,w,h}` and the exact inverted-scale formula from §3. The highlight and the zoom must show identical pixels. |
| 3 | **Cinematic aperture transition** | `App.tsx` (+ 1 token in `lib/motion.ts`) | Delete the `setTimeout` overlay. New blade-shutter state machine driven by a single `MotionValue`, swapping screens *while the blades fully cover the viewport*, then opening onto Screen 2. |
| 4 | **Expanded right panel (50/50)** | `InspectionView.tsx` | Grid becomes `lg:grid-cols-2` on a 1600px rail; the right card stretches to the full height of the right half with generous padding and a larger type scale. |

---

## 2. REFINEMENT 1 — STRIP THE CLUTTER AROUND THE IMAGES

The images are the interface. Remove everything around them.

**DELETE (exactly this list, nothing else):**

- The numbered label row above the panorama: the `1` chip, the `WHOLE IMAGE` text, and the **file-name**
  readout on the right.
- The numbered label row above the zoom: the `2` chip, `ZOOM OF SPECIFIC DETAIL / CHARACTERISTIC`, and the
  `Crosshair` + `{zoom}X MAGNIFIED` readout.
- The bouncing connector between the two panes (`ArrowDown` with `animate-bounce`) — and its import.
- The `LENS LOCK` tag on the target box.
- The `OPTICAL TARGET ACQUIRED` status badge, the pulsing dot, the **hairline crosshairs**, the **dashed
  centre circle**, and the **radial vignette** from the zoom viewport's HUD.
- Any now-unused imports (`ArrowDown`, `Crosshair`, and anything else the deletions orphan).

**KEEP:**

- **The lime crop box on the panorama pane** — it is not decoration, it is the exact crop indicator that
  Refinement 2 makes truthful. It stays, **with no label above it**.
- **One quiet frame per image**: `rounded-xl`, black fill, hairline edge, and **four corner brackets** inset
  `2`, `size-3`, `border-white/25` (subtle — the zoom pane may use `border-lime/40`).
- All **right-panel content** (`Google Lens · <Type>` badge, clue title, `CHARACTERISTIC:`, `EXPLANATION:`,
  `PROBABILITY:` and its bars, the `TOP MATCH` chip, the stepper, dot indicators, `Previous` / `Next Clue`) —
  that is content, not clutter.
- The header bar: back button, wordmark, stepper.

**Result:** two clean images stacked with a little breathing room, a lime rectangle on the top one, quiet
corner marks, and the intelligence card on the right. Nothing else is on screen.

---

## 3. REFINEMENT 2 — THE PIXEL-EXACT ZOOM

### 3.1 The contract change

Replace the focal-point field with a **normalized crop box**, expressed as fractions of the panorama pane
(0–1, top-left anchored):

```ts
type CropBox = {
  x: number; // left edge, fraction of the pane's width
  y: number; // top edge, fraction of the pane's height
  w: number; // width, fraction of the pane's width
  h: number; // height, fraction of the pane's height
};
// invariant: x + w <= 1, y + h <= 1
```

- Delete `focus: { x, y, zoom }` from `ClueSlide` and every readout of `zoom` (the `2.8X MAGNIFIED` text is
  already gone in §2).
- The magnification is now **derived, never authored**: the effective scale is `1 / w` (w = 0.16 ⇒ the zoomed
  image renders at 6.25× the pane's pixels).
- Ship these three boxes as the starting values (they are content data — see §3.5):

```ts
box: { x: 0.24, y: 0.56, w: 0.16, h: 0.18 },  // clue 1 — roadside bollard, lower-left
box: { x: 0.62, y: 0.50, w: 0.18, h: 0.20 },  // clue 2 — granite wall, right
box: { x: 0.42, y: 0.16, w: 0.20, h: 0.18 },  // clue 3 — canopy, upper-centre
```

### 3.2 The two renderings — the exact math

Let `C` be the panorama pane's aspect ratio. The pane is `aspect-21/9`, so **`C = 21 / 9`**.

**A. The highlight on the panorama** — the element's box **is** the crop region (top-left anchored, no
`translate`):

| property | value |
|---|---|
| `left` | `${x * 100}%` |
| `top` | `${y * 100}%` |
| `width` | `${w * 100}%` |
| `height` | `${h * 100}%` |

**B. The zoom viewport** — `overflow: hidden`, and its aspect ratio is *derived from the box*:

| property | value |
|---|---|
| `aspectRatio` | `(w / h) * C`  — with `C = 21 / 9`, e.g. `(0.16 / 0.18) * (21 / 9) ≈ 2.074` |

**C. The image holder inside the zoom viewport** — absolutely positioned, sized and offset by the inverted
scale of the crop:

| property | value |
|---|---|
| `width` | `${(100 / w)}%` |
| `height` | `${(100 / h)}%` |
| `left` | `${-(x / w) * 100}%` |
| `top` | `${-(y / h) * 100}%` |

**D. The `<img>` inside the holder** — `size-full object-cover`, and **visual identity with the panorama
image**: same `src`, no extra `brightness` / `contrast` filters, default `object-position: 50% 50%`.

**Why this is exact.** The holder is a uniform, scaled replica of the whole panorama pane: its aspect ratio
works out to exactly `C` (since `(w/h)·C · h/w = C`), so the `object-cover` crop inside it is *identical* to
the pane's crop. The offsets place the box's top-left corner exactly on the viewport's top-left, and the
viewport's aspect `(w/h)·C` equals the crop region's aspect, so the region fills the viewport edge to edge —
the same image pixels, magnified, and nothing else. The formulas have been verified numerically across
**20,060** pane/box/image combinations (4:3, 3:2, 16:9, square and panorama sources): worst deviation
**1.4e-12 px**. If you change the formulas, re-verify this invariant yourself before claiming it.

### 3.3 Hard rules — these are what keep it exact

1. **The two image panes must be borderless layout boxes.** Draw their hairlines with **`ring-1`** (a
   `box-shadow`; try `ring-1 ring-white/10` on the panorama and `ring-1 ring-lime/30` on the zoom). A CSS
   `border` shrinks the padding box that all percentage offsets resolve against, and the math silently stops
   being exact. Same reason: neither pane may carry `p-*` padding.
2. **Both images use `object-cover` with the default `object-position`.** No `object-top`, no `object-[...]`.
3. **No transform on anything inside the zoom viewport.** In particular, do not wrap the holder in a
   `motion.div` that animates `scale` — a transformed ancestor changes the reference box and breaks the
   mapping. The only animation allowed in there is **opacity**.
4. **The zoom viewport must have a definite height** — that is exactly what `aspectRatio` provides, and it is
   what makes the holder's percentage `height` resolve at all.
5. **Do not "simplify" this back to `transform: scale()`.** The old `scale(2.8)` + `transformOrigin` reframed
   around a *point* inside a fixed 16:9 pane, so the visible crop drifted from the highlight and could never
   match it. That is the bug being fixed.

### 3.4 Code — the shape to write (left column)

```tsx
{/* ---- panorama pane: the highlight IS the crop region ---- */}
<div className="relative aspect-21/9 w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10 shadow-2xl">
  <img
    src={panorama.previewUrl}
    alt={panorama.name}
    className="size-full object-cover"
  />

  {/* exact crop box — no label, no helper text */}
  <motion.div
    key={`box-${currentClue.id}`}
    aria-hidden
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.28, ease: EASE_OUT }}
    className="pointer-events-none absolute rounded-[3px] ring-2 ring-lime shadow-[0_0_18px_rgba(214,255,66,0.45)]"
    style={{
      left: `${currentClue.box.x * 100}%`,
      top: `${currentClue.box.y * 100}%`,
      width: `${currentClue.box.w * 100}%`,
      height: `${currentClue.box.h * 100}%`,
    }}
  />

  {/* quiet corner brackets (inset-2, size-3, border-white/25) */}
</div>

{/* ---- zoom pane: exactly the boxed region, magnified ---- */}
<div
  className="relative w-full overflow-hidden rounded-xl bg-black ring-1 ring-lime/30 shadow-[0_0_30px_rgba(214,255,66,0.12)]"
  style={{ aspectRatio: (currentClue.box.w / currentClue.box.h) * (21 / 9) }}
>
  <motion.div
    key={`zoom-${currentClue.id}`}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3, ease: EASE_OUT }}
    className="absolute"
    style={{
      left: `${-(currentClue.box.x / currentClue.box.w) * 100}%`,
      top: `${-(currentClue.box.y / currentClue.box.h) * 100}%`,
      width: `${(100 / currentClue.box.w)}%`,
      height: `${(100 / currentClue.box.h)}%`,
    }}
  >
    <img
      src={panorama.previewUrl}
      alt={`Zoom on ${currentClue.title}`}
      className="size-full object-cover"
    />
  </motion.div>

  {/* quiet corner brackets only (border-lime/40) */}
</div>
```

`EASE_OUT` is the existing token in [`Website/src/lib/motion.ts`](src/lib/motion.ts) — import it if it is not
already imported.

### 3.5 Tuning note (the one judgement call)

The four numbers per clue are **content data, not code**. The starting values above are tuned for the demo
image family; glance at the actual panorama and nudge them so the box sits on the named feature. Two
constraints when tuning:

- Keep boxes inside the **cover-visible area**. A 4:3 source in a 21:9 pane with `object-cover` shows only the
  middle ~57% of the image's height, so keep `y` roughly in `[0.05, 0.85]` with modest `h`.
- Keep the derived zoom aspect `(w/h) · (21/9)` inside **1.6 – 2.8** so the left column stays balanced between
  clues.

---

## 4. REFINEMENT 3 — THE CINEMATIC APERTURE TRANSITION (`App.tsx`)

### 4.1 What is wrong today

`handleAnalyze` flips an `isTransitioning` flag and waits on a bare `setTimeout(…, 450)`, while an overlay
fades a `bg-black/95 backdrop-blur-2xl` sheet with a pulsing rounded square. The screen swap is decoupled
from any animation (it fires on the timer, mid-fade), the blur sheet is a repaint-heavy overlay, and the
reveal is a fade rather than a shutter. Replace all of it.

### 4.2 The new state machine

```ts
type Screen = "landing" | "inspecting";
/** idle → closing → (swap hidden under the closed blades) → opening → idle */
type Shutter = "idle" | "closing" | "opening";
```

One `MotionValue` drives every blade; one effect sequences the two beats. **No `setTimeout` anywhere.**

```tsx
const [screen, setScreen] = useState<Screen>("landing");
const [panorama, setPanorama] = useState<PanoramaInput | null>(null);
const [shutter, setShutter] = useState<Shutter>("idle");

const progress = useMotionValue(0);            // 0 = open, 1 = fully closed
const intent = useRef<"inspect" | "reset">("inspect");
const reduceMotion = useReducedMotion();

const handleAnalyze = (input: PanoramaInput) => {
  if (shutter !== "idle") return;              // no double-fire
  setPanorama(input);

  if (reduceMotion) {                          // no blades: straight crossfade
    setScreen("inspecting");
    return;
  }

  intent.current = "inspect";
  setShutter("closing");
};

const handleBack = () => {
  if (shutter !== "idle") return;

  if (reduceMotion) {
    setScreen("landing");
    setPanorama(null);
    return;
  }

  intent.current = "reset";
  setShutter("closing");
};

useEffect(() => {
  if (shutter === "idle") return;

  const closing = shutter === "closing";
  const controls = animate(progress, closing ? 1 : 0, {
    duration: closing ? 0.4 : 0.55,
    delay: closing ? 0 : 0.25,                 // hold the closed frame for a beat
    ease: closing ? EASE_IN_OUT : EASE_OUT,
    onComplete: () => {
      if (closing) {
        // The blades fully cover the viewport: swap now, nothing is visible.
        if (intent.current === "inspect") {
          setScreen("inspecting");
        } else {
          setScreen("landing");
          setPanorama(null);                   // the existing effect revokes the URL
        }
        setShutter("opening");                 // open onto the new screen
      } else {
        setShutter("idle");                    // overlay unmounts, blades at 0
      }
    },
  });

  return () => controls.stop();
}, [shutter, progress]);
```

Add the closing ease to [`Website/src/lib/motion.ts`](src/lib/motion.ts) (typed like `EASE_OUT` so `tsc` is
happy):

```ts
/** The shutter closing: accelerates into full cover. Opening uses EASE_OUT. */
export const EASE_IN_OUT: [number, number, number, number] = [0.55, 0, 0.35, 1];
```

New imports in `App.tsx`: `animate`, `useMotionValue`, `useReducedMotion`, `useTransform` (plus the existing
`motion`, `AnimatePresence`, `MotionConfig`). Keep the `<MotionConfig reducedMotion="user">` wrapper.

### 4.3 The overlay — four blades + the lock-on reticle

Rendered whenever `shutter !== "idle"`. **Transform-only** (GPU-composited, no blur, no filter), fixed,
full-bleed, behind nothing, above everything:

```tsx
{shutter !== "idle" && (
  <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
    {/* four aperture blades: pure scale, meeting at the centre.
        51% halves overlap by 1% so there is never a seam at full cover. */}
    <motion.div aria-hidden className="absolute inset-x-0 top-0 h-[51%] origin-top bg-ink" style={{ scaleY: progress }} />
    <motion.div aria-hidden className="absolute inset-x-0 bottom-0 h-[51%] origin-bottom bg-ink" style={{ scaleY: progress }} />
    <motion.div aria-hidden className="absolute inset-y-0 left-0 w-[51%] origin-left bg-ink" style={{ scaleX: progress }} />
    <motion.div aria-hidden className="absolute inset-y-0 right-0 w-[51%] origin-right bg-ink" style={{ scaleX: progress }} />

    {/* the lock-on reticle: appears as the aperture closes, gone as it opens */}
    <motion.div
      className="absolute inset-0 grid place-items-center"
      style={{ opacity: reticleOpacity }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="size-20 rounded-2xl border-2 border-lime shadow-[0_0_40px_rgba(214,255,66,0.6)]" />
        <p className="font-mono text-xs font-bold tracking-[0.3em] text-lime uppercase">
          ACQUIRING OPTICAL TARGET...
        </p>
      </div>
    </motion.div>
  </div>
)}
```

with, next to `progress`:

```tsx
const reticleOpacity = useTransform(progress, [0, 0.55, 1], [0, 0.9, 1]);
```

The mapping works in both directions for free: as the blades close, the label fades in; as they open,
it fades out. The `ACQUIRING OPTICAL TARGET...` text stays **real text** (it is status); the blades and the
reticle frame are decorative and get `aria-hidden`.

No `AnimatePresence` is needed for this overlay: it mounts at the start of `closing` (blades at scale 0, so
nothing is visible) and unmounts when the machine returns to `idle` (blades back at 0), so both mount and
unmount are pixel-invisible. Keep `AnimatePresence` for the **screen swap** only.

### 4.4 The swap under cover, and the reveal

The screens keep the existing `AnimatePresence mode="wait"`, with two adjustments so the aperture literally
reveals Screen 2 and never flashes empty black:

- Landing: `exit={{ opacity: 0, transition: { duration: 0.18 } }}` — the exit completes while the blades are
  closed (and before the opening's 0.25 s delay elapses), so Screen 2 is mounted underneath before the
  blades move.
- Screen 2's entering `motion.div`: `initial={{ opacity: 0, scale: 1.015 }}`,
  `animate={{ opacity: 1, scale: 1 }}`, `transition={{ duration: 0.5, ease: EASE_OUT }}` — the analysed frame
  resolves as the aperture re-opens, instead of the old `scale 0.98` "pop".

`Background` stays mounted throughout — do not unmount it during the transition.

### 4.5 Timing contract

| Beat | Value | Easing |
|---|---|---|
| Blades close | 0.40 s | `EASE_IN_OUT` `[0.55, 0, 0.35, 1]` |
| Screen swap | at full cover (close complete) | — |
| Landing exit / Screen 2 mount | 0.18 s / 0.5 s | default / `EASE_OUT` |
| Closed-frame hold | 0.25 s (`delay` on the opening) | — |
| Blades open | 0.55 s | `EASE_OUT` |
| Whole sequence | **≈ 1.0 s** | — |

Under `prefers-reduced-motion: reduce`: no blades, no delay — both `handleAnalyze` and `handleBack` swap
immediately and the existing screen crossfade is the entire transition.

### 4.6 Removals (make sure they are gone)

- The `isTransitioning` state, the `setTimeout(…, 450)` in `handleAnalyze`, and the whole old overlay block
  (`bg-black/95 backdrop-blur-2xl`, the pulsing rounded square, the centered label).
- Any now-unused imports or variables the deletion orphans.

---

## 5. REFINEMENT 4 — THE 50/50 RIGHT PANEL

The right card must own the entire right half: full column height, generous padding, typography that fills
the extra width instead of floating in the middle of it.

**Layout rails (both `header` and `main` move to the same 1600px rail so the wordmark and the split align):**

```tsx
<header className="mx-auto flex w-full max-w-[1600px] items-center justify-between pb-6">…</header>

<main className="mx-auto flex w-full max-w-[1600px] flex-1 items-stretch pb-8">
  <div className="grid w-full flex-1 grid-cols-1 items-stretch gap-8 lg:grid-cols-2 lg:gap-10">

    {/* LEFT — the optics, vertically centred in its half */}
    <div className="flex min-h-0 flex-col justify-center gap-6">…</div>

    {/* RIGHT — the intelligence, full height of the right half */}
    <aside className="flex h-full w-full flex-col rounded-2xl bg-surface p-10 ring-1 ring-white/10 xl:p-12">
      {/* inner stack: flex h-full flex-col gap-8; bottom nav row gets mt-auto pt-4 */}
    </aside>
  </div>
</main>
```

**Rules:**

- Grid: `lg:grid-cols-2`, `items-stretch`, `flex-1` on the grid — the two halves are exactly equal at `lg`
  and up; below `lg` it stays a single column (unchanged responsiveness).
- Panel: `bg-surface` (the existing `#101017` token), `ring-1 ring-white/10` hairline, `rounded-2xl`,
  `p-10 xl:p-12`, `h-full` — no centred `justify-center` card floating in space anymore.
- The card's `AnimatePresence` content stack keeps its swap behaviour, but becomes `flex h-full flex-col
  gap-8`, and the bottom navigation row (`dots` + `Previous` / `Next Clue`) moves to the bottom with
  `mt-auto pt-4` so the panel uses its whole height.
- **Scale the type up** (the panel is now roughly twice as wide): clue title `text-3xl xl:text-4xl`; the
  `CHARACTERISTIC:` body `text-[17px] xl:text-[19px] leading-relaxed`; the `EXPLANATION:` body
  `text-[15px] xl:text-base leading-relaxed`; probability bars `h-3`; bar numbers `text-sm`. Keep all mono
  labels, the `TOP MATCH` chip, and the lime bar styling exactly as they are.
- **The two image panes stay `w-full` with their own aspect ratios**, vertically centred in the left half.
  Do not stretch, squash, or clamp them — changing their box would break Refinement 2. On a short viewport
  the page scrolls; that is correct.

---

## 6. DESIGN RULES (restated, unchanged)

- Plain **black** canvas, **no grid**, no gradients. Obsidian **`#101017`** panels, mist **`#e9eaee`** text,
  **Electric Lime `#d6ff42`** as the only accent.
- **Space Grotesk** display, **Inter** body, **monospace** for labels and numbers.
- Motion comes only from [`Website/src/lib/motion.ts`](src/lib/motion.ts) (`EASE_OUT`, `EASE_IN_OUT`,
  `fadeUp`, `stagger`) — fades and small rises. Nothing pulses except nothing: with the old HUD gone, the
  screen has **no looping animation at all** while idle.
- Tailwind v4 gotchas: `bg-linear-*` (not `bg-gradient-*`), `size-*` not `h-* w-*`, arbitrary opacity as
  `ring-white/10` / `bg-white/[0.08]`; `ring-*` is a box-shadow and takes **no layout space** — that is why
  it is mandatory on the two image panes (§3.3).
- Accessibility: the crop box, blades, reticle frame and corner brackets are `aria-hidden`; the
  `ACQUIRING OPTICAL TARGET...` label is real text; `Back` / stepper buttons keep their `aria-label`s; focus
  rings stay intact.

---

## 7. DEFINITION OF DONE

1. `npm run typecheck` exits 0 with **no output**; `npm run build` succeeds; `npm run dev` shows **zero
   console errors or warnings**.
2. **Clutter gone:** neither image has a numbered chip, label row, file name, status badge, magnification
   readout, bouncing arrow, crosshair line or dashed ring around it. The only overlays are the lime crop box
   (panorama), corner brackets, and the right-panel content.
3. **Zoom is exact:** for every clue, the region inside the lime box on the panorama is *the same image
   region* shown in the zoom pane — same contents, same relative position, edge to edge. Verified by eye on
   clue 1, on clue 3, and after resizing the window.
4. **Aperture transition:** clicking `Find my location` closes the four blades, shows
   `ACQUIRING OPTICAL TARGET...` at the closed beat, swaps screens **while fully covered**, and opens onto
   Screen 2 — no flash of empty black, no blur sheet, and **no `setTimeout` in `App.tsx`**.
5. `← Upload another panorama` plays the same shutter and lands on Screen 1 with an empty upload zone and the
   panorama object URL revoked.
6. **50/50:** at `lg` and up the right panel occupies exactly the right half, stretches to the full column
   height, and the larger type scale fills it; header and main share the 1600px rail.
7. **Reduced motion:** with `prefers-reduced-motion: reduce`, screens swap immediately — no blades, no hold.
8. No new dependencies, no changes outside `InspectionView.tsx` / `App.tsx` / `lib/motion.ts`, Screen 1
   untouched, no reference anywhere to Challenges 1–3.

---

## 8. DO NOT

- Do not add labels or helper text back around the images "for clarity". The images are the interface.
- Do not keep or recreate `transform: scale()` + `transformOrigin` for the zoom — that is the bug, not the
  mechanism. §3.2 is the mechanism.
- Do not put a `border` or padding on the two image panes; hairlines are `ring-*`.
- Do not reintroduce `setTimeout`-driven transitions, `backdrop-blur`, loaders, or spinners.
- Do not animate anything except `opacity` inside the zoom viewport.
- Do not touch the clue copy, the percentages (Portugal / France / Spain, in that order), the `TOP MATCH`
  chip, the stepper, or the back button.
- Do not restyle Screen 1, add dependencies, or call anything over the network.

---

## 9. DELIVERABLE

Report back with:

1. The files changed and, for each, a one-line summary of the diff.
2. The exact commands run (`typecheck`, `build`, `dev`) and their results.
3. Confirmation of the §7 checks, explicitly including the visual check that the boxed region and the zoom
   show identical pixels on all three clues.
4. Anything in this spec you could **not** satisfy, and why — never a silent substitution.
