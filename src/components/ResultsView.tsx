import { motion, useReducedMotion } from "framer-motion";
import {
  divIcon,
  latLngBounds,
  map as createMap,
  marker as createMarker,
  popup as createPopup,
  rectangle,
  tileLayer,
  type Map as LeafletMap,
  type Marker as LeafletMarker,
} from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PanoramaInput } from "@/components/UploadZone";
import { EASE_FORGE, EASE_OUT } from "@/lib/motion";
import type { GeolocationResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ResultsViewProps {
  panorama: PanoramaInput;
  result?: GeolocationResult | null;
  jobId?: string | null;
  /** Reads as "go back to the clues": App.tsx closes the aperture back onto Screen 2. */
  onBack: () => void;
  onAnswerQuestion?: (optionIndex: number | null) => void;
}

interface CoordinateResult {
  rank: number;
  lat: number;
  lng: number;
  label: string;
  countryCode: "es" | "pt" | "fr";
  countryFlag: string;
  city: string;
  probability: number;
}

const DEFAULT_RESULTS: CoordinateResult[] = [
  {
    rank: 1,
    lat: 39.74718,
    lng: -8.80957,
    label: "Leiria, Portugal",
    countryCode: "pt",
    countryFlag: "🇵🇹",
    city: "Castelo de Leiria",
    probability: 85,
  },
  {
    rank: 2,
    lat: 39.7436,
    lng: -8.8071,
    label: "Leiria, Portugal",
    countryCode: "pt",
    countryFlag: "🇵🇹",
    city: "Leiria Center",
    probability: 60,
  },
  {
    rank: 3,
    lat: 39.2333,
    lng: -8.6833,
    label: "Santarém, Portugal",
    countryCode: "pt",
    countryFlag: "🇵🇹",
    city: "Santarém",
    probability: 25,
  },
];

interface RankStyle {
  token: string;
  fallback: string;
  text: string;
  bar: string;
  wash: string;
}

const RANK_STYLES: RankStyle[] = [
  {
    token: "--color-lime",
    fallback: "#d6ff42",
    text: "text-lime",
    bar: "bg-lime shadow-[0_0_12px_rgba(214,255,66,0.65)]",
    wash: "bg-lime/10 ring-lime/25",
  },
  {
    token: "--color-tier-city",
    fallback: "#38bdf8",
    text: "text-tier-city",
    bar: "bg-tier-city shadow-[0_0_12px_rgba(56,189,248,0.65)]",
    wash: "bg-tier-city/10 ring-tier-city/25",
  },
  {
    token: "--color-tier-street",
    fallback: "#f97316",
    text: "text-tier-street",
    bar: "bg-tier-street shadow-[0_0_12px_rgba(249,115,22,0.65)]",
    wash: "bg-tier-street/10 ring-tier-street/25",
  },
  {
    token: "--color-mist",
    fallback: "#e9eaee",
    text: "text-mist/70",
    bar: "bg-mist/60 shadow-[0_0_12px_rgba(233,234,238,0.35)]",
    wash: "bg-white/[0.06] ring-white/15",
  },
  {
    token: "--color-mist",
    fallback: "#e9eaee",
    text: "text-mist/50",
    bar: "bg-mist/40 shadow-[0_0_10px_rgba(233,234,238,0.25)]",
    wash: "bg-white/[0.05] ring-white/12",
  },
  {
    token: "--color-mist",
    fallback: "#e9eaee",
    text: "text-white/35",
    bar: "bg-white/25",
    wash: "bg-white/[0.04] ring-white/10",
  },
];

function mapCandidatesToResults(result: GeolocationResult): CoordinateResult[] {
  if (!result.candidates || result.candidates.length === 0) return DEFAULT_RESULTS;
  return result.candidates.slice(0, 6).map((c) => {
    const code = (c.region || "pt").slice(0, 2).toLowerCase();
    const countryCode: "es" | "pt" | "fr" = code === "es" ? "es" : code === "fr" ? "fr" : "pt";
    const countryFlag = countryCode === "pt" ? "🇵🇹" : countryCode === "fr" ? "🇫🇷" : "🇪🇸";
    const countryName = countryCode === "pt" ? "Portugal" : countryCode === "fr" ? "France" : "Spain";
    return {
      rank: c.rank,
      lat: c.lat,
      lng: c.lon,
      label: `${c.region_name || c.region}, ${countryName}`,
      countryCode,
      countryFlag,
      city: c.name || "Target Spot",
      probability: Math.round(c.probability * 100),
    };
  });
}

function readToken(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function withAlpha(color: string, alpha: number) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return color;
  const value = Number.parseInt(hex[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function pinIcon(color: string, delaySeconds: number) {
  const dot = document.createElement("span");
  dot.className = "map-pin";
  dot.style.setProperty("--pin", color);
  dot.style.animationDelay = `${delaySeconds}s`;

  return divIcon({ className: "map-pin-wrap", html: dot, iconSize: [18, 18], iconAnchor: [9, 9] });
}

function buildPopup(result: CoordinateResult, color: string) {
  const card = document.createElement("div");
  card.className = "map-popup";
  card.style.setProperty("--accent", color);

  const city = document.createElement("p");
  city.className = "map-popup-city";
  city.textContent = result.city;

  const coords = document.createElement("p");
  coords.className = "map-popup-coords";
  coords.textContent = `${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`;

  const label = document.createElement("p");
  label.className = "map-popup-label";
  label.textContent = `${result.countryFlag} ${result.label}`;

  card.append(city, coords, label);
  return card;
}

const PIN_AT = 1000;
const PIN_STEP = 120;

export function ResultsView({
  panorama,
  result,
  jobId,
  onBack,
  onAnswerQuestion,
}: ResultsViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const reduceMotion = useReducedMotion();

  const [panoPeek, setPanoPeek] = useState(false);
  const [copied, setCopied] = useState(false);
  const [morph, setMorph] = useState(() => !reduceMotion);

  const items = useMemo(
    () => (result ? mapCandidatesToResults(result) : DEFAULT_RESULTS),
    [result]
  );

  const top = items[0] || DEFAULT_RESULTS[0];
  const pullbackAt = PIN_AT + items.length * PIN_STEP + 220;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const colors = items.map((_, index) => {
      const style = RANK_STYLES[Math.min(index, RANK_STYLES.length - 1)];
      return readToken(style.token, style.fallback);
    });

    const map = createMap(container, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: false,
      zoomSnap: 0.5,
      maxZoom: 16,
    });
    mapRef.current = map;

    tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16 }
    ).addTo(map);

    tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16 }
    ).addTo(map);

    map.setView([top.lat, top.lng], reduceMotion ? 6 : 11);

    const bounds = latLngBounds(
      items.map((r): [number, number] => [r.lat, r.lng])
    );
    rectangle(bounds.pad(0.15), {
      color: withAlpha(colors[0], 0.55),
      weight: 1.5,
      dashArray: "6 4",
      fill: false,
      interactive: false,
      className: "map-aura",
    }).addTo(map);

    markersRef.current = items.map((resItem, index) => {
      const color = colors[index];
      const dot = createMarker([resItem.lat, resItem.lng], {
        icon: pinIcon(color, index * 0.4),
        riseOnHover: true,
      });

      dot.bindPopup(
        createPopup({
          className: "dark-popup",
          closeButton: false,
          autoPan: true,
          autoPanPadding: [18, 18],
          offset: [0, -10],
        }).setContent(buildPopup(resItem, color))
      );

      return dot;
    });

    const timers: number[] = [];

    markersRef.current.forEach((dot, index) => {
      if (reduceMotion) {
        dot.addTo(map);
        return;
      }
      timers.push(window.setTimeout(() => dot.addTo(map), PIN_AT + index * PIN_STEP));
    });

    timers.push(
      window.setTimeout(
        () => map.fitBounds(bounds, { padding: [48, 48], animate: !reduceMotion, duration: 1 }),
        reduceMotion ? 0 : pullbackAt
      )
    );

    const raf = window.requestAnimationFrame(() => map.invalidateSize());

    return () => {
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
      markersRef.current = [];
      mapRef.current = null;
      map.remove();
    };
  }, [items, reduceMotion, top.lat, top.lng, pullbackAt]);

  const focusResult = (resItem: CoordinateResult, index: number) => {
    const map = mapRef.current;
    if (!map) return;

    const marker = markersRef.current[index];
    const target: [number, number] = [resItem.lat, resItem.lng];
    const zoom = Math.max(map.getZoom(), 9);

    if (reduceMotion) {
      map.setView(target, zoom, { animate: false });
      marker?.openPopup();
      return;
    }

    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      map.off("moveend", open);
      window.clearTimeout(fallback);
      marker?.openPopup();
    };

    const fallback = window.setTimeout(open, 1300);
    map.on("moveend", open);
    map.flyTo(target, zoom, { duration: 1.1, easeLinearity: 0.35 });
  };

  const copyCoordinates = () => {
    const answerList = result?.answer || [
      { rank: 1, lat: top.lat, lon: top.lng },
      { rank: 2, lat: top.lat, lon: top.lng },
    ];
    const text = answerList.map((p) => `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSubmissionJson = () => {
    const payload = {
      image_id: result?.image_id || panorama.name,
      urban: result?.urban ?? panorama.urban,
      answer: result?.answer || items.map((i) => ({ rank: i.rank, lat: i.lat, lon: i.lng })),
      expected_score: result?.expected_score || 8500,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `submission_${payload.image_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSessionLog = async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/log`);
      if (!res.ok) throw new Error("Could not fetch log");
      const logData = await res.json();
      const blob = new Blob([JSON.stringify(logData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session_log_${jobId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-mist">
      {/* Phase 2 Interactive Quiz Prompt Banner */}
      {result?.question && (
        <motion.aside
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-30 border-b border-lime/30 bg-black/90 px-6 py-4 backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-lime/20 text-lime ring-1 ring-lime/40">
                <HelpCircle className="size-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs font-semibold tracking-wider text-lime uppercase">
                    Agent Verification Quiz
                  </p>
                  <span className="rounded bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] text-amber-400">
                    Penalty: ×0.95
                  </span>
                </div>
                <p className="text-sm font-medium text-white">{result.question.text}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {result.question.options.map((option, idx) => (
                <Button
                  key={option}
                  size="sm"
                  variant="outline"
                  onClick={() => onAnswerQuestion?.(idx)}
                  className="border-lime/30 font-mono text-xs text-lime hover:bg-lime/20 hover:text-white"
                >
                  {option}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAnswerQuestion?.(null)}
                className="font-mono text-xs text-white/50 hover:text-white"
              >
                Submit without answering
              </Button>
            </div>
          </div>
        </motion.aside>
      )}

      <main className="relative z-10 flex flex-1 flex-col px-10 py-6 max-lg:px-5">
        <div className="mx-auto grid w-full max-w-[1360px] flex-1 grid-cols-1 gap-7 lg:grid-cols-[440px_1fr]">
          {/* ======================================================== */}
          {/* LEFT COLUMN: Candidates, Summary, and Submission Export   */}
          {/* ======================================================== */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="flex flex-col gap-4"
          >
            {/* Header info bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="font-mono text-[11px] font-semibold tracking-widest text-white/40 uppercase">
                  Prediction Results
                </p>
                <p className="text-xs text-white/60">
                  {result?.urban ? "Urban (100m scale)" : "Rural (10km scale)"} · {result?.seconds ? `${result.seconds}s` : "warm-up model"}
                </p>
              </div>

              {result?.expected_score && (
                <div className="flex items-center gap-2 rounded-lg border border-lime/30 bg-lime/10 px-3 py-1">
                  <Sparkles className="size-3.5 text-lime" />
                  <span className="font-mono text-xs font-bold text-lime">
                    {result.expected_score.toLocaleString()} pts
                  </span>
                </div>
              )}
            </div>

            {/* Low confidence warning if flagged */}
            {result?.low_confidence && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                <span>Caution: High entropy / low spatial confidence across views.</span>
              </div>
            )}

            {/* Opus judge synthesis summary */}
            {result?.summary && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-white/80">
                <span className="mb-1 block font-mono text-[10px] tracking-wider text-lime uppercase">
                  Judge Assessment:
                </span>
                {result.summary}
              </div>
            )}

            {/* Ranked candidate list */}
            <ol className="space-y-2">
              {items.map((resItem, index) => {
                const style = RANK_STYLES[Math.min(index, RANK_STYLES.length - 1)];

                return (
                  <motion.li
                    key={resItem.rank}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.06 }}
                  >
                    <button
                      type="button"
                      onClick={() => focusResult(resItem, index)}
                      className="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-all hover:border-white/30 hover:bg-white/[0.06]"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "grid size-6 place-items-center rounded-md font-mono text-xs font-bold ring-1",
                            style.wash,
                            style.text
                          )}
                        >
                          {resItem.rank}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-white group-hover:text-lime">
                            {resItem.city}
                          </p>
                          <p className="text-[11px] text-white/50">{resItem.label}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={cn("font-mono text-xs font-bold", style.text)}>
                          {resItem.probability}%
                        </span>
                        <p className="font-mono text-[10px] text-white/30">
                          {resItem.lat.toFixed(3)}, {resItem.lng.toFixed(3)}
                        </p>
                      </div>
                    </button>
                  </motion.li>
                );
              })}
            </ol>

            {/* Competition 10-Point Submission Card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between pb-3">
                <span className="font-mono text-[11px] font-semibold tracking-wider text-lime uppercase">
                  Official Submission (10 coordinates)
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyCoordinates}
                  className="gap-1.5 border-lime/30 font-mono text-xs text-lime hover:bg-lime/20"
                >
                  {copied ? <Check className="size-3.5 text-lime" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied 10" : "Copy 10 Coords"}
                </Button>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadSubmissionJson}
                  className="flex-1 gap-1.5 border-white/10 text-xs text-white/80 hover:bg-white/10"
                >
                  <Download className="size-3.5" />
                  Submission JSON
                </Button>
                {jobId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadSessionLog}
                    className="flex-1 gap-1.5 border-white/10 text-xs text-white/80 hover:bg-white/10"
                  >
                    <Download className="size-3.5" />
                    Session Log
                  </Button>
                )}
              </div>
            </div>

            {/* Panorama fold/peek */}
            <button
              type="button"
              onClick={() => setPanoPeek((v) => !v)}
              style={{ height: panoPeek ? 112 : 36 }}
              className="relative mt-auto block w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/40 transition-all duration-300"
            >
              <img src={panorama.previewUrl} alt="" className="size-full object-cover opacity-60" />
              <span className="absolute inset-0 flex items-start justify-between p-2">
                <span className="font-mono text-[10px] tracking-wider text-white/70 uppercase">
                  Verify against Panorama
                </span>
                <ChevronDown
                  className={cn("size-4 text-white/70 transition-transform", panoPeek && "rotate-180")}
                />
              </span>
            </button>
          </motion.div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: Leaflet Map Canvas                         */}
          {/* ======================================================== */}
          <div className="flex min-h-0 flex-col gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: EASE_FORGE }}
              className="relative min-h-[460px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-surface-2 shadow-2xl"
            >
              <span aria-hidden className="map-halo pointer-events-none absolute -inset-10 z-0" />
              <div ref={containerRef} data-map className="absolute inset-0 z-0" />

              {/* Scan sweep effect */}
              <span aria-hidden className="map-scan pointer-events-none absolute inset-0 z-[1]" />

              {morph && (
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 1.2, ease: EASE_FORGE, delay: 0.2 }}
                  onAnimationComplete={() => setMorph(false)}
                  className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
                >
                  <img src={panorama.previewUrl} alt="" className="size-full object-cover" />
                  <span className="absolute inset-0 bg-black/50" />
                </motion.div>
              )}

              <p className="pointer-events-none absolute bottom-2 left-2 z-[3] font-mono text-[10px] text-white/30">
                © Esri, HERE, Garmin · © OpenStreetMap contributors
              </p>
            </motion.div>

            <div className="flex justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={onBack}
                className="group border-lime/30 bg-lime/[0.08] px-9 font-mono text-sm font-semibold text-lime shadow-lg hover:border-lime/60 hover:bg-lime/[0.18]"
              >
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
                Back to Inspection Clues
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
