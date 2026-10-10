import { useRef, useState } from "react";
import { ArrowRightIcon, ArrowUpIcon, CheckIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { MORE_2025, PROFILES, SITE_URL } from "../content";
import { stage } from "../stage";
import { Roll } from "../Roll";

/**
 * A photograph from FORGe 2025 for each profile, none used anywhere else on
 * wide screens, framed on its people for the tall column beside the answer.
 */
const PHOTOS = [
  { ...MORE_2025.armInArm, pos: "50% 40%" },
  { ...MORE_2025.guestTalk, pos: "45% 35%" },
  { ...MORE_2025.hall, pos: "45% 50%" },
  { ...MORE_2025.laugh, pos: "48% 40%" },
  { ...MORE_2025.espresso, pos: "40% 35%" },
  { ...MORE_2025.sofa, pos: "72% 50%" },
  { ...MORE_2025.stage, pos: "55% 45%" },
  { ...MORE_2025.backWall, pos: "45% 50%" },
  { ...MORE_2025.fridges, pos: "45% 40%" },
];
/** The list's names: the profile titles, short enough for one line. */
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
const N = PROFILES.length;

/**
 * Who we're looking for: the nine kinds of builder in a numbered list, and
 * beside it where the chosen one fits, with the way to apply and a way to send
 * it to a friend. Nothing plays on its own. It is the partners' tier picker in
 * this chapter's lime: tabs, so the arrow keys move through the list, and
 * every answer is in the HTML.
 */
export function WhoCanApply() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const warmed = useRef(new Set<number>());

  /** Fetch a profile's photograph ahead of its choice, once. */
  const warm = (i: number) => {
    const k = (i + N) % N;
    if (warmed.current.has(k)) return;
    warmed.current.add(k);
    const img = new Image();
    img.decoding = "async";
    img.src = PHOTOS[k].src;
  };
  /** And its neighbours, the next choices the arrow keys make. */
  const warmAround = (i: number) => [i - 1, i, i + 1].forEach(warm);

  const choose = (i: number, focus = false) => {
    const next = (i + N) % N;
    setActive(next);
    warmAround(next);
    if (focus) document.getElementById(`who-tab-${next}`)?.focus();
  };

  const share = async (i: number) => {
    const url = `${SITE_URL}/builders#who`;
    const text = `${PROFILES[i].title}? You can apply to FORGe 2026, Portugal's biggest hackathon.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "FORGe 2026", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Sharing was cancelled or isn't allowed; nothing to do.
    }
  };

  const apply = (e: React.MouseEvent) => {
    e.preventDefault();
    stage.scrollTo("#apply");
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLInputElement>("#apply input[type=email]")
          ?.focus({ preventScroll: true }),
      1300,
    );
  };

  return (
    <section id="who" data-chapter="Who can apply" className="relative py-24 md:py-32">
      <div data-scene="build" className="scene-marker" />
      <div className="shell">
        <h2 data-split className="h2 max-w-[14ch]">
          Who we’re <span className="text-lime">looking for.</span>
        </h2>
        <p data-rise className="lead mt-5 max-w-[46ch]">
          Places are limited. We look for people who build, whatever they study. Pick the one that
          sounds like you.
        </p>

        <div data-rise className="who mt-12 md:mt-16">
          <div
            role="tablist"
            aria-label="Who we’re looking for"
            aria-orientation="vertical"
            className="who-tabs"
          >
            {PROFILES.map((p, i) => {
              const on = i === active;
              return (
                <button
                  key={p.title}
                  type="button"
                  role="tab"
                  id={`who-tab-${i}`}
                  aria-selected={on}
                  aria-controls={`who-panel-${i}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => choose(i)}
                  onPointerEnter={() => warm(i)}
                  onFocus={() => warmAround(i)}
                  onKeyDown={(e) => {
                    const to =
                      e.key === "ArrowDown" || e.key === "ArrowRight"
                        ? active + 1
                        : e.key === "ArrowUp" || e.key === "ArrowLeft"
                          ? active - 1
                          : e.key === "Home"
                            ? 0
                            : e.key === "End"
                              ? N - 1
                              : null;
                    if (to === null) return;
                    e.preventDefault();
                    choose(to, true);
                  }}
                  data-cursor={on ? "Chosen" : "Select"}
                  data-on={on ? "" : undefined}
                  className="who-tab"
                >
                  <span className="who-n tnum" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="who-name">{SHORT[i]}</span>
                  <ArrowRightIcon size={16} weight="bold" className="who-go" aria-hidden="true" />
                </button>
              );
            })}
          </div>

          {PROFILES.map((p, i) => (
            <div
              key={p.title}
              role="tabpanel"
              id={`who-panel-${i}`}
              aria-labelledby={`who-tab-${i}`}
              hidden={i !== active}
              className="who-panel glass"
            >
              <div className="who-copy">
                <p className="who-fit">Where you fit</p>
                <h3 className="who-title">{p.title}</h3>
                <p className="who-desc">{p.desc}</p>
                <div className="who-actions">
                  <a
                    href="#apply"
                    onClick={apply}
                    data-cursor="Apply"
                    data-glyph="apply"
                    className="btn btn-light"
                  >
                    <Roll>Get early access</Roll>
                    <ArrowUpIcon size={15} weight="bold" aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    onClick={() => share(i)}
                    aria-label={copied ? "Link copied" : "Send this to a friend"}
                    data-cursor={copied ? "Copied" : "Send"}
                    data-glyph="share"
                    className="round-btn who-share"
                  >
                    {copied ? (
                      <CheckIcon size={20} weight="bold" aria-hidden="true" />
                    ) : (
                      <PaperPlaneTiltIcon size={20} weight="fill" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
              <div className="who-photo">
                <img
                  src={PHOTOS[i].src}
                  alt={PHOTOS[i].alt}
                  width={PHOTOS[i].w}
                  height={PHOTOS[i].h}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: PHOTOS[i].pos }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
