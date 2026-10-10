import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, PlusIcon } from "@phosphor-icons/react";
import type { Faq } from "../content";
import type { FormationName } from "../scene/names";
import { Roll } from "../Roll";

/**
 * A subpage's opening: breadcrumb, the page's single H1 (given as lines, so
 * each can rise in), a lead, and whatever the page leads with.
 *
 * Two shapes: with an `aside` (a form, say) the aside takes the right column
 * on wide screens; without one, the page's first formation takes that side,
 * and on phones it sits above the copy, so the copy starts lower (`sceneTop`).
 */
export function SubHero({
  crumb,
  lines,
  lead,
  children,
  aside,
  scene,
  sceneTop = false,
}: {
  crumb: string;
  lines: ReactNode[];
  lead: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  scene: FormationName;
  sceneTop?: boolean;
}) {
  return (
    <section id="top" data-scene={scene} data-chapter="Start" className="sub-hero relative">
      <div
        className="shell sub-hero-inner grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end"
        data-top={sceneTop ? "scene" : undefined}
      >
        <div className="max-w-[760px] lg:col-span-7">
          <nav aria-label="Breadcrumb" className="hero-enter">
            <ol className="crumbs">
              <li>
                <Link to="/" className="transition-colors duration-200 hover:text-white">
                  FORGe 2026
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-white/85">
                {crumb}
              </li>
            </ol>
          </nav>
          <h1 className="hero-title sub-title mt-7">
            {/* The trailing space keeps the words apart for search and screen readers. */}
            {lines.map((line, i) => (
              <span key={i} className="line">
                <span>{line}</span>{" "}
              </span>
            ))}
          </h1>
          <p className="hero-enter lead mt-6">{lead}</p>
          {children && <div className="hero-enter hero-enter-2 mt-9">{children}</div>}
        </div>
        {aside && (
          <div className="hero-enter hero-enter-2 lg:col-span-5 lg:col-start-8">{aside}</div>
        )}
      </div>
    </section>
  );
}

/**
 * Questions as native <details>: the answers stay in the HTML (crawlable, and
 * matching the FAQPage structured data) and open without JavaScript.
 */
export function FaqSection({ faqs, scene }: { faqs: Faq[]; scene?: FormationName }) {
  return (
    <section id="faq" data-chapter="Questions" className="relative py-24 md:py-32">
      {scene && <div data-scene={scene} className="scene-marker" />}
      <div className="shell grid grid-cols-1 gap-10 lg:grid-cols-12">
        <h2 data-split className="h2 lg:col-span-4">
          Quick <span className="text-lilac">answers.</span>
        </h2>
        <div className="lg:col-span-7 lg:col-start-6">
          {faqs.map((f) => (
            <details key={f.q} data-rise className="faq">
              <summary data-cursor="Open">
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-white md:text-xl">
                  {f.q}
                </h3>
                <span className="faq-icon" aria-hidden="true">
                  <PlusIcon size={16} weight="bold" />
                </span>
              </summary>
              <p className="max-w-[60ch] pb-6 text-[16px] leading-relaxed text-white/65">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** A way across to the other subpage, so each page passes weight to the other. */
export function CrossLink({
  to,
  kicker,
  title,
  cta,
}: {
  to: "/builders" | "/partners";
  kicker: string;
  title: string;
  cta: string;
}) {
  return (
    <section className="relative py-10 md:py-16">
      <div className="shell">
        <Link
          to={to}
          data-rise
          data-cursor="Go"
          data-glyph={to === "/builders" ? "build" : "partner"}
          className="crosslink glass"
        >
          <span>
            <span className="block text-[15px] text-white/60">{kicker}</span>
            <span className="mt-3 block text-[clamp(1.75rem,3.4vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
              {title}
            </span>
          </span>
          <span className="btn btn-ghost shrink-0" data-glyph-host>
            <Roll>{cta}</Roll>
            <ArrowRightIcon size={16} weight="bold" className="arrow" aria-hidden="true" />
          </span>
        </Link>
      </div>
    </section>
  );
}
