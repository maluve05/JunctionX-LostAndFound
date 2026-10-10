import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  ChartLineUpIcon,
  CheckIcon,
  CubeIcon,
  EnvelopeSimpleIcon,
  GlobeHemisphereWestIcon,
  IdentificationBadgeIcon,
  LinkedinLogoIcon,
  MegaphoneIcon,
  PlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import {
  CALL_URL,
  CREW,
  MORE_2025,
  NOVAE_VALUES,
  NOVAE_URL,
  OUTCOMES,
  PHASES,
  PHOTOS_2025,
  PROFILES,
  RECAP_2025_URL,
  RECORD,
  SPONSORS_2025,
  TIERS,
  mailto,
  type Photo2025,
} from "../story/content";
import { SponsorLogo } from "../story/SponsorLogo";
import { haptic } from "./haptic";
import { Photo, Rail, Share } from "./parts";
import { phoneStory } from "./story";

/* ── Photographs ─────────────────────────────────────────────────────── */

type Shot = { photo: Photo2025; caption: string };

const [BUILDING, ROOM, MENTORS, NIGHT, CLOSE] = PHOTOS_2025;
const M = MORE_2025;

/**
 * Where each photograph from 2025 goes on the phone. None appears twice: the
 * home page and the builders page share sections, not pictures. Captions say
 * plainly what each one shows.
 */
export const PAGE_PHOTOS = {
  home: {
    weekend: [M.guests, M.hall, M.stage],
    shots: [
      { photo: ROOM, caption: "The hacking floor" },
      { photo: BUILDING, caption: "Teams at work" },
      { photo: MENTORS, caption: "Mentors with a team" },
      { photo: NIGHT, caption: "Dinner, Friday night" },
      { photo: CLOSE, caption: "The close, Saturday" },
    ],
  },
  builders: {
    weekend: [M.espresso, M.backWall, M.daredata],
    shots: [
      { photo: M.armInArm, caption: "Five builders, arm in arm" },
      { photo: M.sofa, caption: "A break on the sofa" },
      { photo: M.laugh, caption: "Sharing a laugh" },
      { photo: M.fridges, caption: "Talking by the fridges" },
      { photo: M.guestTalk, caption: "Professor Vanneschi, NOVA IMS" },
    ],
  },
} satisfies Record<string, { weekend: readonly Photo2025[]; shots: readonly Shot[] }>;

/* ── The weekend ─────────────────────────────────────────────────────── */

/**
 * Connect, build, ship: three steps you tap through. Tap the step names, tap
 * the card for the next one, or swipe it sideways. Each step has its own
 * photograph from 2025, one per page (PAGE_PHOTOS).
 */
export function Weekend({ id, photos }: { id: string; photos: readonly Photo2025[] }) {
  const [step, setStep] = useState(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const STEPS = PHASES.map((p, i) => ({ ...p, photo: photos[i] }));

  const show = (i: number) => {
    const n = (i + STEPS.length) % STEPS.length;
    if (n === step) return;
    haptic(6);
    setStep(n);
  };

  return (
    <div className="ph-weekend" data-ph-rise>
      <div
        className="ph-seg"
        role="tablist"
        aria-label="The weekend, step by step"
        style={{ "--i": step, "--n": STEPS.length } as React.CSSProperties}
      >
        <span className="ph-seg-thumb" aria-hidden="true" />
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === step}
            aria-controls={`${id}-panel-${i}`}
            onClick={() => show(i)}
          >
            <span className="tnum">{i + 1}</span>
            {s.title}
          </button>
        ))}
      </div>

      <div
        className="ph-step"
        onClick={() => show(step + 1)}
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
            e.preventDefault();
            show(step + (dx < 0 ? 1 : -1));
          }
        }}
      >
        <div className="ph-step-media">
          {STEPS.map((s, i) => (
            <Photo
              key={s.title}
              {...s.photo}
              sizes="(max-width: 767px) 92vw, 800px"
              className="ph-step-photo"
              data-on={i === step ? "" : undefined}
            />
          ))}
          <span className="ph-step-count tnum" aria-hidden="true">
            {step + 1} / {STEPS.length}
          </span>
        </div>
        <div className="ph-step-texts">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              role="tabpanel"
              id={`${id}-panel-${i}`}
              aria-labelledby={`${id}-tab-${i}`}
              aria-hidden={i !== step}
              className="ph-step-text"
            >
              <h3>{s.title}.</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
        <p className="ph-step-hint" aria-hidden="true">
          {step < STEPS.length - 1
            ? `Tap for ${STEPS[step + 1].title.toLowerCase()}`
            : "Tap to start over"}
        </p>
      </div>
    </div>
  );
}

/* ── Is this for you? ────────────────────────────────────────────────── */

/** The profiles, short enough for a chip. */
const SHORT = [
  "Students",
  "Founders",
  "Developers",
  "Designers",
  "Business",
  "First-timers",
  "Experienced",
  "International",
  "Teams & solo",
];

/**
 * Who gets in. Places are limited, and the card says where each kind of
 * builder fits, rather than promising everyone a place: it should invite
 * people to apply without sounding like anyone gets in. Before a pick, the
 * nine kinds of builder do the talking.
 */
export function ForYou() {
  const [pick, setPick] = useState<number | null>(null);
  const p = pick === null ? null : PROFILES[pick];

  return (
    <div className="ph-foryou">
      <ul className="ph-chips ph-stagger" aria-label="Who you are" data-ph-rise>
        {PROFILES.map((profile, i) => (
          <li key={profile.title}>
            <button
              type="button"
              className="ph-chip"
              aria-pressed={pick === i}
              onClick={() => {
                haptic(6);
                setPick(i);
              }}
            >
              {SHORT[i]}
            </button>
          </li>
        ))}
      </ul>
      <div className="ph-answer" data-ph-rise>
        <div aria-live="polite" key={pick ?? "none"} className="ph-answer-say">
          {p ? (
            <>
              <p className="ph-label ph-answer-tag">Where you fit</p>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
            </>
          ) : (
            <>
              <p className="ph-answer-big tnum">{PROFILES.length}</p>
              <p>
                kinds of builder we look for. Pick the one that sounds like you to see where you
                fit.
              </p>
            </>
          )}
        </div>
        <div className="ph-answer-go">
          <Link to="/builders" hash="apply" className="ph-btn ph-btn-light">
            Get early access
            <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
          </Link>
          <Share
            text="FORGe 2026, Portugal’s biggest hackathon: one weekend in Lisbon during Web Summit week. Worth applying."
            path="/builders"
          />
        </div>
      </div>
    </div>
  );
}

/* ── 2025 ────────────────────────────────────────────────────────────── */

/** The first FORGe in its numbers, and in photographs you swipe through. */
export function Proof({ shots }: { shots: readonly Shot[] }) {
  return (
    <>
      <dl className="ph-stats ph-stagger" data-ph-rise>
        {RECORD.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd className="tnum">{r.value}</dd>
          </div>
        ))}
      </dl>
      <Rail label="Photographs from FORGe 2025" count={shots.length} dots>
        {shots.map(({ photo, caption }, i) => (
          <li key={photo.src} className="ph-shot">
            <Photo {...photo} sizes="84vw" className="ph-shot-img" />
            <p>
              <span className="tnum">{String(i + 1).padStart(2, "0")}</span>
              {caption}
            </p>
          </li>
        ))}
      </Rail>
      <a
        href={RECAP_2025_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="ph-btn ph-btn-ghost ph-wide"
        data-ph-rise
      >
        See the 2025 recap
        <ArrowUpRightIcon size={16} weight="bold" aria-hidden="true" />
      </a>
    </>
  );
}

/** Partner logos from 2025, still: no marquee on a phone. */
export function Logos({ title, skip }: { title: string; skip?: string }) {
  const list = skip ? SPONSORS_2025.filter((s) => s.name !== skip) : SPONSORS_2025;
  return (
    <div className="ph-logos">
      <p className="ph-label" data-ph-rise>
        {title}
      </p>
      <ul className="ph-stagger" data-ph-rise>
        {list.map((s) => (
          <li key={s.name}>
            <SponsorLogo
              file={s.logo}
              name={s.name}
              className="ph-logo"
              fallback={<span className="ph-logo-name">{s.name}</span>}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── The crew and NOVAe ──────────────────────────────────────────────── */

/** The team as a row of faces; each one opens that person's LinkedIn. */
export function CrewRail() {
  return (
    <Rail
      label="The FORGe 2026 team. Swipe to see everyone."
      count={CREW.length}
      className="ph-crew"
    >
      {CREW.map((m) => (
        <li key={m.photo} className="ph-person">
          <a
            href={m.linkedin}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`${m.name}, ${m.role}. LinkedIn profile, opens in a new tab.`}
          >
            <span className="ph-person-photo">
              <img
                src={`/team/sm/${m.photo}.webp`}
                alt=""
                width={400}
                height={400}
                loading="lazy"
                decoding="async"
              />
              <span className="ph-person-in" aria-hidden="true">
                <LinkedinLogoIcon size={15} weight="fill" />
              </span>
            </span>
            <span className="ph-person-name">{m.name}</span>
            <span className="ph-person-role">{m.role}</span>
          </a>
        </li>
      ))}
    </Rail>
  );
}

/** What NOVAe stands for: three pillars, one line each. */
export function NovaePillars() {
  return (
    <ol className="ph-pillars ph-stagger" data-ph-rise>
      {NOVAE_VALUES.map((v, i) => (
        <li key={v.title} className="ph-pillar">
          <span className="ph-pillar-n tnum">{String(i + 1).padStart(2, "0")}</span>
          <h3>{v.title}</h3>
          <p>{v.line}</p>
        </li>
      ))}
    </ol>
  );
}

export function VisitNovae() {
  return (
    <a
      href={NOVAE_URL}
      target="_blank"
      rel="noreferrer noopener"
      className="ph-btn ph-btn-ghost ph-wide"
      data-ph-rise
    >
      Visit NOVAe
      <ArrowUpRightIcon size={16} weight="bold" aria-hidden="true" />
    </a>
  );
}

/* ── Partners ────────────────────────────────────────────────────────── */

const OUTCOME_ICONS = [
  CubeIcon,
  UsersThreeIcon,
  MegaphoneIcon,
  IdentificationBadgeIcon,
  GlobeHemisphereWestIcon,
  ChartLineUpIcon,
];

/** Each outcome in one word, for the face of its tile. */
const OUTCOME_WORDS = ["Adoption", "Reach", "Exposure", "Hiring", "Ecosystem", "Insight"];
/** Colour of each tile's reverse, balanced across the two columns. */
const OUTCOME_TONES = ["lime", "sky", "coral", "lilac", "sky", "lime"] as const;

/**
 * What partners get, as six tiles with one word each. Tap a tile and it turns
 * over to say what that word means; tap again to turn it back. Dots count the
 * ones you have opened, and once all six are open it points on to the tiers.
 * When the grid first arrives, the first tile starts to turn, once, so it is
 * clear that they do.
 */
export function Outcomes({ next }: { next: string }) {
  const [open, setOpen] = useState<number[]>([]);
  const [seen, setSeen] = useState<number[]>([]);
  const grid = useRef<HTMLUListElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    const el = grid.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        timer = window.setTimeout(() => {
          if (touched.current) return;
          el.querySelector(".ph-get-front")?.animate(
            [{ transform: "none" }, { transform: "scaleX(0.84)" }, { transform: "none" }],
            { duration: 560, easing: "ease-in-out" },
          );
        }, 1300);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const turn = (i: number) => {
    touched.current = true;
    haptic(6);
    setOpen((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));
    setSeen((s) => (s.includes(i) ? s : [...s, i]));
  };

  const all = seen.length === OUTCOMES.length;

  return (
    <div className="ph-gets">
      <ul ref={grid} className="ph-get-grid ph-stagger" data-ph-rise>
        {OUTCOMES.map((o, i) => {
          const Icon = OUTCOME_ICONS[i];
          const on = open.includes(i);
          return (
            <li key={o.title}>
              <button
                type="button"
                className="ph-get"
                data-open={on ? "" : undefined}
                data-tone={OUTCOME_TONES[i]}
                aria-pressed={on}
                onClick={() => turn(i)}
              >
                <span className="ph-get-face ph-get-front" aria-hidden={on}>
                  <span className="ph-get-top">
                    <span className="ph-get-n tnum">{String(i + 1).padStart(2, "0")}</span>
                    <span className="ph-get-plus">
                      <PlusIcon size={13} weight="bold" />
                    </span>
                  </span>
                  <span className="ph-get-icon">
                    <Icon size={26} weight="duotone" />
                  </span>
                  <span className="ph-get-word">{OUTCOME_WORDS[i]}</span>
                </span>
                <span className="ph-get-face ph-get-back" aria-hidden={!on}>
                  <span className="ph-get-title">{o.title}</span>
                  <span className="ph-get-body">{o.body}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="ph-get-foot" data-ph-rise>
        <span className="ph-get-dots" aria-hidden="true">
          {OUTCOMES.map((o, i) => (
            <i key={o.title} data-on={seen.includes(i) ? "" : undefined} />
          ))}
        </span>
        {all ? (
          <a
            href={`#${next}`}
            onClick={(e) => {
              e.preventDefault();
              phoneStory.go(next);
            }}
            className="ph-get-done"
          >
            All six. Now pick a tier
            <ArrowDownIcon size={14} weight="bold" aria-hidden="true" />
          </a>
        ) : (
          <span className="ph-get-left" aria-live="polite">
            {seen.length === 0 ? "Tap a tile to turn it over" : `${seen.length} of 6 opened`}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Pick a tier from the row, see what it gets you, and book a call to talk it
 * through. A catalog with no prices: they come up on the call. Every panel is
 * rendered (the others `hidden`) so the text is in the HTML for search.
 */
export function TierPicker() {
  const [active, setActive] = useState(TIERS[0].id);
  const [level, setLevel] = useState(0);
  const row = useRef<HTMLDivElement>(null);

  return (
    <div className="ph-tiers" data-ph-rise>
      <div ref={row} className="ph-tier-tabs" role="tablist" aria-label="Partnership tiers">
        {TIERS.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`m-tier-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`m-tier-panel-${t.id}`}
              className="ph-tier-tab"
              onClick={(e) => {
                haptic(6);
                setActive(t.id);
                setLevel(0);
                e.currentTarget.scrollIntoView({
                  block: "nearest",
                  inline: "center",
                  behavior: "smooth",
                });
              }}
            >
              <span className="ph-tier-name">{t.name}</span>
            </button>
          );
        })}
      </div>
      {TIERS.map((t) => {
        const perks = t.levels ? t.levels[level].perks : t.perks;
        return (
          <div
            key={t.id}
            role="tabpanel"
            id={`m-tier-panel-${t.id}`}
            aria-labelledby={`m-tier-tab-${t.id}`}
            hidden={t.id !== active}
            className="ph-tier"
          >
            <h3>{t.tagline}</h3>
            {t.levels && (
              <div className="ph-mini-seg" role="group" aria-label="Talent level">
                {t.levels.map((l, i) => (
                  <button
                    key={l.name}
                    type="button"
                    aria-pressed={level === i}
                    onClick={() => {
                      haptic(6);
                      setLevel(i);
                    }}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}
            <ul className="ph-perks">
              {perks.map((perk) => (
                <li key={perk}>
                  <CheckIcon size={16} weight="bold" aria-hidden="true" />
                  {perk}
                </li>
              ))}
            </ul>
            <div className="ph-tier-go">
              <a
                href={CALL_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="ph-btn ph-btn-iris"
              >
                Book a call
                <ArrowUpRightIcon size={16} weight="bold" aria-hidden="true" />
              </a>
            </div>
          </div>
        );
      })}
      <p className="ph-note">
        Tracks are set with partners. <span className="ph-lime">Early ones shape them.</span>
      </p>
    </div>
  );
}

/** Only NOVA IMS is signed for 2026, so it stands alone above the 2025 wall. */
export function Confirmed() {
  return (
    <div className="ph-confirmed" data-ph-rise>
      <SponsorLogo
        file="ims.webp"
        name="NOVA IMS, Information Management School"
        className="ph-confirmed-logo"
        fallback={<span className="ph-logo-name">NOVA IMS</span>}
      />
      <span className="ph-label">Back from 2025</span>
    </div>
  );
}

export function Contact() {
  return (
    <div className="ph-contact" data-ph-rise>
      <a href={mailto("FORGe 2026 Partnership")} className="ph-btn ph-btn-light">
        Email us
        <EnvelopeSimpleIcon size={16} weight="bold" aria-hidden="true" />
      </a>
      <a href={CALL_URL} target="_blank" rel="noreferrer noopener" className="ph-btn ph-btn-ghost">
        Book a call
        <ArrowUpRightIcon size={16} weight="bold" aria-hidden="true" />
      </a>
    </div>
  );
}
