import { motion } from "framer-motion";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { CornerBrackets } from "@/components/CornerBrackets";
import { Button } from "@/components/ui/button";
import type { PanoramaInput } from "@/components/UploadZone";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** The pipeline the real analyser will run. Presentational for now. */
const STAGES = [
  "Reading the panorama",
  "Looking for text, signs and plates",
  "Checking road markings and vegetation",
  "Weighing the evidence",
] as const;

const STAGE_INTERVAL_MS = 1500;

export type AnalyzingViewProps = {
  panorama: PanoramaInput;
  onBack: () => void;
};

/**
 * Where the projection lands after "Find my location". The stages walk to the
 * end and then hold: the region breakdown is the next screen, and it plugs in
 * at that holding state.
 */
export function AnalyzingView({ panorama, onBack }: AnalyzingViewProps) {
  const [stage, setStage] = useState(0);
  const settled = stage >= STAGES.length - 1;

  useEffect(() => {
    if (settled) return;
    const timer = window.setTimeout(() => setStage((current) => current + 1), STAGE_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [stage, settled]);

  // Esc is the get-out-of-jail key when this is on a projector.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  return (
    <main className="relative z-10 flex flex-1 flex-col justify-center overflow-x-auto px-12 py-12">
      {/* `mx-auto` rather than `items-center`: a centred overflow would be unreachable. */}
      <div className="mx-auto w-full max-w-[880px] min-w-[720px]">
        <motion.div variants={fadeUp} className="flex items-baseline justify-between gap-6">
          <p className="text-[11px] font-medium tracking-[0.32em] text-white/40 uppercase">Analyzing</p>
          <p className="truncate text-[13px] text-white/50">{panorama.name}</p>
        </motion.div>

        <motion.div variants={fadeUp} className="relative mt-5">
          <div className="panel hairline relative aspect-[2/1] w-full overflow-hidden rounded-2xl">
            <img src={panorama.previewUrl} alt="" className="size-full object-cover" />
            <div
              aria-hidden
              className="absolute inset-0 bg-linear-to-t from-ink/85 via-transparent to-ink/35"
            />

            {/* The scanning line: a transform, so reduced motion freezes it and
                the `motion-reduce:hidden` above removes it entirely. */}
            <motion.div
              aria-hidden
              className="absolute inset-0 motion-reduce:hidden"
              initial={{ y: "-100%" }}
              animate={{ y: "100%" }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-x-0 top-1/2 h-px bg-linear-to-r from-transparent via-lime/80 to-transparent" />
              <div className="absolute inset-x-0 top-1/2 h-20 -translate-y-1/2 bg-linear-to-b from-transparent via-lime/10 to-transparent" />
            </motion.div>

            <CornerBrackets />
          </div>
        </motion.div>

        <motion.ol variants={fadeUp} className="mt-9 space-y-3">
          {STAGES.map((label, index) => {
            const state = index < stage ? "done" : index === stage ? "active" : "idle";

            return (
              <li key={label} className="flex items-center gap-3.5">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border text-[10px]",
                    state === "done" && "border-lime/40 bg-lime/15 text-lime",
                    state === "active" && "border-white/20 bg-white/[0.06] text-white/80",
                    state === "idle" && "border-white/10 text-white/30",
                  )}
                >
                  {state === "done" ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : (
                    <span className="font-mono">{index + 1}</span>
                  )}
                </span>

                <span
                  className={cn("text-[14px]", state === "idle" ? "text-white/30" : "text-white/75")}
                >
                  {label}
                </span>

                {state === "active" && (
                  <Loader2 className="size-3.5 animate-spin text-white/45 motion-reduce:animate-none" />
                )}
              </li>
            );
          })}
        </motion.ol>

        <motion.div
          variants={fadeUp}
          className="mt-9 flex items-center justify-between gap-6 border-t border-white/[0.07] pt-6"
        >
          <p className="flex items-center gap-2.5 text-[13px] text-white/45">
            <span aria-hidden className="status-pulse size-1.5 rounded-full bg-lime" />
            {settled ? "Awaiting the model's verdict…" : "Running the pipeline…"}
          </p>

          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Return to upload
          </Button>
        </motion.div>
      </div>
    </main>
  );
}
