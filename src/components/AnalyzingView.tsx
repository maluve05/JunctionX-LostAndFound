import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Check, HelpCircle, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CornerBrackets } from "@/components/CornerBrackets";
import { Button } from "@/components/ui/button";
import type { PanoramaInput } from "@/components/UploadZone";
import { fadeUp } from "@/lib/motion";
import type { GeolocationResult, JobStatusResponse, QuizQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

const STAGES = [
  "Reading the panorama",
  "Looking for text, signs and plates",
  "Checking road markings and vegetation",
  "Weighing the evidence",
  "Pinpointing the spot",
] as const;

export type AnalyzingViewProps = {
  panorama: PanoramaInput;
  onBack: () => void;
  onDone: (result: GeolocationResult, jobId: string) => void;
};

export function AnalyzingView({ panorama, onBack, onDone }: AnalyzingViewProps) {
  const [currentStage, setCurrentStage] = useState<string>("Reading the panorama");
  const [stagesDone, setStagesDone] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [answering, setAnswering] = useState(false);

  const pollIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Start job upload on mount
  useEffect(() => {
    let cancelled = false;

    const startJob = async () => {
      try {
        setError(null);
        setElapsed(0);

        const formData = new FormData();
        formData.append("file", panorama.file, panorama.name);
        formData.append("urban", String(panorama.urban));
        if (panorama.cue) {
          formData.append("cue", panorama.cue);
        }

        const res = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || errData.error || `Upload failed with status ${res.status}`);
        }

        const data = await res.json();
        if (cancelled) return;
        setJobId(data.job_id);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to start analysis job";
        setError(msg);
      }
    };

    startJob();

    // Local elapsed ticker for smooth live UI feedback
    timerIntervalRef.current = window.setInterval(() => {
      setElapsed((prev) => Math.round((prev + 0.5) * 10) / 10);
    }, 500);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
    };
  }, [panorama]);

  // Poll for job updates
  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error(`Polling failed with status ${res.status}`);

        const data: JobStatusResponse = await res.json();
        if (cancelled) return;

        if (data.stage) setCurrentStage(data.stage);
        if (data.stages_done) setStagesDone(data.stages_done);
        if (typeof data.elapsed_s === "number") setElapsed(data.elapsed_s);
        setQuestion(data.question ?? null);

        if (data.status === "done" && data.result) {
          if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
          if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
          onDone(data.result, jobId);
        } else if (data.status === "error") {
          if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
          if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
          setError(data.error || "Analysis failed on backend");
        }
      } catch (err: unknown) {
        console.warn("Polling error:", err);
      }
    };

    pollIntervalRef.current = window.setInterval(poll, 1500);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
    };
  }, [jobId, onDone]);

  // The session is paused until the user picks an option or skips (null = submit without answering)
  const answerQuestion = async (option: number | null) => {
    if (!jobId || answering) return;
    setAnswering(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option }),
      });
      if (!res.ok) throw new Error(`Answer failed with status ${res.status}`);
      setQuestion(null);
    } catch (err: unknown) {
      console.warn("Answer error:", err);
    } finally {
      setAnswering(false);
    }
  };

  // Esc key listener
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  const activeIndex = STAGES.findIndex((s) => s === currentStage);

  return (
    <main className="relative z-10 flex flex-1 flex-col justify-center overflow-x-auto px-12 py-12">
      <div className="mx-auto w-full max-w-[880px] min-w-[720px]">
        <motion.div variants={fadeUp} className="flex items-baseline justify-between gap-6">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-medium tracking-[0.32em] text-white/40 uppercase">Analyzing</p>
            <span className="rounded bg-lime/10 px-2 py-0.5 font-mono text-[10px] text-lime">
              {panorama.urban ? "URBAN 100M" : "RURAL 10KM"}
            </span>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="relative mt-5">
          <div className="panel hairline relative aspect-[2/1] w-full overflow-hidden rounded-2xl">
            <img src={panorama.previewUrl} alt="" className="size-full object-cover" />
            <div
              aria-hidden
              className="absolute inset-0 bg-linear-to-t from-ink/85 via-transparent to-ink/35"
            />

            {/* The scanning line */}
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

            {/* HUD Status Overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-md border border-white/10 bg-black/60 px-3 py-1 font-mono text-[11px] text-lime backdrop-blur-sm">
              <span className="status-pulse size-1.5 rounded-full bg-lime" />
              <span>ELAPSED: {elapsed.toFixed(1)}s</span>
            </div>

            <CornerBrackets />
          </div>
        </motion.div>

        {question && !error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-xl border border-lime/30 bg-black/60 p-5"
          >
            <div className="flex items-start gap-3.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lime/20 text-lime ring-1 ring-lime/40">
                <HelpCircle className="size-4" />
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs font-semibold tracking-wider text-lime uppercase">
                    Agent Verification Quiz
                  </p>
                  <span className="rounded bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] text-amber-400">
                    Penalty: ×{question.penalty_factor}
                  </span>
                </div>
                <p className="text-sm font-medium text-white">{question.text}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {question.options.map((option, idx) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={answering}
                  onClick={() => answerQuestion(idx)}
                  className="border-lime/30 font-mono text-xs text-lime hover:bg-lime/20 hover:text-white"
                >
                  {option}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={answering}
                onClick={() => answerQuestion(null)}
                className="font-mono text-xs text-white/50 hover:text-white"
              >
                Submit without answering
              </Button>
            </div>
          </motion.div>
        )}

        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-xl border border-red-500/30 bg-red-950/20 p-5"
          >
            <div className="flex items-start gap-3.5">
              <AlertCircle className="size-5 shrink-0 text-red-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-200">Analysis Error</p>
                <p className="text-xs text-red-300/80">{error}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onBack}
                className="gap-2 border-red-500/30 text-red-200 hover:bg-red-500/10"
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.ol variants={fadeUp} className="mt-9 space-y-3">
            {STAGES.map((label, index) => {
              const isDone = stagesDone.includes(label) || index < activeIndex;
              const isActive = index === activeIndex || currentStage === label;
              const state = isDone ? "done" : isActive ? "active" : "idle";

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
        )}

        <motion.div
          variants={fadeUp}
          className="mt-9 flex items-center justify-between gap-6 border-t border-white/[0.07] pt-6"
        >
          <p className="flex items-center gap-2.5 text-[13px] text-white/45 font-mono">
            <span aria-hidden className="status-pulse size-1.5 rounded-full bg-lime" />
            {error ? "Pipeline stalled" : `Running pipeline: ${currentStage}...`}
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
