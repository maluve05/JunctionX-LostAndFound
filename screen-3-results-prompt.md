# Lost & Found — Screen 3: Final Results View

## Context

You are working in the **Lost & Found** website located at `Website/` (a Vite + React 19 + TypeScript + Tailwind v4 project). The app already has three screens connected by a shared aperture-shutter transition in `App.tsx`:

- **Screen 1** — `LandingPage` (upload the panorama)
- **Screen 2** — `InspectionView` (clue-by-clue analysis; ends on a "Reveal Final Results" button)
- **Screen 3** — **ResultsView** (YOUR TASK — currently a no-op stub)

Your single deliverable is `Website/src/components/ResultsView.tsx` plus wiring changes in `Website/src/App.tsx`.

---

## Project Setup

### Stack (do not install anything new)
```
react 19, framer-motion 14, lucide-react, tailwindcss v4, typescript
```

The project already has Leaflet available **via CDN only** — add it by dropping two `<link>` and `<script>` tags into `Website/index.html` (Leaflet CSS + Leaflet JS UMD), then use `window.L` from within a `useEffect` hook. Do **not** `npm install leaflet`.

```html
<!-- In index.html <head>, before </head> -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

Then in TypeScript, reference the global via `declare const L: typeof import('leaflet')` at the top of the file, or cast `(window as any).L`.

### Tailwind v4 tokens (from `Website/src/index.css`)
```css
--color-ink:       #000000
--color-surface:   #101017
--color-surface-2: #14141d
--color-mist:      #e9eaee
--color-lime:      #d6ff42          /* electric lime — the signal colour */
--color-lime-strong: #c2ed2c
--color-tier-city:   #38bdf8        /* sky blue — clue 2 colour */
--color-tier-street: #f97316        /* orange — clue 3 colour */
--color-pt: #10b981   /* emerald — Portugal */
--color-fr: #3b82f6   /* blue    — France   */
--color-es: #f59e0b   /* amber   — Spain    */
```

Tailwind v4 class names you MUST use from this palette (never invent hex literals in JSX):
`text-lime`, `bg-lime`, `text-tier-city`, `bg-tier-city`, `text-tier-street`, `bg-tier-street`, `text-pt`, `bg-pt`, `text-fr`, `bg-fr`, `text-es`, `bg-es`, `bg-ink`, `bg-surface`, `bg-surface-2`, `text-mist`.

### Motion tokens (from `Website/src/lib/motion.ts`)
```ts
export const EASE_OUT:   [number,number,number,number] = [0.22, 1, 0.36, 1];
export const EASE_FORGE: [number,number,number,number] = [0.16, 1, 0.3,  1];
export const EASE_IN_OUT:[number,number,number,number] = [0.55, 0, 0.35, 1];
```
Import and reuse them — never write raw cubic-bezier strings.

### FORGe reference build animations (in `forge2026-main/forge2026-main/src/`)
Before writing any CSS animation, **read through these files** and steal their vocabulary for your keyframes and transitions:
- `src/styles.css` — look for `@keyframes doodle-float`, `doodle-spin`, `fg-enter`, `line-rise`, `doodle-draw`, `doodle-nudge`, `status-pulse`, `say-in`.
- `src/components/story/transitions.ts` — the `scramble()` text-decode effect and GSAP scroll entrances.
- `src/components/story/fx.ts` — spark and ring patterns.

Specifically, use these techniques:
1. **`doodle-float`** (6s ease-in-out infinite translateY −6 px): apply to each coordinate pin/marker on the map so pins breathe.
2. **`status-pulse`** (2.4 s ease-in-out infinite opacity 0.4→1→0.4): apply to the "aura rectangle" on the map.
3. **`fg-enter`** (opacity 0→1, translateY 22px→0, 1 s ease-out): the entrance animation for the coordinate list items.
4. **`line-rise`** (translateY 108%→0, 1.3 s ease-out, staggered per line): the entrance for the section title "MOST PROBABLE COORDINATES".
5. **`doodle-draw`** (stroke-dasharray/dashoffset loop): animate the SVG viewfinder rectangle / aura outline.
6. **`scramble()`** text-decode — replicate in plain JS (no GSAP): when a coordinate label enters, it "decodes" from glyphs into real text, just like the forge's chapter transitions do.

CSS transition timing on interactive elements **must** use `var(--ease-out-soft, cubic-bezier(0.22, 1, 0.36, 1))` (already defined in the project's `@theme`), or the imported JS constants via framer-motion.

---

## What to Build

### Layout (matches the schematic image exactly)

```
┌────────────────────────────────────────────────────────────────────────┐
│  [← Back to clues]           "The Winning Team"                        │  ← header (re-use InspectionView's header structure)
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  MOST PROBABLE            │    ┌──────────────────────────────────┐    │
│  COORDINATES (BY ORDER)   │    │                                  │    │
│                           │    │      INTERACTIVE MAP             │    │
│  🏠 coordinate 1 ████████│    │      (Leaflet, full height)      │    │
│                           │    │                                  │    │
│  🏠 coordinate 2 ████████│    │   ● Marker 1 (lime)              │    │
│                           │    │   ● Marker 2 (sky)              │    │
│  🏠 coordinate 3 ████████│    │   ● Marker 3 (orange)           │    │
│                           │    │   ● Marker 4 (mist/white)       │    │
│  🏠 coordinate 4 ████████│    └──────────────────────────────────┘    │
│                           │                                             │
│  ┌──────────────────────┐ │           [← Go Back to Clues]             │
│  │ 🛡 most prob place   │ │                                             │
│  │ 🏳 country flag emoji│ │                                             │
│  │ 🏢 city buildings    │ │                                             │
│  │ 📍 coordinate        │ │                                             │
│  └──────────────────────┘ │                                             │
│                           │                                             │
└───────────────────────────┴─────────────────────────────────────────────┘
```

Two columns:
- **Left column** (~440 px, same as the landing page spine): coordinate list + detail card below it.
- **Right column** (flex-1): the interactive map, full height.

---

## Mock Data

Hard-code this data; shape it so it is easy to replace with a real API response later:

```ts
interface CoordinateResult {
  rank: number;         // 1–4
  lat: number;
  lng: number;
  label: string;        // human-readable "Galicia, Spain"
  countryCode: "es" | "pt" | "fr";  // maps to Tailwind color token
  countryFlag: string;  // emoji flag
  city: string;
  probability: number;  // 0–100
}

const RESULTS: CoordinateResult[] = [
  { rank: 1, lat: 43.0098,  lng: -8.1700,  label: "Galicia, Spain",    countryCode: "es", countryFlag: "🇪🇸", city: "Santiago de Compostela", probability: 86 },
  { rank: 2, lat: 43.3619,  lng: -8.4119,  label: "A Coruña, Spain",   countryCode: "es", countryFlag: "🇪🇸", city: "A Coruña",               probability: 63 },
  { rank: 3, lat: 41.6500,  lng: -8.8262,  label: "Minho, Portugal",   countryCode: "pt", countryFlag: "🇵🇹", city: "Viana do Castelo",       probability: 38 },
  { rank: 4, lat: 43.2951,  lng: -2.9858,  label: "Basque Country",    countryCode: "es", countryFlag: "🇪🇸", city: "Bilbao",                 probability: 22 },
];
```

The per-rank colours (must match exactly):
```ts
const RANK_COLOR = ["lime", "tier-city", "tier-street", "mist"] as const;
// rank 1 → #d6ff42 (lime), rank 2 → #38bdf8 (sky), rank 3 → #f97316 (orange), rank 4 → white/mist
```

---

## Panorama-to-Map Transition (the hero animation)

The transition fires **once**, when `ResultsView` first mounts. It must feel like a camera morphing from the inspection image into the map.

### Phase 1 — Entry (duration ~0.9 s)
1. The left column (`opacity: 0, x: -28px`) enters with `framer-motion initial/animate` using `EASE_OUT`.
2. The map container starts as `opacity: 0, scale: 1.04` and animates to `opacity: 1, scale: 1` with a 150 ms delay, `EASE_FORGE` curve.
3. Both have `MotionConfig reducedMotion="user"` inherited from `App.tsx` — skip all animation when the user prefers reduced motion.

### Phase 2 — Map Reveal (after mount, inside `useEffect`)
1. Initialise the Leaflet map (see Leaflet section below).
2. Stagger-add markers one at a time (150 ms apart, rank 1 first).
3. After all markers are placed, fit the map bounds to all markers with a 400 ms animated pan/zoom.

### Phase 3 — Content Entrance (stagger, CSS-driven)
Apply the `fg-enter` keyframe staggered (using CSS `animation-delay`) to each coordinate row: rank 1 at 0.3 s, rank 2 at 0.45 s, rank 3 at 0.6 s, rank 4 at 0.75 s.

Use the `line-rise` animation on the heading "MOST PROBABLE COORDINATES".

---

## The Interactive Map (Leaflet)

### Initialisation
```ts
useEffect(() => {
  const L = (window as any).L;
  const map = L.map('results-map', {
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: false,
  });

  // Tile layer — use CartoDB dark (matches the ink design language)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(map);

  // Add markers (staggered, see below)
  // …

  return () => map.remove();
}, []);
```

### Markers
Each marker is a custom SVG div-icon, **not** the default blue pin. Build it as:
```ts
const makeIcon = (color: string, rank: number) => L.divIcon({
  className: '', // no default leaflet styles
  html: `
    <div style="
      width:20px; height:20px; border-radius:50%;
      background:${color}; border:2px solid rgba(0,0,0,0.5);
      box-shadow:0 0 12px ${color}, 0 0 24px ${color}40;
      animation: pin-float 6s ease-in-out ${rank * 0.4}s infinite;
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});
```

Define the `pin-float` keyframe in `Website/src/index.css`:
```css
@keyframes pin-float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-6px); }
}
```
This is **exactly** the `doodle-float` pattern from the Forge.

### Aura Rectangle Animation
Inside the map, after it initialises, create a Leaflet `L.rectangle` bounding the set of all result coordinates (with a small padding), styled with a dashed/animated stroke:
```ts
const bounds = L.latLngBounds(RESULTS.map(r => [r.lat, r.lng])).pad(0.15);
const aura = L.rectangle(bounds, {
  color: 'rgba(214,255,66,0.5)',   // lime
  weight: 1.5,
  dashArray: '6 4',
  fill: false,
  className: 'map-aura',
});
aura.addTo(map);
```

In `index.css`, add the aura pulse via CSS:
```css
.map-aura {
  animation: aura-pulse 2.4s ease-in-out infinite;
}
@keyframes aura-pulse {
  0%, 100% { stroke-opacity: 0.35; }
  50%       { stroke-opacity: 0.9;  }
}
```
This replicates the `status-pulse` pattern from `Website/src/index.css`.

### Popup on Click
Clicking a marker opens a Leaflet popup styled to match the dark surface aesthetic:
```ts
const popupHtml = `
<div style="background:#14141d;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 14px;min-width:160px;font-family:var(--font-sans)">
  <p style="color:${color};font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 4px">${result.city}</p>
  <p style="color:#fff;opacity:0.7;font-size:12px;font-family:monospace;margin:0">${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}</p>
  <p style="color:#fff;font-size:13px;margin:4px 0 0">${result.countryFlag} ${result.label}</p>
</div>
`;
marker.bindPopup(L.popup({ className: 'dark-popup', closeButton: false }).setContent(popupHtml));
```

In `index.css` neutralise Leaflet's default popup chrome:
```css
.dark-popup .leaflet-popup-content-wrapper,
.dark-popup .leaflet-popup-tip { background: transparent; box-shadow: none; }
.dark-popup .leaflet-popup-content { margin: 0; }
```

---

## Left Column — Coordinate List

### Section Heading
```tsx
<h2 className="font-mono text-[11px] font-semibold tracking-[0.22em] text-white/50 uppercase"
    style={{ animation: 'line-rise 1.3s cubic-bezier(0.22,1,0.36,1) 0.15s both' }}>
  Most Probable Coordinates<br/>(By Order)
</h2>
```

### Each Coordinate Row

```tsx
{RESULTS.map((result, i) => {
  const color = RANK_COLOR[i]; // "lime" | "tier-city" | "tier-street" | "mist"
  return (
    <div key={result.rank}
      style={{ animationDelay: `${0.3 + i * 0.15}s`, animation: 'fg-enter 1s cubic-bezier(0.22,1,0.36,1) both' }}
      className="group flex items-center gap-3 cursor-pointer hover:bg-white/[0.03] rounded-lg px-2 py-2 -mx-2 transition-colors"
      onClick={() => {/* pan map to this coordinate */}}
    >
      {/* Rank icon — use Lucide MapPin or Navigation, coloured with the rank colour */}
      <MapPin className={`size-4 shrink-0 text-${color}`} />

      {/* Label with probability bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`font-mono text-xs font-semibold text-${color}`}>
            {String(result.rank).padStart(2,'0')}
          </span>
          <span className="font-mono text-xs text-white/40">{result.probability}%</span>
        </div>
        <p className="text-[14px] text-mist truncate mt-0.5">{result.label}</p>
        {/* Probability bar */}
        <div className="mt-1.5 h-[2px] w-full rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full bg-${color}`}
            style={{ width: `${result.probability}%`, transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1) 0.8s' }}
          />
        </div>
      </div>
    </div>
  );
})}
```

**Scramble effect** — after each row enters, run the scramble animation on its label text (same as `scramble()` in `forge2026-main/forge2026-main/src/components/story/transitions.ts`). Replicate it in a plain hook:

```ts
function useScramble(ref: React.RefObject<HTMLElement>, delay: number) {
  useEffect(() => {
    const GLYPHS = "<>/\\[]{}=+*#01ABCDEFXZ";
    const el = ref.current;
    if (!el) return;
    const final = el.textContent ?? "";
    const start = performance.now() + delay;
    const duration = Math.min(900, 300 + final.length * 40);
    let raf = 0;
    const step = (now: number) => {
      if (now < start) { raf = requestAnimationFrame(step); return; }
      const t = Math.min(1, (now - start) / duration);
      const settled = Math.floor(t * final.length);
      let out = final.slice(0, settled);
      for (let i = settled; i < final.length; i++) {
        out += final[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (t < 1) raf = requestAnimationFrame(step);
      else el.textContent = final;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ref, delay]);
}
```

Apply it to each row's `<p>` label with staggered delays (`300, 450, 600, 750` ms).

---

## Bottom Detail Card

Below the coordinate list, a detail card shows the **top-ranked result** with richer information:

```tsx
<div className="mt-6 rounded-2xl bg-surface p-5 ring-1 ring-white/10 space-y-4">
  <div className="flex items-center gap-3">
    {/* Shield / most probable place icon */}
    <div className="grid size-10 place-items-center rounded-xl bg-lime/10 ring-1 ring-lime/25">
      <Shield className="size-5 text-lime" />
    </div>
    <div>
      <p className="font-mono text-[10px] text-white/40 tracking-[0.18em] uppercase">Most Probable</p>
      <p className="text-[15px] font-semibold text-mist">{topResult.label}</p>
    </div>
  </div>

  <div className="grid grid-cols-3 gap-3">
    {/* Country flag */}
    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-2 p-3 ring-1 ring-white/[0.06]">
      <span className="text-2xl leading-none">{topResult.countryFlag}</span>
      <span className="font-mono text-[10px] text-white/40 tracking-wider uppercase">Country</span>
    </div>
    {/* City (buildings icon) */}
    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-2 p-3 ring-1 ring-white/[0.06]">
      <Building2 className="size-6 text-white/60" />
      <span className="font-mono text-[10px] text-white/40 tracking-wider uppercase text-center">{topResult.city}</span>
    </div>
    {/* Coordinate (map pin icon) */}
    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-2 p-3 ring-1 ring-white/[0.06]">
      <MapPin className="size-6 text-lime" />
      <span className="font-mono text-[10px] text-lime tracking-wider text-center">
        {topResult.lat.toFixed(3)}<br/>{topResult.lng.toFixed(3)}
      </span>
    </div>
  </div>
</div>
```

---

## Panorama Film-Strip Toggle

The panorama image (the `panorama.previewUrl` prop) collapses into a small toggle strip at the **very bottom of the left column**. It starts as a thin horizontal strip (h-10, `overflow-hidden`, full-width, `rounded-xl`). Clicking it expands to `h-32` with a smooth `transition-[height] duration-400` ease-out. An expand/collapse icon on the right edge toggles it.

```tsx
const [panoPeek, setPanoPeek] = useState(false);

<div
  className="relative mt-auto cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/40"
  style={{ height: panoPeek ? 128 : 40, transition: 'height 0.4s cubic-bezier(0.22,1,0.36,1)' }}
  onClick={() => setPanoPeek(v => !v)}
>
  <img src={panorama.previewUrl} alt="" className="size-full object-cover opacity-70" />
  <div className="absolute inset-0 flex items-start justify-between p-2">
    <span className="font-mono text-[10px] text-white/50 tracking-wider uppercase pt-0.5">Panorama</span>
    <ChevronDown
      className="size-4 text-white/50 transition-transform duration-300"
      style={{ rotate: panoPeek ? '180deg' : '0deg' }}
    />
  </div>
</div>
```

---

## Go-Back Button

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={onBack}
  className="border-white/10 text-white/80 hover:bg-white/10"
>
  <ArrowLeft className="size-4" />
  Back to Clues
</Button>
```

This triggers the **same aperture-shutter mechanic** already in `App.tsx` (intent `"inspect"` → returns to `InspectionView`). No new transition system needed.

---

## App.tsx Wiring

The `handleViewResults` stub in `App.tsx` is currently a no-op. Wire it up:

1. Add `"results"` to the `Screen` type.
2. Add a `handleViewResults` that closes the shutter (intent `"results"`) and sets `screen = "results"` when it reopens.
3. Add a `handleBackToClues` that closes the shutter (intent `"inspect"`) and returns to `screen = "inspecting"`.
4. In the `AnimatePresence` block, add a third branch for `screen === "results"` that renders `<ResultsView panorama={panorama} onBack={handleBackToClues} />`.

The `ResultsView` **props interface**:
```ts
export interface ResultsViewProps {
  panorama: PanoramaInput;
  onBack: () => void;   // goes back to InspectionView
}
```

---

## Animation Catalogue (summary — implement all of these)

| Element | Animation | Source / inspiration |
|---|---|---|
| Coordinate list rows | `fg-enter` staggered (0.3–0.75 s) | `forge2026-main/src/styles.css → @keyframes fg-enter` |
| Section heading | `line-rise` (1.3 s, 0.15 s delay) | `forge2026-main/src/styles.css → @keyframes line-rise` |
| Coordinate label text | `scramble()` text-decode | `forge2026-main/src/components/story/transitions.ts → scramble()` |
| Map container | framer-motion `opacity+scale` entry | Matches InspectionView's own entry animation |
| Map markers (pins) | `pin-float` / `doodle-float` (6 s infinite) | `forge2026-main/src/styles.css → @keyframes doodle-float` |
| Map aura rectangle | `aura-pulse` (2.4 s infinite opacity) | `Website/src/index.css → @keyframes status-pulse` |
| Probability bars | width 0→value (0.6 s, 0.8 s delay) | Existing pattern in InspectionView.tsx |
| Panorama film-strip | `height` CSS transition (0.4 s) | — |
| Go-back button | framer-motion `whileHover/whileTap` | Existing UploadZone.tsx pattern |

---

## Design Constraints

- **No frosted glass** (no `backdrop-blur` anywhere).
- **No plain default colours** — every colour must come from the token palette above.
- **Map tile layer must be CartoDB Dark** (`dark_all`) to keep the ink aesthetic.
- The Leaflet default zoom controls are fine, but override their CSS to match: dark background, white icons, no border-radius beyond 2 px.
- Coordinate labels use `font-mono`; body text uses `font-sans` (`Inter Variable`).
- All transitions on interactive elements use the existing Tailwind `transition-colors duration-300` or the `EASE_OUT`/`EASE_FORGE` constants — never write raw `ms` values.
- Hover states: darken slightly (`hover:bg-white/[0.06]`) or brighten the accent colour by 10 % using `hover:opacity-90`. Never translate or scale a whole row.
- The section as a whole must be keyboard-accessible: each coordinate row is a `<button>` or has `tabIndex={0}` + `onKeyDown` Enter handler that pans the map.

---

## File Checklist

| File | Change |
|---|---|
| `Website/index.html` | Add Leaflet CDN `<link>` + `<script>` tags |
| `Website/src/index.css` | Add `@keyframes pin-float`, `@keyframes aura-pulse`, Leaflet popup dark overrides |
| `Website/src/App.tsx` | Extend `Screen` type; wire `handleViewResults` and `handleBackToClues`; add `"results"` branch |
| `Website/src/components/ResultsView.tsx` | **New file** — the entire results screen |

No other files need to change.

---

## Verification

After building, verify:

1. Clicking "Reveal Final Results" on clue 3 triggers the aperture shutter, then the results screen appears with a framer-motion entry animation.
2. The map renders (CartoDB Dark tiles visible), has 4 coloured animated markers, and a dashed lime aura rectangle.
3. Clicking any coordinate row pans/zooms the map to that coordinate.
4. Clicking a marker opens the dark popup.
5. The panorama film-strip toggle expands/collapses correctly.
6. "Back to Clues" returns to InspectionView via the shutter (not a hard navigate).
7. All coordinate labels show the scramble text-decode effect on entry.
8. With `prefers-reduced-motion: reduce`, no animations run and the screen appears instantly.
