import { motion } from "framer-motion";

import { fadeUp } from "@/lib/motion";

/** The team mark, sitting at the top of the screen like a brand signature. */
export function Header() {
  return (
    <header className="relative z-10 flex justify-center pt-11">
      <motion.p variants={fadeUp} className="flex items-start gap-3">
        <span
          aria-hidden
          className="font-display -mt-2 text-[40px] leading-none text-white/30 select-none"
        >
          &ldquo;
        </span>
        <span className="text-2xl font-bold tracking-[0.3em] whitespace-nowrap text-white/85 uppercase">
          The Winning Team
        </span>
        <span
          aria-hidden
          className="font-display -mt-2 text-[40px] leading-none text-white/30 select-none"
        >
          &rdquo;
        </span>
      </motion.p>
    </header>
  );
}
