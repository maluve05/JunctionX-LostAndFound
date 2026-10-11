import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

import { CornerBrackets } from "@/components/CornerBrackets";
import { fadeUp } from "@/lib/motion";

/**
 * Production URL for the deployed Cloudflare Worker web application.
 */
const PRODUCTION_URL = "https://junction.chitswa.com";

/** Rendered size of the QR, in pixels. Big enough to scan from a few metres. */
const QR_SIZE = 252;

export function QrCard() {
  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  const targetUrl =
    typeof window !== "undefined" && !isLocal && window.location.origin.startsWith("http")
      ? window.location.origin
      : PRODUCTION_URL;

  return (
    <motion.div variants={fadeUp} className="relative justify-self-center">
      <div className="panel hairline relative flex h-[520px] w-[400px] flex-col items-center justify-center gap-8 overflow-hidden rounded-2xl">
        <CornerBrackets />

        <div className="rounded-lg bg-white p-[22px] shadow-[0_24px_70px_-32px_rgb(0_0_0/0.95)]">
          <QRCodeSVG
            value={targetUrl}
            size={QR_SIZE}
            level="Q"
            bgColor="#ffffff"
            fgColor="#000000"
            marginSize={0}
            title="QR code to open Lost & Found at junction.chitswa.com"
          />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-[13px] font-mono tracking-wider text-lime">{PRODUCTION_URL.replace("https://", "")}</p>
          <p className="text-[11px] text-mist/50">Scan to test on mobile</p>
        </div>
      </div>
    </motion.div>
  );
}
