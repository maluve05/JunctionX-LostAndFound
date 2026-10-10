import { motion, useReducedMotion } from "framer-motion";
import {
  divIcon,
  latLngBounds,
  map as createMap,
  marker as createMarker,
  popup as createPopup,
  rectangle,
  tileLayer,
  type Map as LeafletMap,
  type Marker as LeafletMarker,
} from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, Building2, ChevronDown, MapPin, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PanoramaInput } from "@/components/UploadZone";
import { EASE_FORGE, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Screen 3 — the final results.
 *
 * Nothing on this screen competes with the answer: there is no top bar, no
 * filename, no caption over the map. Six ranked candidates on the left, the
 * same six places on a dark map on the right, and the panorama rolling away
 * into the map as the screen arrives.
 *
 * Leaflet is the only third-party widget on the site and it is kept on a short
 * leash: the basemap is Esri's key-free dark canvas, every pin and popup is
 * drawn with our own CSS, and the colours are read back out of the stylesheet
 * (`--color-lime`, …) so a pin can never drift from the palette.
 *
 * Leaflet owns its own DOM, so nothing inside the map can use Tailwind classes.
 * That vocabulary lives in `index.css` (`.map-pin`, `.map-aura`, `.map-popup`,
 * `.map-halo`, `.map-grid`, `.map-scan`) and the colours arrive as the `--pin`
 * / `--accent` custom properties.
 */

export interface ResultsViewProps {
  panorama: PanoramaInput;
  /** Reads as "go back to the clues": App.tsx closes the aperture back onto Screen 2. */
  onBack: () => void;
}

interface CoordinateResult {
  rank: number;
  lat: number;
  lng: number;
  /** Human-readable region, e.g. "Galicia, Spain". */
  label: string;
  countryCode: "es" | "pt" | "fr";
  countryFlag: string;
  city: string;
  /** 0–100. */
  probability: number;
}

/**
 * The analysis's answer, hard-coded: the Galicia-shaped conclusion the three
 * clues build towards, widened to every place the evidence still supports.
 * The shape is what a real backend would return, so swapping this array for a
 * fetch is the only change a live pipeline needs.
 */
const RESULTS: CoordinateResult[] = [
  {
    rank: 1,
    lat: 43.0098,
    lng: -8.17,
    label: "Galicia, Spain",
    countryCode: "es",
    countryFlag: "🇪🇸",
    city: "Santiago de Compostela",
    probability: 86,
  },
  {
    rank: 2,
    lat: 43.3619,
    lng: -8.4119,
    label: "A Coruña, Spain",
    countryCode: "es",
    countryFlag: "🇪🇸",
    city: "A Coruña",
    probability: 63,
  },
  {
    rank: 3,
    lat: 41.65,
    lng: -8.8262,
    label: "Minho, Portugal",
    countryCode: "pt",
    countryFlag: "🇵🇹",
    city: "Viana do Castelo",
    probability: 38,
  },
  {
    rank: 4,
    lat: 43.2951,
    lng: -2.9858,
    label: "Basque Country",
    countryCode: "es",
    countryFlag: "🇪🇸",
    city: "Bilbao",
    probability: 22,
  },
  {
    rank: 5,
    lat: 41.1579,
    lng: -8.6291,
    label: "Norte, Portugal",
    countryCode: "pt",
    countryFlag: "🇵🇹",
    city: "Porto",
    probability: 16,
  },
  {
    rank: 6,
    lat: 43.3619,
    lng: -5.8494,
    label: "Asturias, Spain",
    countryCode: "es",
    countryFlag: "🇪🇸",
    city: "Oviedo",
    probability: 11,
  },
];

const COUNTRY_NAMES: Record<CoordinateResult["countryCode"], string> = {
  es: "Spain",
  pt: "Portugal",
  fr: "France",
};

/**
 * One colour per rank — lime, sky, orange, then two steps of mist as the
 * evidence thins out. Written as literal Tailwind strings so the scanner can
 * see them: the tail of the list is deliberately the pale end, because the last
 * two are "everything else", not two more signals.
 *
 * `token` carries the same colour into Leaflet's DOM, which cannot use
 * classes; `fallback` only fires if the token is ever renamed away.
 */
interface RankStyle {
  token: string;
  fallback: string;
  text: string;
  bar: string;
  /** The detail card's icon chip: a low-alpha wash + hairline of the rank colour. */
  wash: string;
}

const RANK_STYLES: RankStyle[] = [
  {
    token: "--color-lime",
    fallback: "#d6ff42",
    text: "text-lime",
    bar: "bg-lime shadow-[0_0_12px_rgba(214,255,66,0.65)]",
    wash: "bg-lime/10 ring-lime/25",
  },
  {
    token: "--color-tier-city",
    fallback: "#38bdf8",
    text: "text-tier-city",
    bar: "bg-tier-city shadow-[0_0_12px_rgba(56,189,248,0.65)]",
    wash: "bg-tier-city/10 ring-tier-city/25",
  },
  {
    token: "--color-tier-street",
    fallback: "#f97316",
    text: "text-tier-street",
    bar: "bg-tier-street shadow-[0_0_12px_rgba(249,115,22,0.65)]",
    wash: "bg-tier-street/10 ring-tier-street/25",
  },
  {
    token: "--color-mist",
    fallback: "#e9eaee",
    text: "text-mist/70",
    bar: "bg-mist/60 shadow-[0_0_12px_rgba(233,234,238,0.35)]",
    wash: "bg-white/[0.06] ring-white/15",
  },
  {
    token: "--color-mist",
    fallback: "#e9eaee",
    text: "text-mist/50",
    bar: "bg-mist/40 shadow-[0_0_10px_rgba(233,234,238,0.25)]",
    wash: "bg-white/[0.05] ring-white/12",
  },
  {
    token: "--color-mist",
    fallback: "#e9eaee",
    text: "text-white/35",
    bar: "bg-white/25",
    wash: "bg-white/[0.04] ring-white/10",
  },
];

/** The glyph pool the Forge's `scramble()` decodes from — same characters. */
const GLYPHS = "<>/\\[]{}=+*#01ABCDEFXZ";

/**
 * Leaflet's DOM is out of Tailwind's reach, so the map reads the palette back
 * out of the stylesheet instead of repeating it as literals in here.
 */
function readToken(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** `#rrggbb` → `rgba(r, g, b, a)`; anything else is handed back untouched. */
function withAlpha(color: string, alpha: number) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return color;

  const value = Number.parseInt(hex[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** One frame of the decode: `t` of the label settled, the rest still noise. */
function scrambleFrame(text: string, t: number) {
  const settled = Math.floor(t * text.length);
  let out = text.slice(0, settled);

  for (let i = settled; i < text.length; i++) {
    out += text[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
  }

  return out;
}

/**
 * The Forge's `scramble()` (forge2026 `…/story/transitions.ts`) as a component:
 * the label decodes from noise into its text once, on entry. React owns the
 * string here, so the animation ticks through state instead of mutating the DOM
 * under React's feet, and reduced motion prints the label directly.
 */
function ScrambleText({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(() => (reduceMotion ? text : scrambleFrame(text, 0)));

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(text);
      return;
    }

    const start = performance.now() + delay * 1000;
    const duration = Math.min(900, 300 + text.length * 40);
    let raf = 0;

    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setDisplay(t === 1 ? text : scrambleFrame(text, t));
      if (t < 1) raf = window.requestAnimationFrame(step);
    };

    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [text, delay, reduceMotion]);

  return <span data-scramble>{display}</span>;
}

/** A marker is a divIcon around our own span, floated by `.map-pin`. */
function pinIcon(color: string, delaySeconds: number) {
  const dot = document.createElement("span");
  dot.className = "map-pin";
  dot.style.setProperty("--pin", color);
  dot.style.animationDelay = `${delaySeconds}s`;

  return divIcon({ className: "map-pin-wrap", html: dot, iconSize: [18, 18], iconAnchor: [9, 9] });
}

/**
 * The popup body, built as DOM rather than markup: it is text, and it stays
 * text no matter what a future backend puts in a label.
 */
function buildPopup(result: CoordinateResult, color: string) {
  const card = document.createElement("div");
  card.className = "map-popup";
  card.style.setProperty("--accent", color);

  const city = document.createElement("p");
  city.className = "map-popup-city";
  city.textContent = result.city;

  const coords = document.createElement("p");
  coords.className = "map-popup-coords";
  coords.textContent = `${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`;

  const label = document.createElement("p");
  label.className = "map-popup-label";
  label.textContent = `${result.countryFlag} ${result.label}`;

  card.append(city, coords, label);
  return card;
}

/**
 * How the reveal is choreographed, in milliseconds from mount. The screen is
 * already covered by the shutter when it mounts, so the panorama starts
 * dissolving the moment the blades part and the map finishes expressing itself
 * about two seconds later.
 */
const PIN_AT = 1000;
const PIN_STEP = 120;
/** After the last pin has landed, the camera pulls back to hold every candidate. */
const PULLBACK_AT = PIN_AT + RESULTS.length * PIN_STEP + 220;

export function ResultsView({ panorama, onBack }: ResultsViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const reduceMotion = useReducedMotion();
  const [panoPeek, setPanoPeek] = useState(false);
  /** The panorama rides over the map at full bleed until it has dissolved. */
  const [morph, setMorph] = useState(() => !reduceMotion);

  const top = RESULTS[0];
  const topStyle = RANK_STYLES[0];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const colors = RESULTS.map((_, index) => {
      const style = RANK_STYLES[index];
      return readToken(style.token, style.fallback);
    });

    const map = createMap(container, {
      zoomControl: true,
      scrollWheelZoom: true,
      // The credit under the map carries the attribution in our own type,
      // instead of Leaflet's white strip.
      attributionControl: false,
      zoomSnap: 0.5,
      // Esri's canvas stops here; the + control must stop with it.
      maxZoom: 16,
    });
    mapRef.current = map;

    // Esri's dark gray canvas, base then labels. CartoDB's public `dark_all`
    // (the spec's first choice) now answers every coordinate with the same
    // "API KEY REQUIRED" watermark tile, so a key-free basemap it is.
    tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16 },
    ).addTo(map);

    tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16 },
    ).addTo(map);

    // Open close in on the winner: the reveal is a pull-back, not a static
    // overview. The dissolve above it finishes while the map is still tight.
    map.setView([top.lat, top.lng], reduceMotion ? 6 : 11);

    // The search area: the box around every candidate, dashed and breathing.
    const bounds = latLngBounds(
      RESULTS.map((result): [number, number] => [result.lat, result.lng]),
    );
    rectangle(bounds.pad(0.15), {
      color: withAlpha(colors[0], 0.55),
      weight: 1.5,
      dashArray: "6 4",
      fill: false,
      interactive: false,
      className: "map-aura",
    }).addTo(map);

    markersRef.current = RESULTS.map((result, index) => {
      const color = colors[index];
      const dot = createMarker([result.lat, result.lng], {
        icon: pinIcon(color, index * 0.4),
        riseOnHover: true,
      });

      dot.bindPopup(
        createPopup({
          className: "dark-popup",
          closeButton: false,
          // The card's box is taller than the whole map on a narrow screen, so
          // Leaflet nudges the frame whenever it would otherwise hang over the
          // edge and be clipped by the panel.
          autoPan: true,
          autoPanPadding: [18, 18],
          offset: [0, -10],
        }).setContent(buildPopup(result, color)),
      );

      return dot;
    });

    // The pins land one by one once the panorama has dissolved away, then the
    // camera pulls back to hold all six at once.
    const timers: number[] = [];

    markersRef.current.forEach((dot, index) => {
      if (reduceMotion) {
        dot.addTo(map);
        return;
      }
      timers.push(window.setTimeout(() => dot.addTo(map), PIN_AT + index * PIN_STEP));
    });

    timers.push(
      window.setTimeout(
        () => map.fitBounds(bounds, { padding: [48, 48], animate: !reduceMotion, duration: 1 }),
        reduceMotion ? 0 : PULLBACK_AT,
      ),
    );

    // The container mounts behind the closed shutter: one size check after
    // layout keeps the tile grid aligned to the real box.
    const raf = window.requestAnimationFrame(() => map.invalidateSize());

    return () => {
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
      markersRef.current = [];
      mapRef.current = null;
      map.remove();
    };
  }, [reduceMotion, top.lat, top.lng]);

  /** Clicking a row flies the map to that candidate and opens its card. */
  const focusResult = (result: CoordinateResult, index: number) => {
    const map = mapRef.current;
    if (!map) return;

    const marker = markersRef.current[index];
    const target: [number, number] = [result.lat, result.lng];
    const zoom = Math.max(map.getZoom(), 9);

    if (reduceMotion) {
      map.setView(target, zoom, { animate: false });
      marker?.openPopup();
      return;
    }

    // The card opens once the camera has arrived: opening it mid-flight would
    // set Leaflet's auto-pan against our own movement.
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      map.off("moveend", open);
      window.clearTimeout(fallback);
      // The screen may have closed under the click; the map instance is gone.
      if (mapRef.current !== map) return;
      marker?.openPopup();
    };
    // `moveend` never fires if the camera was already there, so a timer backs it up.
    const fallback = window.setTimeout(open, 950);
    map.once("moveend", open);

    map.flyTo(target, zoom, { duration: 0.8 });
  };

  return (
    <div
      data-screen="results"
      className="relative z-10 flex min-h-screen w-full flex-col px-8 py-7 max-lg:h-dvh max-lg:min-h-0 max-lg:px-5 max-lg:py-4 [@media(max-height:960px)]:py-5"
    >
      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 items-stretch">
        {/* Below `lg` the screen is one viewport-tall column: the list keeps its
            natural height and the map takes the rest. Above it, the two-column
            composition steps in and none of this applies. */}
        <div className="grid w-full flex-1 grid-cols-1 items-stretch gap-8 max-lg:min-h-0 max-lg:grid-rows-[auto_minmax(0,1fr)] max-lg:gap-5 lg:grid-cols-[430px_minmax(0,1fr)] lg:gap-12">
          {/* ======================================================== */}
          {/* LEFT — the ranked answer, in words                        */}
          {/* ======================================================== */}
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="flex min-h-0 flex-col gap-5 max-lg:gap-3 [@media(max-height:960px)]:gap-4"
          >
            <h2
              data-heading
              className="font-mono text-[11px] font-semibold tracking-[0.22em] text-white/50 uppercase"
            >
              <span className="block overflow-hidden">
                <span className="line-rise">Most probable coordinates</span>
              </span>
              <span className="block overflow-hidden">
                <span className="line-rise line-rise-2">(by order)</span>
              </span>
            </h2>

            <ol
              data-results
              className="space-y-1 max-lg:space-y-0.5 [@media(max-height:960px)]:space-y-0.5"
            >
              {RESULTS.map((result, index) => {
                const style = RANK_STYLES[index];

                return (
                  <motion.li
                    key={result.rank}
                    initial={{ opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.3 + index * 0.12 }}
                  >
                    <button
                      type="button"
                      data-result-row
                      data-rank={result.rank}
                      onClick={() => focusResult(result, index)}
                      aria-label={`Candidate ${result.rank}: ${result.city}, ${result.probability} percent`}
                      className="group -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] max-lg:gap-2.5 max-lg:py-1 focus-visible:ring-2 focus-visible:ring-white/25"
                    >
                      <MapPin aria-hidden className={cn("size-3.5 shrink-0", style.text)} />

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between">
                          <span className={cn("font-mono text-[11px] font-semibold", style.text)}>
                            {String(result.rank).padStart(2, "0")}
                          </span>
                          <span className="font-mono text-[11px] text-white/40">
                            {result.probability}%
                          </span>
                        </span>

                        <span className="mt-0.5 block truncate text-[13.5px] text-mist max-lg:mt-0 max-lg:text-[13px]">
                          <ScrambleText text={result.label} delay={0.3 + index * 0.12} />
                        </span>

                        <span className="mt-1 block h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06] max-lg:mt-0.5">
                          <motion.span
                            initial={{ width: 0 }}
                            animate={{ width: `${result.probability}%` }}
                            transition={{ duration: 0.6, ease: "easeOut", delay: 0.8 }}
                            className={cn("block h-full rounded-full", style.bar)}
                          />
                        </span>
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ol>

            {/* The winner, spelled out */}
            <motion.div
              data-detail-card
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.35 }}
              className="hairline relative rounded-2xl bg-surface p-4 ring-1 ring-white/10 max-lg:p-3 [@media(max-height:960px)]:p-3.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl ring-1",
                    topStyle.wash,
                  )}
                >
                  <Shield aria-hidden className={cn("size-[18px]", topStyle.text)} />
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">
                    Most probable
                  </span>
                  <span className="block truncate text-[15px] font-semibold text-mist">
                    {top.label}
                  </span>
                </span>

                {/* Below `lg` the three tiles fold into this one line. */}
                <span
                  data-card-coords
                  className={cn(
                    "ml-auto hidden shrink-0 font-mono text-[11px] tracking-wider max-lg:block",
                    topStyle.text,
                  )}
                >
                  {top.lat.toFixed(3)}, {top.lng.toFixed(3)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2.5 max-lg:hidden">
                <span className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-2 p-2.5 ring-1 ring-white/[0.06]">
                  <span className="text-2xl leading-none">{top.countryFlag}</span>
                  <span className="font-mono text-[10px] tracking-wider text-white/40 uppercase">
                    {COUNTRY_NAMES[top.countryCode]}
                  </span>
                </span>

                <span className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-2 p-2.5 ring-1 ring-white/[0.06]">
                  <Building2 aria-hidden className="size-5 text-white/60" />
                  <span className="text-center font-mono text-[10px] tracking-wider text-white/40 uppercase">
                    {top.city}
                  </span>
                </span>

                <span className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-2 p-2.5 ring-1 ring-white/[0.06]">
                  <MapPin aria-hidden className={cn("size-5", topStyle.text)} />
                  <span
                    className={cn("text-center font-mono text-[10px] tracking-wider", topStyle.text)}
                  >
                    {top.lat.toFixed(3)}
                    <br />
                    {top.lng.toFixed(3)}
                  </span>
                </span>
              </div>
            </motion.div>

            {/* The panorama the answer came from, folded to a strip at the
                column's foot: unroll it to check the guess against the image. */}
            <button
              type="button"
              data-pano-strip
              aria-expanded={panoPeek}
              aria-label={panoPeek ? "Collapse the panorama" : "Expand the panorama"}
              onClick={() => setPanoPeek((value) => !value)}
              style={{ height: panoPeek ? 112 : 36 }}
              className="relative mt-auto block w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/40 motion-safe:transition-[height] motion-safe:duration-[400ms] motion-safe:ease-out-soft max-lg:hidden"
            >
              <img src={panorama.previewUrl} alt="" className="size-full object-cover opacity-70" />
              <span className="absolute inset-0 flex items-start justify-between p-2">
                <span className="pt-0.5 font-mono text-[10px] tracking-wider text-white/50 uppercase">
                  Panorama
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 text-white/50 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out-soft",
                    panoPeek ? "rotate-180" : "rotate-0",
                  )}
                />
              </span>
            </button>
          </motion.div>

          {/* ======================================================== */}
          {/* RIGHT — the answer, on the map                            */}
          {/* ======================================================== */}
          <div className="flex min-h-0 flex-col gap-5 max-lg:gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: EASE_FORGE, delay: 0.15 }}
              className="relative min-h-[340px] flex-1 max-lg:min-h-[160px]"
            >
              {/* Ambient depth behind the panel: a breathing halo and a slow dot
                  field, both painted under the map so the tiles stay crisp. */}
              <span
                aria-hidden
                className="map-halo pointer-events-none absolute -inset-x-14 -top-14 -bottom-[4.5rem] z-0"
              />
              <span aria-hidden className="map-grid pointer-events-none absolute -inset-10 z-0" />

              <div className="absolute inset-0 overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-white/10 shadow-[0_44px_120px_-56px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.05)]">
                {/* `z-0` gives the container its own stacking context, so Leaflet's
                    panes and controls can never rise above the shutter. */}
                <div ref={containerRef} data-map className="absolute inset-0 z-0" />

                {/* The Forge's scan sweep, run once as the map is revealed. */}
                <span
                  aria-hidden
                  data-map-scan
                  className="map-scan pointer-events-none absolute inset-0 z-[1]"
                />

                {/* Image → map: the panorama the answer came from fills the frame
                    the map will occupy, then dissolves into it. */}
                {morph && (
                  <motion.div
                    aria-hidden
                    data-pano-morph
                    initial={{ opacity: 1, scale: 1.07 }}
                    animate={{ opacity: 0, scale: 1 }}
                    transition={{ duration: 1.35, ease: EASE_FORGE, delay: 0.2 }}
                    onAnimationComplete={() => setMorph(false)}
                    className="pointer-events-none absolute inset-0 z-[2] overflow-hidden motion-reduce:hidden"
                  >
                    <img src={panorama.previewUrl} alt="" className="size-full object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/25 to-ink/75" />
                  </motion.div>
                )}

                <p
                  data-credit
                  className="pointer-events-none absolute bottom-1.5 left-2 z-[3] font-mono text-[10px] tracking-wide text-white/30"
                >
                  © Esri, HERE, Garmin · © OpenStreetMap contributors
                </p>
              </div>
            </motion.div>

            <div className="flex justify-center max-lg:block">
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }}>
                <Button
                  variant="outline"
                  size="lg"
                  data-action="back-to-clues"
                  onClick={onBack}
                  className="group border-lime/30 bg-lime/[0.08] px-9 text-[15px] font-semibold text-lime shadow-[0_18px_44px_-24px_rgba(214,255,66,0.55)] transition-colors hover:border-lime/55 hover:bg-lime/[0.16] hover:text-lime max-lg:w-full"
                >
                  <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                  Back to Clues
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
