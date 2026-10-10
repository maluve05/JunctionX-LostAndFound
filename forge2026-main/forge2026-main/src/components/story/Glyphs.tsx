import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  CalendarCheckIcon,
  CameraIcon,
  CheckCircleIcon,
  CrownIcon,
  EnvelopeSimpleIcon,
  FilmSlateIcon,
  HammerIcon,
  HandIcon,
  HandshakeIcon,
  HardHatIcon,
  ImageIcon,
  KeyIcon,
  LinkedinLogoIcon,
  LockKeyIcon,
  LockKeyOpenIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  PhoneCallIcon,
  PlayIcon,
  PlugsConnectedIcon,
  PlugsIcon,
  RocketLaunchIcon,
  StarFourIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import { interactions } from "./interact";

/*
  Every button says what it does with a small scene of its own, played inside
  the button while the mouse is over it: the label rolls up out of the way and
  the scene takes the pill (styles.css, "Button scenes"). Mark a button with
  data-glyph="<kind>"; a card-shaped button marks the pill inside it that
  should host the scene with data-glyph-host. A click plays a finale. Desktop
  only: phones have no hover.

    build     a builder in a hard hat hammers a tower of blocks together
    partner   two hands reach out and shake on it
    novae     a new star flares and bursts into the NOVAe logo
    access    a key slides into a lock and turns it open
    apply     a pen fills in the form and it gets stamped
    email     a letter drops into its envelope and it flies off
    call      a phone rings and a date lands in the calendar
    tier      three podium bars rise and a crown lands on top
    recap     the clapperboard snaps and the film rolls
    photos    a camera flashes and a photo slides out
    linkedin  a profile pops up and you connect
    share     a paper plane loops off to a friend
    connect   two plugs meet and spark
    ship      a rocket lifts off
*/

export type GlyphKind =
  | "build"
  | "partner"
  | "novae"
  | "access"
  | "apply"
  | "email"
  | "call"
  | "tier"
  | "recap"
  | "photos"
  | "linkedin"
  | "share"
  | "connect"
  | "ship";

const Sparks = ({ n = 3, className = "" }: { n?: number; className?: string }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <i key={i} className={`gs-spark ${className}`} style={{ "--k": i } as React.CSSProperties} />
    ))}
  </>
);

const SCENES: Record<GlyphKind, () => ReactNode> = {
  build: () => (
    <>
      <span className="gs-body" />
      <HardHatIcon weight="fill" className="gs-hat" />
      <HammerIcon weight="fill" className="gs-hammer" />
      <i className="gs-block b1" />
      <i className="gs-block b2" />
      <i className="gs-block b3" />
      <Sparks className="at-build" />
    </>
  ),
  partner: () => (
    <>
      <HandIcon weight="fill" className="gs-hand l" />
      <HandIcon weight="fill" className="gs-hand r" />
      <HandshakeIcon weight="fill" className="gs-shake" />
      <Sparks n={4} className="at-shake" />
    </>
  ),
  novae: () => (
    <>
      <span className="gs-rays">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} style={{ "--k": i } as React.CSSProperties} />
        ))}
      </span>
      <StarFourIcon weight="fill" className="gs-star" />
      <img src="/brand/novae/logo-long-white.webp" alt="" className="gs-novae" />
    </>
  ),
  access: () => (
    <>
      <LockKeyIcon weight="fill" className="gs-lock" />
      <LockKeyOpenIcon weight="fill" className="gs-lock-open" />
      <KeyIcon weight="fill" className="gs-key" />
      <Sparks n={4} className="at-lock" />
    </>
  ),
  apply: () => (
    <>
      <span className="gs-paper">
        <i />
        <i />
        <i />
      </span>
      <PencilSimpleIcon weight="fill" className="gs-pen" />
      <CheckCircleIcon weight="fill" className="gs-check" />
    </>
  ),
  email: () => (
    <>
      <span className="gs-letter">
        <i />
        <i />
      </span>
      <EnvelopeSimpleIcon weight="fill" className="gs-env" />
      <span className="gs-speed">
        <i />
        <i />
        <i />
      </span>
    </>
  ),
  call: () => (
    <>
      <span className="gs-waves">
        <i />
        <i />
      </span>
      <PhoneCallIcon weight="fill" className="gs-phone" />
      <CalendarCheckIcon weight="fill" className="gs-cal" />
    </>
  ),
  tier: () => (
    <>
      <i className="gs-bar t1" />
      <i className="gs-bar t2" />
      <i className="gs-bar t3" />
      <CrownIcon weight="fill" className="gs-crown" />
      <Sparks n={3} className="at-crown" />
    </>
  ),
  recap: () => (
    <>
      <FilmSlateIcon weight="fill" className="gs-slate" />
      <i className="gs-flash" />
      <span className="gs-film">
        {Array.from({ length: 6 }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      <PlayIcon weight="fill" className="gs-play" />
    </>
  ),
  photos: () => (
    <>
      <ImageIcon weight="fill" className="gs-photo" />
      <CameraIcon weight="fill" className="gs-cam" />
      <i className="gs-flash at-cam" />
    </>
  ),
  linkedin: () => (
    <>
      <LinkedinLogoIcon weight="fill" className="gs-in" />
      <UserPlusIcon weight="fill" className="gs-connect" />
      <Sparks n={3} className="at-connect" />
    </>
  ),
  share: () => (
    <>
      <i className="gs-trail" />
      <PaperPlaneTiltIcon weight="fill" className="gs-plane" />
    </>
  ),
  connect: () => (
    <>
      <PlugsIcon weight="fill" className="gs-plugs" />
      <PlugsConnectedIcon weight="fill" className="gs-plugged" />
      <Sparks n={4} className="at-plug" />
    </>
  ),
  ship: () => (
    <>
      <span className="gs-exhaust">
        <i />
        <i />
        <i />
      </span>
      <RocketLaunchIcon weight="fill" className="gs-rocket" />
    </>
  ),
};

/**
 * Plays the scene inside whichever button the mouse is over. The scene is
 * rendered straight into that button (a portal), sized to fit it, and shown
 * with data-scene on the button, which also rolls the label away.
 */
export function ButtonScenes() {
  const [host, setHost] = useState<{ el: HTMLElement; kind: GlyphKind; scale: number } | null>(
    null,
  );
  const current = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let leave = 0;
    let act = 0;
    interactions.registerScenes(
      (el) => {
        window.clearTimeout(leave);
        const prev = current.current;
        if (!el) {
          if (prev) delete prev.dataset.playing;
          current.current = null;
          // Let the scene fade out before it goes.
          leave = window.setTimeout(() => setHost(null), 350);
          return;
        }
        const target = el.querySelector<HTMLElement>("[data-glyph-host]") ?? el;
        if (prev && prev !== target) delete prev.dataset.playing;
        current.current = target;
        const kind = el.dataset.glyph as GlyphKind;
        // Layout size, not the box on screen: a door still swinging in, or the
        // crew pill before it grows, would otherwise measure small.
        const w = target.offsetWidth;
        const h = target.offsetHeight;
        const stageW = kind === "share" ? 52 : 160;
        const scale = Math.min(1, (w - 14) / stageW, (h - 2) / 52);
        setHost({ el: target, kind, scale: Math.max(0.5, scale) });
      },
      () => {
        const t = current.current;
        if (!t) return;
        window.clearTimeout(act);
        delete t.dataset.act;
        void t.offsetWidth;
        t.dataset.act = "";
        act = window.setTimeout(() => delete t.dataset.act, 600);
      },
    );
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(act);
      interactions.registerScenes(null, null);
    };
  }, []);

  // Once the scene is in the button: settle its styles first, so the fade in
  // and the label's roll run as transitions, then start it.
  useLayoutEffect(() => {
    const el = host?.el;
    if (!el || current.current !== el) return;
    void el.offsetWidth;
    el.dataset.playing = "";
  }, [host]);

  if (!host) return null;
  const Scene = SCENES[host.kind];
  return createPortal(
    <span
      className="bs"
      data-kind={host.kind}
      aria-hidden="true"
      style={{ "--bs-scale": host.scale } as React.CSSProperties}
    >
      <span className="bs-stage">
        <Scene />
      </span>
    </span>,
    host.el,
  );
}
