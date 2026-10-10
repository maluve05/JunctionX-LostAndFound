import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { fadeUp } from "@/lib/motion";

const STEPS = ["Upload", "Analyze", "Locate"];

/** The one line at the bottom that says how the whole thing works. */
export function StepsStrip() {
  return (
    <motion.footer variants={fadeUp} className="relative z-10 flex justify-center pb-10">
      <ol className="flex items-center gap-3.5 rounded-full border border-white/10 bg-white/[0.02] px-6 py-2.5">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-3.5">
            {index > 0 && <ArrowRight className="size-3.5 text-mist/20" strokeWidth={1.75} />}
            <span className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full border border-white/10 font-mono text-[10px] text-lime/70">
                {index + 1}
              </span>
              <span className="text-[11px] font-medium tracking-[0.18em] text-mist/40 uppercase">
                {step}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </motion.footer>
  );
}
