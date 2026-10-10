# Lost & Found — "Forge" Landing Screen Build Prompt

> **How to use this file.** Paste everything below the horizontal rule into an AI coding agent that has
> this repository open. It is written to be self-contained: exact stack, exact tokens, exact copy, exact
> numbers, and a definition of done. Nothing here needs a backend, an API key, or a network call.
>
> This is the **second** revision of the landing screen. It replaces the original "cinematic glass"
> look with a handcrafted, high-end **technical** look adapted from the `forge2026-main` design
> library: plain obsidian and electric lime, an interactive canvas particle field, and clean optical
> precision. The frosted glass, the pastel aurora, the rainbow-cycling dashed border and the
> one-click sample pills are all **removed on purpose** — do not bring them back.

---

## ROLE

You are a senior frontend engineer. Build **one** screen: the desktop landing view of "Lost & Found",
a hackathon project by **The Winning Team**. The screen lets a user hand us a 360° panorama so we can
estimate which country it came from (**Portugal**, **France** or **Spain**) — and shows a QR code so a
judge can open the same app on a phone.

The output must look like a **precision instrument**, not a bootstrap form and not a generic AI
template. Think "mission-control viewfinder on obsidian", not "SaaS dashboard with a purple glow".

---

## 1. HARD SCOPE — READ THIS FIRST

**Build only the landing screen.** Specifically:

- ✅ One desktop-first route. No router, no navigation, no URL changes.
- ✅ Layout is designed for a **projector** (target viewport 1280×800 and up, capped at 1200px content width).
- ✅ Client-side only. **No backend, no fetch, no API calls, no model calls, no storage.**
- ✅ A single, clean seam for the next screen: the `onAnalyze` callback (see §8).
- ❌ Do **not** build the analysis/progress screen, the percentage breakdown ("99% France"), a results
  map, or a history list. Those are later screens and must slot in via `onAnalyze`.
- ❌ Do **not** build challenge / sample preset pills. **There are no built-in panoramas in the UI.**
  The upload zone is a pure, single-purpose panorama upload workflow.
- ❌ Do **not** add state management libraries (Redux/Zustand/Jotai), routers, form libraries, or
  component kits beyond what §2 lists.
- ❌ Do **not** invent an upload backend. When a panorama is chosen, hand it to `onAnalyze` and stop.

The whole point of this screen is that it is *pitch-proof*: nothing on it may block, stall, or fail
while someone is talking on stage.

---

## 2. STACK — USE EXACTLY THIS

| Concern | Choice |
|---|---|
| Build | Vite + React 19 + TypeScript (`react-ts` template) |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` (CSS-first config — there is **no** `tailwind.config.js`) |
| Icons | `lucide-react` |
| Animation | `framer-motion` (`motion`, `AnimatePresence`, `MotionConfig`) |
| QR | `qrcode.react` (named export `QRCodeSVG`) |
| Dropzone | `react-dropzone` (`useDropzone`, `type FileRejection`) |
| Variants | `class-variance-authority` + `clsx` + `tailwind-merge` |
| Fonts | `@fontsource-variable/inter`, `@fontsource-variable/space-grotesk` |
| Backdrop | **Hand-written HTML5 `<canvas>` 2D** — no Three.js, no particle library |

```bash
npm install framer-motion lucide-react qrcode.react react-dropzone \
  class-variance-authority clsx tailwind-merge \
  @fontsource-variable/inter @fontsource-variable/space-grotesk
npm install -D tailwindcss @tailwindcss/vite
```

**`vite.config.ts`** — the `@` alias is required, every import uses it:

```ts
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 5173 },
});
```

**`tsconfig.json`** — keep these on and honor them:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "types": ["node", "vite/client"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "vite.config.ts"]
}
```

### TypeScript rules (the build must pass `tsc --noEmit` with zero output)

- **No `any`.** Use real types or `unknown` + a guard.
- **No `@ts-ignore` / `@ts-expect-error` / non-null `!`** to silence the compiler.
- `verbatimModuleSyntax` is on: type-only imports **must** use `import type { X } from "..."`.
- `noUnusedLocals` / `noUnusedParameters` are on: delete anything you don't use.
- Type every event handler (`React.ChangeEvent`, `KeyboardEvent`, `PointerEvent`, etc. as needed).
- Prefer `type` aliases for object shapes; use `interface` only for extendable props.

---

## 3. DESIGN SYSTEM — PLAIN OBSIDIAN + ELECTRIC LIME

The rules, in one breath: **the page is obsidian and mist; electric lime is the one colour for "do
this".** No rainbow cycling. No frosted glass. No pastel halos. Surfaces are flat panels with crisp
1px hairlines. Colour is a privilege, not a default.

### Palette

```
ink        #0b0b0f   page background (obsidian)
surface    #101017   raised panels (the QR card, the analyse frame)
surface-2  #14141d   panel-on-panel
mist       #e9eaee   primary type / cold motes
lime       #d6ff42   the ONE signal colour: primary actions, active states, the "?" glyph
lime-strong #c2ed2c  lime's hover/active step
pt / fr / es         #10b981 / #3b82f6 / #f59e0b — ONLY in the country legend
```

Where colour is allowed: the primary button (lime), the drag-over edge (lime), the badge (lime),
the headline's `?` (lime), the hairline tick (lime), the canvas motes (mist + lime), and the three
country dots. Everywhere else is white/mist at low opacity on obsidian.

### Fonts

- Display / headings: **Space Grotesk Variable** (`--font-display`)
- Body / UI: **Inter Variable** (`--font-sans`)

Import both in `src/main.tsx` (`import "@fontsource-variable/inter";` etc.) — never a Google Fonts `<link>`.

### `src/index.css` — write exactly this shape

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Space Grotesk Variable", "Inter Variable", ui-sans-serif, system-ui, sans-serif;

  /* Obsidian surfaces */
  --color-ink: #0b0b0f;
  --color-surface: #101017;
  --color-surface-2: #14141d;

  /* Mist type + electric lime signal */
  --color-mist: #e9eaee;
  --color-lime: #d6ff42;
  --color-lime-strong: #c2ed2c;

  /* Country accents — used only in the country legend */
  --color-pt: #10b981;
  --color-fr: #3b82f6;
  --color-es: #f59e0b;

  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
}

@layer base {
  html { color-scheme: dark; }
  html, body, #root { min-height: 100%; }
  body {
    margin: 0;
    background-color: var(--color-ink);
    color: rgb(255 255 255 / 0.92);
    font-family: var(--font-sans);
    letter-spacing: -0.011em;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }
  ::selection { background: rgb(214 255 66 / 0.28); color: #0b0b0f; }
  :focus-visible { outline: none; }   /* focus is a crisp custom ring, never the UA outline */
}

@layer components {
  /* A flat obsidian panel with an inset hairline. No blur, no glass. */
  .panel {
    position: relative;
    background-color: var(--color-surface);
    border: 1px solid rgb(255 255 255 / 0.08);
    box-shadow:
      0 34px 90px -44px rgb(0 0 0 / 0.92),
      inset 0 1px 0 rgb(255 255 255 / 0.045);
  }

  /* A crisp 1px highlight riding the top edge, with a lime tick at its centre. */
  .hairline::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 1px;
    pointer-events: none;
    background: linear-gradient(90deg, transparent,
      rgb(233 234 238 / 0.2) 30%, rgb(214 255 66 / 0.55) 50%,
      rgb(233 234 238 / 0.2) 70%, transparent);
  }

  /* Edge falloff only; the grid and the motes live on the canvas. */
  .bg-vignette {
    background-image: radial-gradient(130% 100% at 50% 44%, transparent 42%, rgb(0 0 0 / 0.72) 100%);
  }

  .column-rule {
    background-image: linear-gradient(to bottom, transparent,
      rgb(255 255 255 / 0.1) 18%, rgb(255 255 255 / 0.1) 82%, transparent);
  }

  /* Viewfinder corner bracket: two adjacent 1px borders, crisp, faint lime lift. */
  .bracket {
    position: absolute;
    width: 34px;
    height: 34px;
    border-color: rgb(233 234 238 / 0.5);
    filter: drop-shadow(0 0 6px rgb(214 255 66 / 0.3));
  }

  .dropzone-idle {
    background-image: linear-gradient(180deg, rgb(233 234 238 / 0.035), transparent 62%);
  }
  .dropzone-active {
    box-shadow:
      0 0 0 1px rgb(214 255 66 / 0.5),
      0 22px 64px -26px rgb(214 255 66 / 0.4),
      inset 0 0 54px -22px rgb(214 255 66 / 0.28);
  }

  .status-pulse { animation: status-pulse 2.4s ease-in-out infinite; }
}

@keyframes status-pulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .status-pulse { animation: none; opacity: 0.8; }
}
```

### Tailwind v4 gotchas — get these right or the build will look broken

- Gradients are **`bg-linear-to-b`**, not `bg-gradient-to-b`.
- `scale` utilities must be named explicitly in a transition:
  `transition-[scale,box-shadow,background-color,border-color]`.
- Use the `size-*` shorthand (`size-16`), not `h-16 w-16`.
- Arbitrary opacity syntax is `bg-white/[0.03]`, and arbitrary shadows use `_` for spaces:
  `shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]`.
- Tokens declared in `@theme` become real utilities: `text-lime`, `bg-surface`, `text-mist`,
  `font-display`. `ring-lime/45` and `bg-lime-strong` both work.

### Removed on purpose (do not re-add)

Removed from the previous revision: `.glass-panel`, `.glass-sheen`, `.bg-aurora`, `.bg-grid`,
`.bg-grain`, `.dropzone-dashed`, `@keyframes dashed-cycle`, and the whole emerald/rainbow glow language.
If you find yourself writing `backdrop-filter: blur(...)` or a rainbow `border-color` keyframe, stop.

---

## 4. THE CANVAS PARTICLE FIELD (`Background.tsx`)

This is the signature of the redesign. A single full-screen `<canvas>` draws:

1. **Faint gridlines** every 64px in `rgba(233,234,238,0.045)` — "optical precision" underlay.
2. **Cold motes** — mist (78%) and electric lime (22%) dots that drift slowly, twinkle, wrap around
   the edges, and are **pushed gently out of the cursor's way** (soft proximity repulsion that relaxes
   back to the natural drift).

Requirements:

- Density scales with area: `count = clamp(26, round(w*h / 26000), 90)`.
- DPR is clamped to `min(devicePixelRatio, 2)`; the canvas resizes on `window` resize and rebuilds motes.
- Motes are drawn **additively** (`globalCompositeOperation = "lighter"`), each with a soft halo plus a
  solid core, so overlaps burn brighter.
- Pointer repulsion: radius 150px, force 640; a mote's velocity relaxes toward its natural drift with
  `1 - exp(-0.9 * dt)` so it recovers smoothly after the cursor leaves.
- Wrap (not bounce) at the edges, with a 20px margin, so the field never empties.
- **Accessibility:** if `prefers-reduced-motion: reduce`, draw **one static frame** and never start the
  RAF loop. React to the media query changing live.
- **Perf:** cancel the RAF loop while `document.hidden`; clamp `dt` to avoid a jump after a pause.
- The canvas is `aria-hidden`, `pointer-events-none`, `fixed inset-0`, `z-0`, and masked with
  `radial-gradient(130% 105% at 50% 42%, #000 26%, transparent 82%)` so the grid fades at the edges.
- The vignette (`.bg-vignette`) sits as a second layer above the canvas.

Contract for the component: export a parameterless `Background()` that owns its own refs and effect.
Sketch (fill in the detail per the rules above):

```tsx
import { useEffect, useRef } from "react";

const MIST = "233,234,238";
const LIME = "214,255,66";
const GRID = 64;
const POINTER_RADIUS = 150;
const POINTER_FORCE = 640;

type Mote = {
  x: number; y: number;
  vx: number; vy: number;   // current velocity
  nvx: number; nvy: number; // natural drift it relaxes back to
  r: number; lime: boolean; base: number; phase: number; twinkle: number;
};

export function Background() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    /* ctx = canvas.getContext("2d"); resize() sets dpr + size + motes;
       drawGrid(); drawMote(); draw(); step(dt); frame(time);
       start()/stop() gate the RAF loop; pointer + visibility + media listeners;
       return a cleanup that removes every listener and cancels the frame. */
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        style={{
          maskImage: "radial-gradient(130% 105% at 50% 42%, #000 26%, transparent 82%)",
          WebkitMaskImage: "radial-gradient(130% 105% at 50% 42%, #000 26%, transparent 82%)",
        }}
      />
      <div className="absolute inset-0 bg-vignette" />
    </div>
  );
}
```

---

## 5. LAYOUT BLUEPRINT (match the schematic)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          " THE WINNING TEAM "                            │  ← header, centred, tracked-out
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│     ┌──────────────┐   │    ┌ LOST & FOUND ┐                              │
│     │ ⌐          ¬ │   │    Where am I?                                  │
│     │              │   │    Drop a panorama. We'll find the country.     │
│     │   ▓▓▓▓▓▓▓▓   │   │    ┌────────────────────────────────────────┐   │
│     │   ▓  QR  ▓   │   │    │        ↑  upload  ＋                    │   │
│     │   ▓▓▓▓▓▓▓▓   │   │    │        Upload image                    │   │
│     │              │   │    │  Drag & drop or click · JPG, PNG, WEBP │   │
│     │ Scan to try it│  │    └────────────────────────────────────────┘   │
│     │ ∟          ⌐ │   │    ● Portugal  ·  ● France  ·  ● Spain         │
│     └──────────────┘   │                                                 │
│                        │                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                        ① Upload → ② Analyze → ③ Locate                   │  ← bottom strip
└──────────────────────────────────────────────────────────────────────────┘
                                                    ▲ interactive canvas + grid behind everything
```

- Root: `min-h-screen`, `flex flex-col`, `overflow-x-hidden`, backdrop fixed behind everything.
- `main` takes the remaining height and vertically centres its child.
- Content row: `w-full max-w-[1200px] min-w-[1120px] grid grid-cols-[400px_minmax(0,1fr)] items-center gap-x-20`.
  - `min-w-[1120px]` + an `overflow-x-auto` parent means a narrower window **scrolls sideways** instead of
    cramping the design. That is intentional — this is a laptop/projector layout, not a mobile one.
  - The vertical hairline "spine" between the columns is absolutely positioned at `left-[440px]`
    (`inset-y-6 w-px`, class `column-rule`, `aria-hidden`).
- Header: `flex justify-center pt-11`. Footer strip: `flex justify-center pb-10`.

---

## 6. FILE LAYOUT

```
src/
├── main.tsx                       # fonts + createRoot, StrictMode
├── index.css                      # §3 tokens & component classes
├── App.tsx                        # owns screen switch + `onAnalyze`
├── lib/
│   ├── utils.ts                   # cn(), formatBytes()
│   └── motion.ts                  # EASE_OUT, stagger, fadeUp, fadeIn
└── components/
    ├── LandingPage.tsx            # the screen: header + two columns + strip
    ├── Background.tsx             # the canvas particle field (§4)
    ├── Header.tsx
    ├── QrCard.tsx
    ├── UploadZone.tsx
    ├── CountryDots.tsx
    ├── StepsStrip.tsx
    ├── CornerBrackets.tsx
    ├── AnalyzingView.tsx          # the screen `onAnalyze` leads to
    └── ui/
        ├── button.tsx             # cva: primary | outline | ghost; sm | default | lg | icon
        └── badge.tsx              # cva: neutral | accent
```

Keep components dumb and prop-driven. `LandingPage` is the only one that knows the screen exists.

---

## 7. SHARED PRIMITIVES

**`lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

**`lib/motion.ts`** — one motion vocabulary for the whole screen. Nothing loops, nothing bounces.

```ts
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.085, delayChildren: 0.06 } },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: EASE_OUT } },
};
```

Wrap the tree in `<MotionConfig reducedMotion="user">` so `prefers-reduced-motion` drops every
transform while keeping the opacity fades.

**`ui/button.tsx`** — `class-variance-authority`, variants `primary | outline | ghost`, sizes
`sm | default | lg | icon`.

- `primary` is the **only** loud control on the page — flat electric lime, black type:
  `"bg-lime font-semibold text-ink shadow-[0_12px_30px_-14px_rgb(214_255_66/0.7)] hover:bg-lime-strong active:bg-lime-strong active:brightness-[0.97]"`.
- `outline` is `"border border-white/12 bg-white/[0.03] text-mist/80 hover:border-white/25 hover:bg-white/[0.07] hover:text-white"`.
- `ghost` is `"text-white/55 hover:bg-white/[0.06] hover:text-white"` (the "Remove" button).
- Shared: `rounded-xl`, `gap-2`, `inline-flex items-center justify-center`, and a
  `focus-visible:ring-2 focus-visible:ring-lime/45 focus-visible:ring-offset-2 focus-visible:ring-offset-ink`.
- Props type: `ComponentProps<"button"> & VariantProps<typeof buttonVariants>`, forwarded with rest spread.
  Do **not** use `forwardRef`.

**`ui/badge.tsx`** — `cva` span, variants `neutral` (`border-white/12 bg-white/[0.04] text-mist/70`) and
`accent` (`border-lime/30 bg-lime/10 text-lime`). Shared shape:
`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium tracking-[0.16em] uppercase`.

---

## 8. COMPONENT SPECS

### `Background.tsx`
See §4. Fixed, `pointer-events-none`, `inset-0`, `z-0`, `aria-hidden`. Canvas + `.bg-vignette`.

### `Header.tsx`
Centred, one line. The team name is **uppercase, tracked out, and wrapped in real typographic quotes**:

```
“  THE WINNING TEAM  ”
```

- Name: `text-[12px] font-medium tracking-[0.42em] whitespace-nowrap text-white/60 uppercase`.
- The two quote glyphs are `&ldquo;` / `&rdquo;` rendered in `font-display text-[26px] leading-none text-white/25`,
  nudged up (`-mt-1`) and `select-none` + `aria-hidden`.

### `QrCard.tsx` — the left column

- A **crisp obsidian panel**, not glass: classes `panel hairline`, **400×520px** (`w-[400px] h-[520px]`),
  `rounded-2xl`, `overflow-hidden`, centred content with `gap-9`.
- **Viewfinder corner brackets** (`<CornerBrackets />`): four absolutely-positioned 34px `span`s inset
  20px from each corner, each drawing **two** adjacent 1px borders with the matching corner rounded
  (`top-5 left-5 rounded-tl-xl border-t border-l`, and so on). Class `bracket`. This is the single
  strongest visual signature of the screen — get it right.
- **QR:** a white `rounded-lg` pad with `p-[22px]` and a crisp drop shadow,
  containing `<QRCodeSVG size={252} level="Q" bgColor="#ffffff" fgColor="#0b0b0f" marginSize={0} />`.
  Always pass `title="QR code to open Lost & Found"` and an explicit `value`.
- Destination URL comes from env with a safe fallback:
  `const APP_URL = import.meta.env.VITE_APP_URL ?? "https://example.com";`
- Caption below: `Scan to try it` — `text-[13px] text-mist/50`.
- **No blurred halo, no emerald glow.** The panel + brackets + hairline carry it.

### `UploadZone.tsx` — the centrepiece

`useDropzone` config:

```ts
const MAX_SIZE = 25 * 1024 * 1024;

const ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

useDropzone({
  onDrop,
  accept: ACCEPT,
  maxSize: MAX_SIZE,
  multiple: false,
  noClick: file !== null,      // once filled, clicks belong to the buttons inside
  noKeyboard: file !== null,
});
```

**Two states, swapped with `<AnimatePresence mode="wait" initial={false}>`.**

*Empty state*
- A `rounded-lg` bordered box, `min-h-[178px]`, class `dropzone-idle`, `cursor-pointer`, a
  `border-dashed border-white/15` edge that lifts to `hover:border-white/25 hover:bg-white/[0.03]`.
- Centre stack (`gap-5`, `text-center`, `pointer-events-none`):
  - a 16×16 (`size-16`) `rounded-lg` tile with a flat `bg-white/[0.03]` fill and a hairline border,
    holding an **`Upload`** lucide icon at `strokeWidth={1.6}`; the icon lifts `-translate-y-0.5` on
    hover (group hover).
  - Overlapping the tile's bottom-right corner, a `size-6` **electric-lime** square (`bg-lime text-ink
    ring-2 ring-ink`) with a **`Plus`** icon at `strokeWidth={3}`. This is the `＋` from the schematic.
  - Primary line: `Upload image` — `font-display text-[17px] font-medium text-mist`.
  - Secondary line: `Drag & drop or click · JPG, PNG, WEBP` — `text-[12px] text-white/40`.

*Drag states*
- `isDragActive` → `scale-[1.015]`, class `dropzone-active`, `border-lime/70`. **The edge illuminates
  electric lime** — no colour cycling, it simply holds.
- `isDragReject` → `border-es/70 bg-es/[0.06]`.

*Filled state* (entrance `opacity 0, y: 6` → `opacity 1, y: 0`, `duration: 0.28`, `EASE_OUT`)
- Border becomes solid `border-white/10`, surface `bg-white/[0.03]`.
- A **96×64** thumbnail: `relative h-16 w-24 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40`,
  image at `size-full object-cover`, with a centred `Image` icon fallback.
  **Manage the object URL correctly** — create it in an effect keyed on `file`, and
  `URL.revokeObjectURL` in the effect's cleanup. Never leak one per render.
- File name: `truncate text-[14px] font-medium text-mist`.
- Meta row: `${formatBytes(file.size)} · Panorama ready` — `text-[12px] text-white/40`.
- Right side: ghost **`Remove`** button (`X` icon, `size="sm"`) and the **primary** **`Find my location`**
  button (`MapPin` icon, `size="lg"`), the latter on a `motion.div` doing `whileHover={{ y: -1 }}` /
  `whileTap={{ scale: 0.98 }}`.
- Stop propagation on the inner container's click so interacting with buttons never re-triggers the zone.

*Rejections → human copy.* Never surface a raw dropzone error code. Map them:

| code | message |
|---|---|
| `file-too-large` | `{name} is over 25 MB. Try a lighter export of the panorama.` |
| `file-too-small` | `{name} looks empty. Try another panorama.` |
| `too-many-files` | `One panorama at a time, please.` |
| `file-invalid-type` | `That file type isn't supported. Use a JPG, PNG or WEBP panorama.` |
| default | `We couldn't read that file. Try another image.` |

Render as a `motion.p` with `role="alert"`, a soft amber treatment
(`border-es/20 bg-es/[0.08] text-amber-200/90`), and a `size-1.5` amber dot. Clear the error the moment
a new drag starts or the file is removed.

*Keyboard:* the zone is clickable, so it must be reachable and operable by keyboard. Handle `Enter`/`Space`
on the wrapper to call `open()`, with a `focus-visible:ring-2 focus-visible:ring-lime/40`.

> **No sample / challenge pills.** There is no `SAMPLE_PRESETS`, no bundled panorama import, no
> "Or jump straight in" row. The upload zone is the only way in.

### `CountryDots.tsx`
One muted row: `Portugal · France · Spain`, in that order, with a `size-[7px]` dot per country
(`backgroundColor: <color>`, a soft `boxShadow: 0 0 0 3px <color>26` ring — **not** a neon glow).
Text `text-[13px] text-mist/45`; separators are `text-white/15`. This is the only place the three
country colours appear.

### `StepsStrip.tsx`
A bottom-centred pill: `rounded-full border border-white/10 bg-white/[0.02] px-6 py-2.5` (no blur).
An `<ol>` of three steps — **`Upload` → `Analyze` → `Locate`** — each a numbered `size-5` circle
(`font-mono text-[10px] text-lime/70`) next to `text-[11px] font-medium tracking-[0.18em] uppercase text-mist/40`,
separated by `ArrowRight` icons at `size-3.5 text-mist/20`.

### `CornerBrackets.tsx`
The four brackets, in one place, reused by the QR card and the analyse preview:

```tsx
const CORNERS = [
  "top-5 left-5 rounded-tl-xl border-t border-l",
  "top-5 right-5 rounded-tr-xl border-t border-r",
  "right-5 bottom-5 rounded-br-xl border-r border-b",
  "bottom-5 left-5 rounded-bl-xl border-b border-l",
];
```

Each is a `<span className={cn("bracket", corner)} />` inside a `pointer-events-none absolute inset-0`
`aria-hidden` wrapper.

### `AnalyzingView.tsx` — where `onAnalyze` lands
Same language: the panorama sits in a `panel hairline rounded-2xl` frame with `CornerBrackets`; the
scanning line is **lime** (`via-lime/80`); completed stages use `border-lime/40 bg-lime/15 text-lime`;
the status dot is `status-pulse ... bg-lime`; the back button is `variant="outline"`. Esc returns to
the landing screen.

---

## 9. THE INTEGRATION CONTRACT (most important part)

The landing screen must not know what happens next. `App.tsx` owns the seam:

```tsx
import { MotionConfig, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { AnalyzingView } from "@/components/AnalyzingView";
import { Background } from "@/components/Background";
import { LandingPage } from "@/components/LandingPage";
import type { PanoramaInput } from "@/components/UploadZone";
import { stagger } from "@/lib/motion";

type Screen = "landing" | "analyzing";

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [panorama, setPanorama] = useState<PanoramaInput | null>(null);

  // The upload's blob URL has to outlive the landing screen, so `App` owns it.
  useEffect(() => {
    if (!panorama) return;
    const { previewUrl } = panorama;
    return () => URL.revokeObjectURL(previewUrl);
  }, [panorama]);

  const handleAnalyze = (input: PanoramaInput) => {
    setPanorama(input);
    setScreen("analyzing");
  };

  const handleBack = () => {
    setScreen("landing");
    setPanorama(null);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen">
        <Background />
        <motion.div key={screen} variants={stagger} initial="hidden" animate="show" className="relative flex min-h-screen flex-col overflow-x-hidden">
          {screen === "analyzing" && panorama ? (
            <AnalyzingView panorama={panorama} onBack={handleBack} />
          ) : (
            <LandingPage onAnalyze={handleAnalyze} />
          )}
        </motion.div>
      </div>
    </MotionConfig>
  );
}
```

```ts
// components/UploadZone.tsx
export type PanoramaInput = {
  file: File;
  /** A URL of its own, so the analysing screen can keep showing the panorama. */
  previewUrl: string;
  name: string;
};
```

Requirements for this seam:

- `onAnalyze` receives a `PanoramaInput` — a `File`, a dedicated `previewUrl` (created fresh when the
  handoff happens), and the file's `name`.
- Every route to analysis calls `onAnalyze` exactly once: the `Find my location` button.
- The landing screen renders **no** results, **no** percentages, and **no** loading spinner. A later
  screen does that, driven by `onAnalyze`.

---

## 10. CONTENT — USE THESE STRINGS EXACTLY

| Where | Text |
|---|---|
| Header | `“ THE WINNING TEAM ”` |
| Badge | `Lost & Found` |
| Headline | `Where am I?` (the `?` in `text-lime`, everything else in the white→white/65 gradient) |
| Sub-headline | `Drop a panorama. We'll find the country.` |
| Dropzone title | `Upload image` |
| Dropzone hint | `Drag & drop or click · JPG, PNG, WEBP` |
| Filled meta | `Panorama ready` |
| Buttons | `Remove` / `Find my location` |
| QR caption | `Scan to try it` |
| Footer steps | `Upload` · `Analyze` · `Locate` |

Headline styling: `font-display`, `text-[64px]`, `leading-[1.02]`, `font-medium`, `tracking-[-0.03em]`,
`bg-linear-to-b from-white to-white/65 bg-clip-text text-transparent`.
Sub-headline: `max-w-[520px] text-[19px] text-white/60`.
Badge: `variant="accent"`. Right column stack: `flex flex-col items-start gap-6`.

`index.html`: `<html lang="en" class="dark">`, `<meta name="theme-color" content="#0b0b0f">`, a real
`<title>` (`Lost & Found — The Winning Team`), a description, an **electric-lime** inline SVG favicon,
and an inline `background-color: #0b0b0f` on `html, body` in a `<style>` block so the page never
flashes white before the CSS loads.

---

## 11. ACCESSIBILITY

- Decorative layers (`Background`, corner brackets, dots, separators, the quote glyphs) get `aria-hidden`.
- The dropzone wrapper is keyboard-operable: Enter/Space opens the picker, `focus-visible` shows the ring.
- Rejections render in a `role="alert"` element.
- The QR has a `title`; the canvas is `aria-hidden` and `pointer-events-none`.
- Text contrast: body copy is `white/60` or lighter on `#0b0b0f` (≥ 4.5:1). Anything at `white/40` is
  decorative micro-copy only.
- Respect `prefers-reduced-motion`: `MotionConfig reducedMotion="user"`, the canvas **static-frame**
  branch, **and** the CSS media query in §3.

---

## 12. DEFINITION OF DONE

A change is only complete when **all** of these hold:

1. `npm run typecheck` (`tsc --noEmit`) exits 0 with **no output**.
2. `npm run build` succeeds.
3. `npm run dev` serves the screen and it renders with **zero console errors or warnings**.
4. The layout matches §5: header, 400px QR card with four corner brackets, right column, bottom strip,
   vertical spine, and `max-w-[1200px]` on a 1280px viewport.
5. **The background is a live canvas**: motes drift, react to the cursor, and the grid fades at the edges.
6. The palette is **plain obsidian + mist + electric lime**: no rainbow cycling, no pastel aurora,
   no frosted-glass panel. `prefers-reduced-motion` freezes the canvas to a still frame.
7. Dragging a valid JPG over the dropzone: the edge illuminates **electric lime**, the box scales up.
   Dropping it swaps to the filled state with thumbnail, name, size, `Remove`, `Find my location`.
8. Dropping a `.pdf` (or any invalid type) shows the amber `role="alert"` copy and **no** crash.
9. Dropping a 30 MB image shows the "over 25 MB" message.
10. `Remove` returns the zone to the empty state and revokes the object URL.
11. **There are no challenge / sample pills anywhere in the UI.**
12. Clicking `Find my location` calls `onAnalyze` once with the `PanoramaInput` (file + preview URL + name)
    and the screen switches to the analysing view.

---

## 13. DO NOT

- Do not add a router, a state library, a backend call, or an auth flow.
- Do not add challenge preset pills, sample panoramas, or any bundled `_scratch` imports.
- Do not reintroduce glassmorphism (`backdrop-filter`), a rainbow/cycling border, or emerald glows.
- Do not add a fake loading spinner or a fake progress bar on **this** screen — the analysing view owns that.
- Do not use `localStorage`/`sessionStorage` to persist the chosen file.
- Do not reach for a component kit (MUI, Chakra, shadcn CLI, Radix) — the primitives in §7 are enough.
- Do not pull in a particle/3D library — the canvas field is hand-written.
- Do not hard-code the deployment QR URL — read it from `VITE_APP_URL`.
- Do not parse the panorama, call a model, or guess a country. That is a later screen.

---

## 14. DELIVERABLE

When you are done, report back with:

1. The list of files created or changed.
2. The exact commands you ran and their results (`typecheck`, `build`, `dev`).
3. A short note on anything in the spec you could not satisfy, and why — rather than silently
   substituting your own design decision.
