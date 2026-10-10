import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Roll } from "./Roll";
import { stage } from "./stage";

/** One screen of a story: a photograph (or a field of colour), a few words, maybe a way onward. */
export type Slide = {
  src?: string;
  /** Where to frame the photograph (CSS object-position). */
  pos?: string;
  alt?: string;
  /** For slides without a photograph. */
  tone?: "iris" | "lilac" | "lime";
  kicker?: string;
  title: string;
  body?: string;
  cta?: { label: string; to?: "/builders" | "/partners"; href?: string };
};

/** Long enough to read: more words stay up longer. */
const secondsFor = (s: Slide) => Math.min(9, 4 + (s.title.length + (s.body?.length ?? 0)) * 0.032);

/**
 * Stories, full screen, the way Instagram shows them: bars across the top,
 * tap the right for the next and the left to go back, swipe sideways, hold
 * to pause, swipe down or press Escape to close. It closes itself after the
 * last one. The page doesn't scroll (or draw its 3D scene) underneath.
 */
export function Stories({
  slides,
  start = 0,
  name,
  avatar = "/brand/icon-192.png",
  onClose,
}: {
  slides: Slide[];
  start?: number;
  /** Who is posting, shown at the top: "FORGe 2025", "The crew"… */
  name: string;
  avatar?: string;
  onClose: () => void;
}) {
  const n = slides.length;
  const [index, setIndex] = useState(start);
  const [restart, setRestart] = useState(0);
  const [held, setHeld] = useState(false);
  const [motion] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const down = useRef<{ x: number; y: number; at: number; moved: boolean } | null>(null);

  const go = useCallback(
    (i: number) => {
      if (i >= n) onClose();
      else if (i < 0) setRestart((r) => r + 1);
      else setIndex(i);
    },
    [n, onClose],
  );

  // While open: the page holds still, focus is inside, and it comes back after.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    stage.lenis?.stop();
    stage.cover("stories", true);
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      html.style.overflow = overflow;
      stage.lenis?.start();
      stage.cover("stories", false);
      before?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, onClose]);

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest("a, button")) return;
    down.current = { x: e.clientX, y: e.clientY, at: performance.now(), moved: false };
    setHeld(true);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = down.current;
    if (!d || d.moved) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      d.moved = true;
      go(index + (dx < 0 ? 1 : -1));
    } else if (dy > 90 && dy > Math.abs(dx)) {
      d.moved = true;
      onClose();
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    setHeld(false);
    // A tap moves on; a long press was a pause.
    if (!d || d.moved || performance.now() - d.at > 320) return;
    const r = e.currentTarget.getBoundingClientRect();
    go(index + (e.clientX < r.left + r.width * 0.3 ? -1 : 1));
  };

  const slide = slides[index];
  const cta = slide.cta;
  return createPortal(
    <div
      className="pv"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Back"
        data-cursor="Back"
        className="round-btn pv-arrow"
      >
        <CaretLeftIcon size={20} weight="bold" aria-hidden="true" />
      </button>

      <div
        className="pv-frame"
        data-cursor="Next"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          down.current = null;
          setHeld(false);
        }}
      >
        {slides.map((s, i) =>
          s.src ? (
            <img
              key={`${i}-${s.src}`}
              src={s.src}
              alt={i === index ? (s.alt ?? "") : ""}
              aria-hidden={i !== index}
              draggable={false}
              loading={Math.abs(i - index) > 1 ? "lazy" : undefined}
              data-on={i === index ? "" : undefined}
              style={s.pos ? { objectPosition: s.pos } : undefined}
              className="pv-photo"
            />
          ) : (
            <span
              key={`${i}-field`}
              aria-hidden="true"
              data-on={i === index ? "" : undefined}
              data-tone={s.tone ?? "iris"}
              className="pv-photo pv-field"
            />
          ),
        )}
        <div className="pv-shade" aria-hidden="true" />

        <div className="pv-top">
          <div
            className="sv-bars"
            aria-hidden="true"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
          >
            {slides.map((s, i) => (
              <span
                key={`${i}-${s.title}`}
                className="sv-bar"
                data-state={i < index ? "done" : i === index ? "now" : undefined}
              >
                {i === index ? (
                  <i
                    key={`${index}-${restart}`}
                    style={
                      {
                        "--dur": `${secondsFor(slide)}s`,
                        animationPlayState: held ? "paused" : "running",
                      } as React.CSSProperties
                    }
                    onAnimationEnd={() => motion && go(index + 1)}
                  />
                ) : (
                  <i />
                )}
              </span>
            ))}
          </div>
          <div className="sv-head">
            <img
              src={avatar}
              alt=""
              width={34}
              height={34}
              className="sv-avatar"
              aria-hidden="true"
            />
            <span className="sv-who">{name}</span>
            <span className="sv-count tnum" aria-hidden="true">
              {index + 1}/{n}
            </span>
            <button
              ref={closeBtn}
              type="button"
              onClick={onClose}
              aria-label="Close"
              data-cursor="Close"
              className="pv-close"
            >
              <XIcon size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          key={index}
          className="pv-caption"
          data-plain={slide.src ? undefined : ""}
          aria-live="polite"
        >
          {slide.kicker && <p className="pv-small">{slide.kicker}</p>}
          <p className="pv-big">{slide.title}</p>
          {slide.body && <p className="pv-body">{slide.body}</p>}
          {cta &&
            (cta.to ? (
              <Link
                to={cta.to}
                onClick={onClose}
                data-cursor="Go"
                data-glyph={cta.to === "/builders" ? "build" : "partner"}
                className="btn btn-light pv-cta"
              >
                <Roll>{cta.label}</Roll>
                <ArrowRightIcon size={15} weight="bold" className="arrow" aria-hidden="true" />
              </Link>
            ) : (
              <a
                href={cta.href}
                target="_blank"
                rel="noreferrer noopener"
                data-cursor="Open"
                data-glyph={
                  cta.href?.includes("linkedin")
                    ? "linkedin"
                    : cta.href?.includes("unlnovae")
                      ? "novae"
                      : "recap"
                }
                className="btn btn-light pv-cta"
              >
                <Roll>{cta.label}</Roll>
                <ArrowUpRightIcon
                  size={15}
                  weight="bold"
                  className="arrow-diag"
                  aria-hidden="true"
                />
              </a>
            ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Next"
        data-cursor="Next"
        className="round-btn pv-arrow"
      >
        <CaretRightIcon size={20} weight="bold" aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
