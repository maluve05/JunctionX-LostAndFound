import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

import { CornerBrackets } from "@/components/CornerBrackets";
import { fadeUp } from "@/lib/motion";

/**
 * Where the QR points. Swap this for the deployed URL before the demo.
 */
const APP_URL = "https://example.com";

/** Rendered size of the QR, in pixels. Big enough to scan from a few metres. */
const QR_SIZE = 252;

export function QrCard() {
  return (
    <motion.div variants={fadeUp} className="relative justify-self-center">
      <div className="panel hairline relative flex h-[520px] w-[400px] flex-col items-center justify-center gap-9 overflow-hidden rounded-2xl">
        <CornerBrackets />

        <div className="rounded-lg bg-white p-[22px] shadow-[0_24px_70px_-32px_rgb(0_0_0/0.95)]">
          <QRCodeSVG
            value={APP_URL}
            size={QR_SIZE}
            level="Q"
            bgColor="#ffffff"
            fgColor="#000000"
            marginSize={0}
            title="QR code to open Lost & Found"
          />
        </div>

        <p className="text-[13px] text-mist/50">Scan to try it</p>
      </div>
    </motion.div>
  );
}
