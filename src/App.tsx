import {
  AnimatePresence,
  MotionConfig,
  motion,
  animate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { AnalyzingView } from "@/components/AnalyzingView";
import { Background } from "@/components/Background";
import { InspectionView, LAST_CLUE_INDEX } from "@/components/InspectionView";
import { LandingPage } from "@/components/LandingPage";
import { ResultsView } from "@/components/ResultsView";
import type { PanoramaInput } from "@/components/UploadZone";
import { EASE_FORGE, EASE_IN_OUT, EASE_OUT, stagger } from "@/lib/motion";
import type { GeolocationResult } from "@/lib/types";

type Screen = "landing" | "analyzing" | "inspecting" | "results";
/** idle → closing → (the swap happens here, fully covered) → opening → idle */
type Shutter = "idle" | "closing" | "opening";

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [panorama, setPanorama] = useState<PanoramaInput | null>(null);
  const [result, setResult] = useState<GeolocationResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [shutter, setShutter] = useState<Shutter>("idle");

  /** 0 = aperture open, 1 = fully closed. One value drives all four blades. */
  const progress = useMotionValue(0);
  const reticleOpacity = useTransform(progress, [0, 0.55, 1], [0, 0.9, 1]);
  /** Which clue the inspection screen opens on — 0 for a fresh analysis. */
  const [resumeClue, setResumeClue] = useState(0);
  const intent = useRef<"analyze" | "inspect" | "results" | "reset">("analyze");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!panorama) return;
    const { previewUrl } = panorama;
    return () => URL.revokeObjectURL(previewUrl);
  }, [panorama]);

  useEffect(() => {
    if (shutter === "idle") return;

    const closing = shutter === "closing";
    const controls = animate(progress, closing ? 1 : 0, {
      duration: closing ? 0.4 : 0.55,
      delay: closing ? 0 : 0.25,
      ease: closing ? EASE_IN_OUT : EASE_FORGE,
      onComplete: () => {
        if (closing) {
          // The blades fully cover the viewport: the swap happens unseen.
          if (intent.current === "analyze") {
            setScreen("analyzing");
          } else if (intent.current === "inspect") {
            setScreen("inspecting");
          } else if (intent.current === "results") {
            setScreen("results");
          } else {
            setScreen("landing");
            setPanorama(null);
            setResult(null);
            setJobId(null);
          }
          setShutter("opening");
        } else {
          setShutter("idle");
        }
      },
    });

    return () => controls.stop();
  }, [shutter, progress]);

  const handleAnalyze = (input: PanoramaInput) => {
    if (shutter !== "idle") return;
    setPanorama(input);
    setResult(null);
    setResumeClue(0);

    if (reduceMotion) {
      setScreen("analyzing");
      return;
    }

    intent.current = "analyze";
    setShutter("closing");
  };

  const handleAnalysisDone = (analysisResult: GeolocationResult) => {
    setResult(analysisResult);
    setResumeClue(0);

    if (reduceMotion) {
      setScreen("inspecting");
      return;
    }

    intent.current = "inspect";
    setShutter("closing");
  };

  const handleBackToLanding = () => {
    if (shutter !== "idle") return;

    if (reduceMotion) {
      setScreen("landing");
      setPanorama(null);
      setResult(null);
      return;
    }

    intent.current = "reset";
    setShutter("closing");
  };

  const handleViewResults = () => {
    if (shutter !== "idle") return;
    setResumeClue(LAST_CLUE_INDEX);

    if (reduceMotion) {
      setScreen("results");
      return;
    }

    intent.current = "results";
    setShutter("closing");
  };

  const handleBackToClues = () => {
    if (shutter !== "idle") return;

    if (reduceMotion) {
      setScreen("inspecting");
      return;
    }

    intent.current = "inspect";
    setShutter("closing");
  };

  const handleAnswerQuestion = async (optionIndex: number | null) => {
    if (!jobId) return;
    try {
      await fetch(`/api/jobs/${jobId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option: optionIndex }),
      });
      // Clear question prompt once answered
      if (result) {
        setResult({ ...result, question: null });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-black">
        <Background />

        {/* Aperture shutter: four transform-only blades meeting at the centre */}
        {shutter !== "idle" && (
          <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
            <motion.div
              aria-hidden
              className="absolute inset-x-0 top-0 h-[51%] origin-top bg-ink"
              style={{ scaleY: progress }}
            />
            <motion.div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[51%] origin-bottom bg-ink"
              style={{ scaleY: progress }}
            />
            <motion.div
              aria-hidden
              className="absolute inset-y-0 left-0 w-[51%] origin-left bg-ink"
              style={{ scaleX: progress }}
            />
            <motion.div
              aria-hidden
              className="absolute inset-y-0 right-0 w-[51%] origin-right bg-ink"
              style={{ scaleX: progress }}
            />

            <motion.div
              className="absolute inset-0 grid place-items-center"
              style={{ opacity: reticleOpacity }}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="size-20 animate-pulse rounded-2xl border-2 border-lime shadow-[0_0_40px_rgba(214,255,66,0.6)]" />
                <p className="font-mono text-xs font-bold tracking-[0.3em] text-lime uppercase">
                  ACQUIRING OPTICAL TARGET...
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {/* Main Screen Switch */}
        <AnimatePresence mode="wait">
          {screen === "results" && panorama ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 1.015 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="relative flex min-h-screen flex-col overflow-x-hidden"
            >
              <ResultsView
                panorama={panorama}
                result={result}
                jobId={jobId}
                onBack={handleBackToClues}
                onAnswerQuestion={handleAnswerQuestion}
              />
            </motion.div>
          ) : screen === "inspecting" && panorama ? (
            <motion.div
              key="inspecting"
              initial={{ opacity: 0, scale: 1.015 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="relative flex min-h-screen flex-col overflow-x-hidden"
            >
              <InspectionView
                panorama={panorama}
                result={result}
                onBack={handleBackToLanding}
                onViewResults={handleViewResults}
                initialSlideIndex={resumeClue}
              />
            </motion.div>
          ) : screen === "analyzing" && panorama ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 1.015 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="relative flex min-h-screen flex-col overflow-x-hidden"
            >
              <AnalyzingView
                panorama={panorama}
                onBack={handleBackToLanding}
                onDone={handleAnalysisDone}
              />
            </motion.div>
          ) : (
            <motion.div
              key="landing"
              variants={stagger}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
              className="relative flex min-h-screen flex-col overflow-x-hidden"
            >
              <LandingPage onAnalyze={handleAnalyze} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
