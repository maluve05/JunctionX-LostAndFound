import { useRef } from "react";
import { ArrowDownIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { useStoryPage } from "../useStoryPage";
import { StoryProgress } from "../chrome";
import { Footer } from "../Footer";
import { CALL_URL, PARTNER_FAQS } from "../content";
import { stage } from "../stage";
import { CrossLink, FaqSection, SubHero } from "../sub/parts";
import { Backers, ContactBand, Outcomes, Tiers, TracksStatement } from "./sections";
import { Roll } from "../Roll";

/**
 * For partners, on wide screens: what they get, the tiers (no prices; those
 * come up on a call), who has done it before, and one click to email or book
 * a call at every step.
 */
export function WidePartners() {
  const ref = useRef<HTMLElement>(null);
  useStoryPage(ref);

  return (
    <main ref={ref} className="story-page">
      <StoryProgress />
      <SubHero
        crumb="Partners"
        scene="handshake"
        sceneTop
        lines={["Partner with Portugal’s", <span className="text-lilac">biggest hackathon.</span>]}
        lead="Put your product in front of builders from Portugal and beyond, in Lisbon during Web Summit week, November 2026."
      >
        <div className="flex gap-3">
          <a
            href="#tiers"
            onClick={(e) => {
              e.preventDefault();
              stage.scrollTo("#tiers");
            }}
            data-cursor="Tiers"
            data-glyph="tier"
            className="btn btn-light max-sm:flex-1 max-sm:px-4"
          >
            <Roll>Pick a tier</Roll>
            <ArrowDownIcon size={16} weight="bold" aria-hidden="true" />
          </a>
          <a
            href={CALL_URL}
            data-cursor="Book"
            data-glyph="call"
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-ghost max-sm:flex-1 max-sm:px-4"
          >
            <Roll>Book a call</Roll>
            <ArrowUpRightIcon size={16} weight="bold" className="arrow-diag" aria-hidden="true" />
          </a>
        </div>
      </SubHero>
      <Outcomes />
      <Tiers />
      <TracksStatement />
      <Backers />
      <FaqSection faqs={PARTNER_FAQS} scene="field" />
      <ContactBand />
      <CrossLink
        to="/builders"
        kicker="Here to build?"
        title="Apply as a builder instead."
        cta="Apply to build"
      />
      <Footer />
    </main>
  );
}
