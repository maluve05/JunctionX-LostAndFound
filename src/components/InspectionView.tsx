import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crosshair,
  Eye,
  Layers,
  type LucideIcon,
  MapPin,
  Microscope,
  Mountain,
  Route,
  Ruler,
  Signpost,
  Sparkles,
  Tag,
  TrafficCone,
  Trees,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PanoramaInput } from "@/components/UploadZone";
import { EASE_FORGE, EASE_OUT } from "@/lib/motion";
import type { GeolocationResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface InspectionViewProps {
  panorama: PanoramaInput;
  result?: GeolocationResult | null;
  onBack: () => void;
  /** Fires when the presenter asks for the final results from the last clue. */
  onViewResults?: () => void;
  /** Which clue to open on — a fresh analysis starts at the first. */
  initialSlideIndex?: number;
}

/** The panorama pane's aspect ratio (`aspect-21/9`) — the zoom math derives from it. */
const PANE_ASPECT = 21 / 9;

/** How long the camera takes to travel from one clue's crop box to the next. */
const MORPH_SECONDS = 0.62;

/** The panel waits this long before its copy swaps, so the eye follows the camera first. */
const COPY_DELAY = 0.18;

/** Country → city → street: each tier narrows the search radius. */
type Tier = "COUNTRY" | "CITY" | "STREET";

/**
 * A clue's crop box: fractions of the panorama pane (0–1, top-left anchored).
 * The highlight draws exactly this rectangle on the panorama, and the zoom pane
 * shows exactly the image pixels underneath it. Keep `0.80 ≤ w/h ≤ 0.90`: the
 * zoom pane's height is `columnWidth / ((w/h) * PANE_ASPECT)`.
 */
interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Probability {
  country: "SPAIN" | "PORTUGAL" | "FRANCE";
  value: number;
  /** Exactly one per clue carries this. */
  top?: true;
}

/** One bite-sized fact about the clue: an icon, a mono label and a single sentence. */
interface Insight {
  icon: LucideIcon;
  /** mono, uppercase, ≤ 3 words */
  label: string;
  /** one sentence, ≤ 14 words */
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
  box: CropBox;
}

/**
 * Every class here is a literal string: Tailwind cannot see class names built at
 * runtime, so the clue colours live in these frozen objects.
 *
 * The active clue's colour is the screen's signal: every element that carries
 * emphasis binds to it, and never more than one clue colour is on screen.
 */
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

/**
 * `<Button>`'s default `primary` variant hardcodes lime in five places (bg, type,
 * an elevation glow, the focus ring and the active state). Passing `solid` as the
 * later `className` lets `twMerge` drop the first four, so every slot repeats its
 * own shadow, focus ring, hover and active colour.
 */
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

const TIERS: Record<Tier, { radiusKm: number; convergence: number; accent: ClueAccent }> = {
  COUNTRY: { radiusKm: 300, convergence: 33, accent: ACCENT_COUNTRY },
  CITY: { radiusKm: 50, convergence: 66, accent: ACCENT_CITY },
  STREET: { radiusKm: 5, convergence: 100, accent: ACCENT_STREET },
};

const TIER_ORDER: Tier[] = ["COUNTRY", "CITY", "STREET"];

const CLUE_SLIDES: ClueSlide[] = [
  {
    id: 1,
    tier: "COUNTRY",
    category: "Visual Intelligence · Road Infrastructure",
    title: "Spanish Roadside Reflector Bollard",
    insights: [
      {
        icon: Ruler,
        label: "Marker profile",
        fact: "White cylindrical post, roughly a metre tall, square flat top.",
      },
      {
        icon: Signpost,
        label: "Reflector band",
        fact: "One horizontal amber band on a plain white barrel.",
      },
      {
        icon: Trees,
        label: "Flora",
        fact: "Clipped eucalyptus line behind it — a Galician timber-plot signature.",
      },
      {
        icon: Compass,
        label: "Excludes",
        fact: "Not Portugal's black plastic delineator, nor France's red-capped post.",
      },
    ],
    probabilities: [
      { country: "SPAIN", value: 78, top: true },
      { country: "PORTUGAL", value: 55 },
      { country: "FRANCE", value: 23 },
    ],
    box: { x: 0.24, y: 0.56, w: 0.16, h: 0.18 },
  },
  {
    id: 2,
    tier: "CITY",
    category: "Visual Intelligence · Architecture & Material",
    title: "Granite Rubble-Stone Perimeter Wall",
    insights: [
      {
        icon: Mountain,
        label: "Material",
        fact: "Grey granite rubble, hand-jointed, no dressed courses anywhere.",
      },
      {
        icon: Layers,
        label: "Capping",
        fact: "Weathered terracotta coping tiles running along the head.",
      },
      {
        icon: Microscope,
        label: "Patina",
        fact: "Atlantic moss and lichen bloom — a wet, salt-air coast.",
      },
      {
        icon: MapPin,
        label: "Distribution",
        fact: "Galicia and Asturias over the Minho; not central or southern France.",
      },
    ],
    probabilities: [
      { country: "SPAIN", value: 86, top: true },
      { country: "PORTUGAL", value: 38 },
      { country: "FRANCE", value: 9 },
    ],
    box: { x: 0.62, y: 0.5, w: 0.18, h: 0.2 },
  },
  {
    id: 3,
    tier: "STREET",
    category: "Visual Intelligence · Road Signage & Marking",
    title: "White-on-Red N-634 Route Plate",
    insights: [
      {
        icon: Tag,
        label: "Plate",
        fact: "White lettering on a red field — a Spanish national-route plate.",
      },
      {
        icon: Route,
        label: "Route",
        fact: "N-634, the Cantabrian-coast national road, Lugo into Asturias.",
      },
      {
        icon: TrafficCone,
        label: "Roadside",
        fact: "Chevron-edged asphalt with a moss-darkened kerb beneath it.",
      },
      {
        icon: Crosshair,
        label: "Bounds",
        fact: "Narrows the answer from a province to one stretch between villages.",
      },
    ],
    probabilities: [
      { country: "SPAIN", value: 94, top: true },
      { country: "PORTUGAL", value: 16 },
      { country: "FRANCE", value: 3 },
    ],
    box: { x: 0.72, y: 0.43, w: 0.22, h: 0.26 },
  },
];

/** The last clue's index — where returning from the results screen lands. */
export const LAST_CLUE_INDEX = CLUE_SLIDES.length - 1;

/** Computes crop box fractions on the 21:9 pane from a view_id */
function computeBoxFromViewId(viewId: string): CropBox {
  let deg = 0;
  let tileIndex: number | null = null;

  if (viewId.startsWith("yaw")) {
    const rest = viewId.slice(3);
    if (rest.includes("_tile")) {
      const parts = rest.split("_tile");
      deg = parseFloat(parts[0]) || 0;
      tileIndex = parseInt(parts[1], 10);
    } else {
      deg = parseFloat(rest) || 0;
    }
  }

  let x = (0.5 + deg / 360 - 0.125) % 1;
  if (x < 0) x += 1;
  let w = 0.25;

  if (tileIndex !== null) {
    w = 0.125;
    if (tileIndex === 1 || tileIndex === 3) {
      x = (x + 0.125) % 1;
    }
  } else if (viewId === "down" || viewId === "up") {
    x = 0.375;
    w = 0.25;
  }

  const h = w / 0.85;
  let centerY = 0.5;
  if (tileIndex === 0 || tileIndex === 1) centerY = 0.36;
  else if (tileIndex === 2 || tileIndex === 3) centerY = 0.64;
  else if (viewId === "down") centerY = 0.85;
  else if (viewId === "up") centerY = 0.15;

  let y = centerY - h / 2;
  y = Math.max(0, Math.min(1 - h, y));

  // Wrap-around
  if (x + w > 1) {
    x = Math.max(0, 1 - w);
  }

  return { x: Math.max(0, Math.min(1, x)), y, w, h };
}

export function buildClueSlides(result: GeolocationResult): ClueSlide[] {
  const countryProbs: Probability[] = [
    { country: "SPAIN", value: Math.round((result.countries["ES"] || 0) * 100) },
    { country: "PORTUGAL", value: Math.round((result.countries["PT"] || 0) * 100) },
    { country: "FRANCE", value: Math.round((result.countries["FR"] || 0) * 100) },
  ];
  const maxVal = Math.max(...countryProbs.map((p) => p.value));
  countryProbs.forEach((p) => {
    if (p.value === maxVal && maxVal > 0) p.top = true;
  });
  if (!countryProbs.some((p) => p.top)) countryProbs[0].top = true;

  if (result.clues && result.clues.length > 0) {
    return result.clues.slice(0, 5).map((clue, idx) => {
      const tier: Tier = idx === 0 ? "COUNTRY" : idx === 1 ? "CITY" : "STREET";
      const box = computeBoxFromViewId(clue.view_id || "yaw0");

      const insights: Insight[] = [
        {
          icon: Eye,
          label: "Observation",
          fact: clue.observation ? clue.observation.slice(0, 75) : "Identified visual marker in panorama.",
        },
        {
          icon: Signpost,
          label: clue.raw_text ? "Detected text" : "Confidence",
          fact: clue.raw_text
            ? `Text read: "${clue.raw_text}"`
            : `Confidence metric rated at ${Math.round((clue.confidence || 0.6) * 100)}%.`,
        },
        {
          icon: Compass,
          label: "Points to",
          fact: clue.implies && clue.implies.length > 0
            ? `Correlates with regions: ${clue.implies.join(", ")}.`
            : "Strong correlation with Atlantic prior.",
        },
        {
          icon: Crosshair,
          label: "Hierarchy",
          fact: `Assigned to ${tier.toLowerCase()} tier precision level.`,
        },
      ];

      return {
        id: idx + 1,
        tier,
        category: `${clue.source || "specialist"} · ${clue.category || "visual"}`,
        title: clue.raw_text || clue.observation?.slice(0, 36) || `Evidence Clue #${idx + 1}`,
        insights,
        probabilities: countryProbs,
        box,
      };
    });
  }

  if (result.candidates && result.candidates.length > 0) {
    return result.candidates.slice(0, 3).map((cand, idx) => {
      const tier: Tier = idx === 0 ? "STREET" : idx === 1 ? "CITY" : "COUNTRY";
      const defaultBoxes = [
        { x: 0.24, y: 0.56, w: 0.16, h: 0.18 },
        { x: 0.62, y: 0.5, w: 0.18, h: 0.2 },
        { x: 0.72, y: 0.43, w: 0.22, h: 0.26 },
      ];

      const insights: Insight[] = [
        {
          icon: MapPin,
          label: "Candidate",
          fact: cand.name || "Geographic hypothesis mode.",
        },
        {
          icon: Crosshair,
          label: "Likelihood",
          fact: `Candidate mode carries ${Math.round(cand.probability * 100)}% posterior probability.`,
        },
        {
          icon: Sparkles,
          label: "Evidence",
          fact: cand.evidence && cand.evidence.length > 0 ? cand.evidence[0] : "Synthesized from visual and spatial prior.",
        },
        {
          icon: Compass,
          label: "Verification",
          fact: cand.verified_by && cand.verified_by.length > 0 ? cand.verified_by[0] : `Search radius ±${cand.radius_km} km.`,
        },
      ];

      return {
        id: idx + 1,
        tier,
        category: "Hypothesis · Geolocation Candidate",
        title: cand.name,
        insights,
        probabilities: countryProbs,
        box: defaultBoxes[idx % defaultBoxes.length],
      };
    });
  }

  return CLUE_SLIDES;
}

/** The clue colour lives on elements that never remount, so it eases rather than snaps. */
const HUE_FADE = "transition-[color,background-color,border-color,box-shadow] duration-500";

/** Quiet viewfinder brackets: four L-shaped corners inset from the frame. */
function CornerMarks({ tone = "text-white/25" }: { tone?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-2", HUE_FADE, tone)}>
      <span className="absolute top-0 left-0 size-3 border-t border-l border-current" />
      <span className="absolute top-0 right-0 size-3 border-t border-r border-current" />
      <span className="absolute right-0 bottom-0 size-3 border-r border-b border-current" />
      <span className="absolute bottom-0 left-0 size-3 border-b border-l border-current" />
    </div>
  );
}

function PrecisionMeter({ tier }: { tier: Tier }) {
  const { radiusKm, convergence, accent } = TIERS[tier];
  const activeIndex = TIER_ORDER.indexOf(tier);

  return (
    <div className="space-y-3 [@media(max-height:960px)]:space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] font-semibold tracking-[0.2em] text-white/50 uppercase">
          Precision
        </span>
        <span
          data-meter-radius
          className={cn("font-mono text-[11px] font-semibold tracking-wider", HUE_FADE, accent.text)}
        >
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
          data-meter-fill
          initial={false}
          animate={{ width: `${convergence}%` }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className={cn("h-full rounded-full", HUE_FADE, accent.fill)}
        />
      </div>

      <div className="flex items-center gap-2.5 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase">
        {TIER_ORDER.map((tierName, i) => (
          <Fragment key={tierName}>
            {i > 0 && <span className="text-white/20">·</span>}
            <span
              data-tier-chip
              data-active={i === activeIndex}
              className={cn(
                "rounded px-1.5 py-0.5 transition-colors ring-1 ring-transparent",
                i === activeIndex && cn(accent.text, accent.badge),
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

export function InspectionView({
  panorama,
  result,
  onBack,
  onViewResults,
  initialSlideIndex = 0,
}: InspectionViewProps) {
  const slides = useMemo(() => (result ? buildClueSlides(result) : CLUE_SLIDES), [result]);
  const lastIndex = Math.max(0, slides.length - 1);

  const [slideIndex, setSlideIndex] = useState(() =>
    Math.min(Math.max(initialSlideIndex, 0), lastIndex),
  );

  // Sync if slides change
  useEffect(() => {
    setSlideIndex((idx) => Math.min(idx, lastIndex));
  }, [lastIndex]);

  const currentClue = slides[slideIndex] || slides[0];
  const { accent } = TIERS[currentClue.tier];

  const isFirst = slideIndex === 0;
  const isLast = slideIndex === slides.length - 1;

  const reduceMotion = useReducedMotion();

  // ---------------------------------------------------------------- camera ---
  const firstBox = slides[0]?.box || { x: 0.24, y: 0.56, w: 0.16, h: 0.18 };
  const camX = useMotionValue(firstBox.x);
  const camY = useMotionValue(firstBox.y);
  const camW = useMotionValue(firstBox.w);
  const camH = useMotionValue(firstBox.h);

  useEffect(() => {
    const next = currentClue.box;

    if (reduceMotion) {
      camX.set(next.x);
      camY.set(next.y);
      camW.set(next.w);
      camH.set(next.h);
      return;
    }

    const move = { duration: MORPH_SECONDS, ease: EASE_FORGE };
    const controls = [
      animate(camX, next.x, move),
      animate(camY, next.y, move),
      animate(camW, next.w, move),
      animate(camH, next.h, move),
    ];

    return () => controls.forEach((control) => control.stop());
  }, [slideIndex, reduceMotion, camX, camY, camW, camH, currentClue]);

  // The crop box on the panorama, as percentages of the pane.
  const cropLeft = useTransform(camX, (v) => `${v * 100}%`);
  const cropTop = useTransform(camY, (v) => `${v * 100}%`);
  const cropWidth = useTransform(camW, (v) => `${v * 100}%`);
  const cropHeight = useTransform(camH, (v) => `${v * 100}%`);

  // The zoom layer: -(x/w)%, -(y/h)%, (100/w)%, (100/h)% of the zoom pane.
  const layerLeft = useTransform<number, string>([camX, camW], ([xv, wv]) => `${-(xv / wv) * 100}%`);
  const layerTop = useTransform<number, string>([camY, camH], ([yv, hv]) => `${-(yv / hv) * 100}%`);
  const layerWidth = useTransform(camW, (v) => `${100 / v}%`);
  const layerHeight = useTransform(camH, (v) => `${100 / v}%`);

  // The zoom pane's own aspect, always derived from the CURRENT crop box.
  const paneAspect = useTransform<number, number>([camW, camH], ([wv, hv]) => (wv / hv) * PANE_ASPECT);

  // ------------------------------------------------------------------ nav ---
  const goPrev = () => setSlideIndex((index) => Math.max(0, index - 1));
  const goNext = () => setSlideIndex((index) => Math.min(slides.length - 1, index + 1));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" && !isLast) setSlideIndex((index) => index + 1);
      if (event.key === "ArrowLeft" && !isFirst) setSlideIndex((index) => index - 1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFirst, isLast]);

  // Ranked, never hand-ordered.
  const ranked = [...currentClue.probabilities].sort((a, b) => b.value - a.value);

  return (
    <div data-accent={currentClue.tier} className="relative z-10 flex min-h-screen w-full flex-col px-8 py-5">
      {/* Top Header Bar */}
      <header className="mx-auto flex w-full max-w-[1600px] items-center justify-between pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-white/70 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Upload another panorama
        </Button>

        <p className="flex items-center gap-2 text-sm font-semibold tracking-[0.28em] text-white/70 uppercase">
          <span>&ldquo;The Winning Team&rdquo;</span>
        </p>

        {/* Stepper: the ends do not wrap, so a mis-hit cannot jump 3/3 → 1/3 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goPrev}
            disabled={isFirst}
            className="size-8 p-0 text-white/60 hover:text-white disabled:opacity-35"
            aria-label="Previous clue"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <span className="font-mono text-xs font-medium tracking-wider text-white/50">
            {slideIndex + 1} / {CLUE_SLIDES.length}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={goNext}
            disabled={isLast}
            className="size-8 p-0 text-white/60 hover:text-white disabled:opacity-35"
            aria-label="Next clue"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      {/* Main Two-Column Layout: the optics on the left, the intelligence on the right */}
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 items-stretch pb-6">
        <div className="grid w-full flex-1 grid-cols-1 items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
          {/* ======================================================== */}
          {/* LEFT — the optics: the panorama, then exactly the boxed crop */}
          {/* ======================================================== */}
          <div className="flex min-h-0 flex-col justify-center gap-5">
            {/* Panorama pane — the crop box IS the crop region, no labels */}
            <div
              data-pane="panorama"
              className="relative aspect-21/9 w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10"
            >
              <img
                src={panorama.previewUrl}
                alt={panorama.name}
                className="size-full object-cover"
              />

              {/* Driven by the same values as the zoom pane, and never remounted:
                  percentages resolve against this borderless pane, so the box is
                  the same region the zoom pane magnifies — at every frame. */}
              <motion.div
                data-crop-box
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.28, ease: EASE_OUT }}
                className={cn(
                  "pointer-events-none absolute rounded-[3px] ring-2",
                  HUE_FADE,
                  accent.ring,
                  accent.glow,
                )}
                style={{ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight }}
              />

              <CornerMarks tone={accent.corner} />
            </div>

            {/* Zoom pane — exactly the boxed region, magnified */}
            <motion.div
              data-pane="zoom"
              className={cn(
                "relative w-full overflow-hidden rounded-xl bg-black ring-1",
                HUE_FADE,
                accent.ringSoft,
                accent.paneGlow,
              )}
              style={{ aspectRatio: paneAspect }}
            >
              {/* Scaled replica of the panorama layer: (100/w)% × (100/h)% offset by
                  -(x/w)% / -(y/h)%, so the visible window is exactly the crop box.
                  Only left/top/width/height ever change in here — a transform would
                  change the reference box and break the mapping. */}
              <motion.div
                className="absolute"
                style={{
                  left: layerLeft,
                  top: layerTop,
                  width: layerWidth,
                  height: layerHeight,
                }}
              >
                <img
                  src={panorama.previewUrl}
                  alt={`Zoom on ${currentClue.title}`}
                  className="size-full object-cover"
                />
              </motion.div>

              <CornerMarks tone={accent.text} />
            </motion.div>
          </div>

          {/* ======================================================== */}
          {/* RIGHT — the intelligence: precision, then the clue itself */}
          {/* ======================================================== */}
          {/* The panel's copy volume is what sets the row height, so its spacing
              tightens on short viewports (≤ 960px tall) rather than its type. */}
          <aside className="flex h-full w-full flex-col gap-6 rounded-2xl bg-surface p-10 shadow-2xl ring-1 ring-white/10 [@media(max-height:960px)]:gap-5 [@media(max-height:960px)]:p-8">
            <div className="border-b border-white/10 pb-6 [@media(max-height:960px)]:pb-5">
              <PrecisionMeter tier={currentClue.tier} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentClue.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.45, ease: EASE_OUT, delay: COPY_DELAY },
                }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.22, ease: EASE_OUT } }}
                className="flex min-h-0 flex-1 flex-col gap-6 [@media(max-height:960px)]:gap-5"
              >
                {/* CLUE TITLE */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      data-clue-badge
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase ring-1",
                        accent.text,
                        accent.badge,
                      )}
                    >
                      <Eye className="size-3" />
                      {currentClue.category}
                    </span>
                    <span className="font-mono text-xs text-white/40">
                      CLUE {currentClue.id} OF {CLUE_SLIDES.length}
                    </span>
                  </div>

                  <h2 className="font-display text-3xl font-bold tracking-tight text-white xl:text-4xl">
                    {currentClue.title}
                  </h2>
                </div>

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
                          <p
                            className={cn(
                              "font-mono text-[10px] font-semibold tracking-[0.18em] uppercase",
                              accent.text,
                            )}
                          >
                            {insight.label}
                          </p>
                          <p className="text-[13px] leading-snug text-white/70">{insight.fact}</p>
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>

                {/* PROBABILITY: ranked, strictly descending */}
                <div className="space-y-4 border-t border-white/10 pt-6 [@media(max-height:960px)]:space-y-3 [@media(max-height:960px)]:pt-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-xs font-semibold tracking-[0.2em] text-white/50 uppercase">
                      PROBABILITY:
                    </h3>
                    <span className="flex items-center gap-1 font-mono text-xs text-white/45">
                      <Sparkles className="size-3" />
                      ESTIMATED LOCATION CONFIDENCE
                    </span>
                  </div>

                  <div className="space-y-3.5 font-mono text-sm [@media(max-height:960px)]:space-y-2.5">
                    {ranked.map((probability, index) => {
                      const leader = index === 0;

                      return (
                        <div
                          key={probability.country}
                          data-leader={leader ? true : undefined}
                          className="space-y-1"
                        >
                          <div
                            className={cn(
                              "flex items-center justify-between",
                              leader ? "font-bold" : "font-semibold text-white/80",
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-[10px] tracking-wider",
                                  leader ? accent.text : "text-white/30",
                                )}
                              >
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <span
                                data-country
                                className={leader ? accent.text : undefined}
                              >
                                {probability.country}
                              </span>
                              {leader && (
                                <span className={cn("rounded px-1 text-[10px]", accent.chip)}>
                                  TOP MATCH
                                </span>
                              )}
                            </span>
                            <span className={leader ? accent.text : undefined}>
                              {probability.value}%
                            </span>
                          </div>

                          <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.08]">
                            <motion.div
                              data-bar
                              initial={{ width: 0 }}
                              animate={{ width: `${probability.value}%` }}
                              transition={{ duration: 0.6, ease: "easeOut", delay: 0.12 }}
                              className={cn(
                                "h-full rounded-full",
                                leader ? accent.bar : "bg-white/40",
                              )}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Navigation: forward until the last clue, which reveals the results */}
                <div className="mt-auto flex items-center justify-between gap-4 pt-4 [@media(max-height:960px)]:pt-3">
                  <div className="flex items-center gap-1.5">
                    {slides.map((clue, index) => (
                      <button
                        key={clue.id}
                        type="button"
                        data-dot
                        data-active={slideIndex === index}
                        onClick={() => setSlideIndex(index)}
                        className={cn(
                          "size-2 cursor-pointer rounded-full transition-all",
                          slideIndex === index
                            ? cn("w-6", HUE_FADE, accent.fill)
                            : "bg-white/20 hover:bg-white/40",
                        )}
                        aria-label={`Go to clue ${index + 1}`}
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
              </motion.div>
            </AnimatePresence>
          </aside>
        </div>
      </main>
    </div>
  );
}
