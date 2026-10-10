import { useState } from "react";
import {
  ArrowUpIcon,
  ArrowUpRightIcon,
  CheckIcon,
  EnvelopeSimpleIcon,
} from "@phosphor-icons/react";
import { CALL_URL, EMAIL, MORE_2025, OUTCOMES, SPONSORS_2025, TIERS, mailto } from "../content";
import { SponsorLogo } from "../SponsorLogo";
import { stage } from "../stage";
import { Roll } from "../Roll";

/*
  Six outcomes as a bento: two carry photographs from FORGe 2025 (a partner
  presenting, for adoption; guests meeting the team, for hiring), two carry
  brand colour, two are plain glass. The title is the message; the line under
  it is always visible, so nothing depends on hover.
*/
const BENTO = [
  // Framed low, so the slide's own words sit clear above the title.
  { span: "md:col-span-7", art: MORE_2025.daredata, pos: "50% 72%" },
  { span: "md:col-span-5", tone: "iris" },
  { span: "md:col-span-4" },
  { span: "md:col-span-4", art: MORE_2025.guests },
  { span: "md:col-span-4" },
  { span: "md:col-span-12 md:min-h-[180px]", tone: "lilac" },
] as const;

export function Outcomes() {
  return (
    <section id="outcomes" data-chapter="What you get" className="relative py-24 md:py-32">
      <div data-scene="connect" className="scene-marker" />
      <div className="shell">
        <h2 data-split className="h2 max-w-[12ch]">
          What you <span className="text-sky">get.</span>
        </h2>
        <ul className="mt-12 grid grid-cols-1 gap-3 md:mt-16 md:grid-cols-12 md:gap-4">
          {OUTCOMES.map((o, i) => {
            const cell = BENTO[i];
            const art = "art" in cell ? cell.art : undefined;
            const pos = "pos" in cell ? cell.pos : undefined;
            const tone = "tone" in cell ? cell.tone : undefined;
            return (
              <li
                key={o.title}
                data-rise
                data-tone={tone}
                className={`bento ${cell.span} ${art ? "bento-art" : "glass"}`}
              >
                {art && (
                  <>
                    <img
                      src={art.src}
                      alt={art.alt}
                      loading="lazy"
                      decoding="async"
                      width={art.w}
                      height={art.h}
                      style={pos ? { objectPosition: pos } : undefined}
                    />
                    <span className="bento-shade" aria-hidden="true" />
                  </>
                )}
                <span className="relative">
                  <h3 className="text-[clamp(1.4rem,2vw,1.9rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
                    {o.title}
                  </h3>
                  <p className="mt-2 max-w-[36ch] text-[15px] leading-relaxed text-white/75">
                    {o.body}
                  </p>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * Pick a tier, see what it includes, book a call to talk it through. A
 * catalog with no prices: they come up on the call. Every panel is rendered
 * (inactive ones `hidden`) so the text is still in the HTML for search.
 */
export function Tiers() {
  const [active, setActive] = useState(TIERS[0].id);
  const [level, setLevel] = useState(0);

  return (
    <section id="tiers" data-chapter="Tiers" className="relative scroll-mt-24 py-24 md:py-32">
      <div data-scene="field" className="scene-marker" />
      <div className="shell">
        <h2 data-split className="h2 max-w-[13ch]">
          Pick how you want to <span className="text-lilac">partner.</span>
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-4 md:mt-16 lg:grid-cols-12">
          <div
            role="tablist"
            aria-label="Partnership tiers"
            aria-orientation="vertical"
            className="tier-list lg:col-span-4"
          >
            {TIERS.map((t) => {
              const on = t.id === active;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tier-tab-${t.id}`}
                  aria-selected={on}
                  aria-controls={`tier-panel-${t.id}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => {
                    setActive(t.id);
                    setLevel(0);
                  }}
                  onKeyDown={(e) => {
                    const i = TIERS.findIndex((x) => x.id === active);
                    const d =
                      e.key === "ArrowDown" || e.key === "ArrowRight"
                        ? 1
                        : e.key === "ArrowUp" || e.key === "ArrowLeft"
                          ? -1
                          : 0;
                    if (!d) return;
                    e.preventDefault();
                    const next = TIERS[(i + d + TIERS.length) % TIERS.length];
                    setActive(next.id);
                    setLevel(0);
                    document.getElementById(`tier-tab-${next.id}`)?.focus();
                  }}
                  data-cursor={on ? "Chosen" : "Select"}
                  className="tier-tab"
                  data-on={on ? "" : undefined}
                >
                  <span className="text-lg font-semibold tracking-[-0.02em]">{t.name}</span>
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
                id={`tier-panel-${t.id}`}
                aria-labelledby={`tier-tab-${t.id}`}
                hidden={t.id !== active}
                className="tier-panel glass lg:col-span-8"
              >
                <h3 className="max-w-[22ch] text-[clamp(1.75rem,3vw,2.6rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-white">
                  {t.tagline}
                </h3>

                {t.levels && (
                  <div className="segmented mt-8" role="group" aria-label="Talent level">
                    {t.levels.map((l, i) => (
                      <button
                        key={l.name}
                        type="button"
                        aria-pressed={level === i}
                        onClick={() => setLevel(i)}
                        data-on={level === i ? "" : undefined}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                )}

                <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {perks.map((p) => (
                    <li key={p} className="flex gap-3 text-[15px] leading-snug text-white/85">
                      <CheckIcon
                        size={18}
                        weight="bold"
                        className="mt-px shrink-0 text-lilac"
                        aria-hidden="true"
                      />
                      {p}
                    </li>
                  ))}
                </ul>

                <div className="mt-10 flex">
                  <a
                    href={CALL_URL}
                    data-cursor="Book"
                    data-glyph="call"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn btn-iris"
                  >
                    <Roll>Book a call</Roll>
                    <ArrowUpRightIcon
                      size={16}
                      weight="bold"
                      className="arrow-diag"
                      aria-hidden="true"
                    />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Tracks come from partners: said once, big, with the way back to the tiers. */
export function TracksStatement() {
  return (
    <section id="tracks" data-chapter="Tracks" className="relative py-28 md:py-40">
      <div data-scene="ship" className="scene-marker" />
      <div className="shell">
        <h2 data-split className="h2 max-w-[15ch]">
          Tracks are set with partners. <span className="text-lime">Early ones shape them.</span>
        </h2>
        <a
          data-rise
          href="#tiers"
          onClick={(e) => {
            e.preventDefault();
            stage.scrollTo("#tiers");
          }}
          data-cursor="Tiers"
          data-glyph="tier"
          className="btn btn-light mt-12"
        >
          <Roll>Pick a tier</Roll>
          <ArrowUpIcon size={16} weight="bold" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

/**
 * Only NOVA IMS is signed for 2026, so it stands alone; the 2025 backers are a
 * separate, clearly past-tense wall so nobody reads them as 2026 partners.
 */
export function Backers() {
  const past = SPONSORS_2025.filter((s) => s.name !== "NOVA IMS");

  return (
    <section id="backers" data-chapter="Backers" className="relative py-24 md:py-32">
      <div data-scene="record" className="scene-marker" />
      <div className="shell">
        <h2 data-split className="h2 max-w-[12ch]">
          Confirmed for <span className="text-coral">2026.</span>
        </h2>

        <div data-rise className="confirmed glass mt-12">
          <div className="flex items-center gap-6">
            <SponsorLogo
              file="ims.webp"
              name="NOVA IMS, Information Management School"
              lazy={false}
              className="max-h-12 w-auto max-w-[220px] object-contain"
              fallback={<span className="text-2xl font-semibold text-white">NOVA IMS</span>}
            />
            <span className="text-[14px] text-white/60">Back from 2025</span>
          </div>
          <a
            href={mailto("FORGe 2026 Partnership")}
            data-cursor="Email"
            data-glyph="email"
            className="btn btn-light"
          >
            <Roll>Email us</Roll>
            <EnvelopeSimpleIcon size={16} weight="bold" aria-hidden="true" />
          </a>
        </div>

        <h3 data-rise className="mt-16 text-[15px] font-medium text-white/60">
          Backed us in 2025
        </h3>
        <ul data-rise className="logo-wall mt-6" aria-label="Partners of FORGe 2025">
          {past.map((s) => (
            <li key={s.name}>
              <SponsorLogo
                file={s.logo}
                name={s.name}
                className="max-h-8 w-auto max-w-[150px] object-contain"
                fallback={<span className="text-[15px] font-medium text-white/70">{s.name}</span>}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Talk to us: email, or a call with the Event Director. */
export function ContactBand() {
  return (
    <section className="relative py-10 md:py-16">
      <div className="shell">
        <div data-rise className="contact-band">
          <h2 className="h2 max-w-[13ch] text-white">Build with Portugal&rsquo;s best talent.</h2>
          <div className="flex flex-col gap-4 lg:items-end">
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={mailto("FORGe 2026 Partnership")}
                data-cursor="Email"
                data-glyph="email"
                className="btn btn-light"
              >
                <Roll>Email us</Roll>
                <EnvelopeSimpleIcon size={16} weight="bold" aria-hidden="true" />
              </a>
              <a
                href={CALL_URL}
                data-cursor="Book"
                data-glyph="call"
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-ghost-light"
              >
                <Roll>Book a call</Roll>
                <ArrowUpRightIcon
                  size={16}
                  weight="bold"
                  className="arrow-diag"
                  aria-hidden="true"
                />
              </a>
            </div>
            <p className="text-[14px] text-white/75">
              {EMAIL}, or a 15-minute call with the Event Director.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
