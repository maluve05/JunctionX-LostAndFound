import { motion } from "framer-motion";

import { Header } from "@/components/Header";
import { QrCard } from "@/components/QrCard";
import { StepsStrip } from "@/components/StepsStrip";
import { UploadZone, type PanoramaInput } from "@/components/UploadZone";
import { Badge } from "@/components/ui/badge";
import { fadeUp } from "@/lib/motion";

export type LandingPageProps = {
  /** Fires once a panorama is chosen. */
  onAnalyze: (input: PanoramaInput) => void;
};

/**
 * The landed-here screen. It holds no analysis state of its own: everything it
 * knows about a chosen panorama leaves through `onAnalyze`.
 */
export function LandingPage({ onAnalyze }: LandingPageProps) {
  return (
    <>
      <Header />

      <main className="relative z-10 flex flex-1 items-center overflow-x-auto px-12 py-8">
        {/* Desktop layout: below ~1120px the screen scrolls sideways rather than cramping.
            `mx-auto` rather than `justify-center` keeps the overflow reachable. */}
        <div className="relative mx-auto grid w-full max-w-[1200px] min-w-[1120px] grid-cols-[400px_minmax(0,1fr)] items-center gap-x-20">
          {/* The spine between the two columns. */}
          <div aria-hidden className="column-rule absolute inset-y-6 left-[440px] w-px" />

          <QrCard />

          <div className="flex flex-col items-start gap-6">
            <motion.div variants={fadeUp}>
              <Badge
                variant="accent"
                className="px-4 py-1.5 text-base font-semibold tracking-[0.16em] md:text-lg"
              >
                Lost &amp; Found
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-display bg-linear-to-b from-white to-white/65 bg-clip-text text-[64px] leading-[1.02] font-medium tracking-[-0.03em] text-transparent"
            >
              Where am I<span className="text-lime">?</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="max-w-[520px] text-[19px] text-white/60">
              Drop a panorama. We&apos;ll find the country.
            </motion.p>

            <motion.div variants={fadeUp} className="w-full pt-1">
              <UploadZone onAnalyze={onAnalyze} />
            </motion.div>
          </div>
        </div>
      </main>

      <StepsStrip />
    </>
  );
}
