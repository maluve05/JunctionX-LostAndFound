import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { PanoramaInput } from "@/components/UploadZone";
import { EASE_OUT, fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface InspectionViewProps {
  panorama: PanoramaInput;
  onBack: () => void;
}

/** The panorama pane's aspect ratio (`aspect-21/9`) — the zoom math derives from it. */
const PANE_ASPECT = 21 / 9;

/**
 * A clue's crop box: fractions of the panorama pane (0–1, top-left anchored).
 * The lime highlight draws exactly this rectangle on the panorama, and the
 * zoom pane shows exactly the image pixels underneath it.
 */
interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ClueSlide {
  id: number;
  title: string;
  category: string;
  characteristic: string;
  explanation: string;
  probabilities: {
    portugal: number;
    france: number;
    spain: number;
  };
  box: CropBox;
}

const CLUE_SLIDES: ClueSlide[] = [
  {
    id: 1,
    category: "Google Lens · Road Infrastructure",
    title: "Spanish Roadside Reflector Bollard",
    characteristic:
      "White cylindrical marker post with horizontal amber reflector band & Galician eucalyptus tree line.",
    explanation:
      "Standard marker specification for Spanish national road network (N-roads) in Galicia; distinct from Portuguese plastic delineators and French red-capped posts.",
    probabilities: {
      spain: 73,
      portugal: 55,
      france: 12,
    },
    box: { x: 0.24, y: 0.56, w: 0.16, h: 0.18 },
  },
  {
    id: 2,
    category: "Google Lens · Architecture & Material",
    title: "Granite Rubble-Stone Perimeter Wall",
    characteristic:
      "Traditional grey granite rubble-stone perimeter wall with Atlantic moss patina and terracotta capping.",
    explanation:
      "Typology heavily concentrated in Northwestern Spain (Galicia/Asturias) and Northern Portugal (Minho), incompatible with Southern/Central French masonry.",
    probabilities: {
      spain: 68,
      portugal: 52,
      france: 15,
    },
    box: { x: 0.62, y: 0.5, w: 0.18, h: 0.2 },
  },
  {
    id: 3,
    category: "Google Lens · Biome & Flora",
    title: "Atlantic Eucalyptus & Maritime Pine Canopy",
    characteristic:
      "Dense commercial eucalyptus and maritime pine woodland under temperate overcast marine sky.",
    explanation:
      "Atlantic temperate biome predominant across Northern Spain's coastal highway corridors (Costa da Morte / Rías Baixas).",
    probabilities: {
      spain: 78,
      portugal: 46,
      france: 8,
    },
    box: { x: 0.42, y: 0.16, w: 0.2, h: 0.18 },
  },
];

/** Quiet viewfinder brackets: four L-shaped corners inset from the frame. */
function CornerMarks({ className = "border-white/25" }: { className?: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-2">
      <span className={cn("absolute top-0 left-0 size-3 border-t border-l", className)} />
      <span className={cn("absolute top-0 right-0 size-3 border-t border-r", className)} />
      <span className={cn("absolute right-0 bottom-0 size-3 border-r border-b", className)} />
      <span className={cn("absolute bottom-0 left-0 size-3 border-b border-l", className)} />
    </div>
  );
}

export function InspectionView({ panorama, onBack }: InspectionViewProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const currentClue = CLUE_SLIDES[slideIndex];
  const { box } = currentClue;

  const nextSlide = () => {
    setSlideIndex((prev) => (prev + 1) % CLUE_SLIDES.length);
  };

  const prevSlide = () => {
    setSlideIndex((prev) => (prev - 1 + CLUE_SLIDES.length) % CLUE_SLIDES.length);
  };

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col px-8 py-6">
      {/* Top Header Bar */}
      <header className="mx-auto flex w-full max-w-[1600px] items-center justify-between pb-6">
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

        {/* Slide Counter / Stepper */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevSlide}
            className="size-8 p-0 text-white/60 hover:text-white"
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
            onClick={nextSlide}
            className="size-8 p-0 text-white/60 hover:text-white"
            aria-label="Next clue"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      {/* Main Two-Column Layout: the optics on the left, the intelligence on the right */}
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 items-stretch pb-8">
        <div className="grid w-full flex-1 grid-cols-1 items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
          {/* ======================================================== */}
          {/* LEFT — the optics: the panorama, then exactly the boxed crop */}
          {/* ======================================================== */}
          <div className="flex min-h-0 flex-col justify-center gap-6">
            {/* Panorama pane — the lime box IS the crop region, no labels */}
            <div className="relative aspect-21/9 w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10">
              <img
                src={panorama.previewUrl}
                alt={panorama.name}
                className="size-full object-cover"
              />

              {/* Exact crop box: top-left anchored, sized as a fraction of the pane.
                  Percentages resolve against this borderless pane, so the box is
                  the same region the zoom pane magnifies. */}
              <motion.div
                key={`box-${currentClue.id}`}
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.28, ease: EASE_OUT }}
                className="pointer-events-none absolute rounded-[3px] ring-2 ring-lime shadow-[0_0_18px_rgba(214,255,66,0.45)]"
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.w * 100}%`,
                  height: `${box.h * 100}%`,
                }}
              />

              <CornerMarks />
            </div>

            {/* Zoom pane — exactly the boxed region, magnified */}
            <div
              className="relative w-full overflow-hidden rounded-xl bg-black shadow-[0_0_30px_rgba(214,255,66,0.12)] ring-1 ring-lime/30"
              style={{ aspectRatio: (box.w / box.h) * PANE_ASPECT }}
            >
              {/* Scaled replica of the panorama layer: (100/w)% × (100/h)%
                  offset by -(x/w)% / -(y/h)%, so the visible window is exactly
                  the crop box. Opacity-only animation — a transform here would
                  change the reference box and break the mapping. */}
              <motion.div
                key={`zoom-${currentClue.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="absolute"
                style={{
                  left: `${-(box.x / box.w) * 100}%`,
                  top: `${-(box.y / box.h) * 100}%`,
                  width: `${(100 / box.w)}%`,
                  height: `${(100 / box.h)}%`,
                }}
              >
                <img
                  src={panorama.previewUrl}
                  alt={`Zoom on ${currentClue.title}`}
                  className="size-full object-cover"
                />
              </motion.div>

              <CornerMarks className="border-lime/40" />
            </div>
          </div>

          {/* ======================================================== */}
          {/* RIGHT — the intelligence: title, characteristic, explanation, probability */}
          {/* ======================================================== */}
          <aside className="flex h-full w-full flex-col rounded-2xl bg-surface p-10 shadow-2xl ring-1 ring-white/10 xl:p-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentClue.id}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex h-full flex-col gap-8"
              >
                {/* DETAIL TITLE - (GOOGLE LENS TYPE) */}
                <div className="space-y-2 border-b border-white/10 pb-6">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/30 bg-lime/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-lime uppercase">
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

                {/* CHARACTERISTIC: */}
                <div className="space-y-2">
                  <h3 className="font-mono text-xs font-semibold tracking-[0.2em] text-white/50 uppercase">
                    CHARACTERISTIC:
                  </h3>
                  <p className="text-[17px] leading-relaxed text-white/90 xl:text-[19px]">
                    {currentClue.characteristic}
                  </p>
                </div>

                {/* EXPLANATION: */}
                <div className="space-y-2">
                  <h3 className="font-mono text-xs font-semibold tracking-[0.2em] text-white/50 uppercase">
                    EXPLANATION:
                  </h3>
                  <p className="text-[15px] leading-relaxed text-white/70 xl:text-base">
                    {currentClue.explanation}
                  </p>
                </div>

                {/* PROBABILITY: */}
                <div className="space-y-4 border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-xs font-semibold tracking-[0.2em] text-white/50 uppercase">
                      PROBABILITY:
                    </h3>
                    <span className="flex items-center gap-1 font-mono text-xs text-lime">
                      <Sparkles className="size-3" />
                      ESTIMATED LOCATION CONFIDENCE
                    </span>
                  </div>

                  {/* Probability Bars: Portugal, France, Spain */}
                  <div className="space-y-3.5 font-mono text-sm">
                    {/* PORTUGAL */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between font-semibold text-white/80">
                        <span>PORTUGAL</span>
                        <span>{currentClue.probabilities.portugal}%</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.08]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${currentClue.probabilities.portugal}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="h-full rounded-full bg-white/40"
                        />
                      </div>
                    </div>

                    {/* FRANCE */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between font-semibold text-white/80">
                        <span>FRANCE</span>
                        <span>{currentClue.probabilities.france}%</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.08]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${currentClue.probabilities.france}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="h-full rounded-full bg-white/40"
                        />
                      </div>
                    </div>

                    {/* SPAIN */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between font-bold text-lime">
                        <span className="flex items-center gap-1.5">
                          <span>SPAIN</span>
                          <span className="rounded bg-lime/20 px-1 text-[10px] text-lime">TOP MATCH</span>
                        </span>
                        <span>{currentClue.probabilities.spain}%</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.08]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${currentClue.probabilities.spain}%` }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                          className="h-full rounded-full bg-lime shadow-[0_0_12px_rgba(214,255,66,0.6)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Navigation Buttons */}
                <div className="mt-auto flex items-center justify-between pt-4">
                  <div className="flex items-center gap-1.5">
                    {CLUE_SLIDES.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSlideIndex(i)}
                        className={`size-2 cursor-pointer rounded-full transition-all ${
                          slideIndex === i ? "w-6 bg-lime" : "bg-white/20 hover:bg-white/40"
                        }`}
                        aria-label={`Go to clue ${i + 1}`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={prevSlide}
                      className="border-white/10 text-white/80 hover:bg-white/10"
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      onClick={nextSlide}
                      className="bg-lime font-semibold text-black hover:bg-lime/90"
                    >
                      Next Clue
                    </Button>
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
