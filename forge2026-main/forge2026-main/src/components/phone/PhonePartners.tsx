import { useRef } from "react";
import { ArrowDownIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { CALL_URL, EMAIL, PARTNER_FAQS } from "../story/content";
import { Chapter, Door, Faqs, Follow, PhoneFooter } from "./parts";
import { Confirmed, Contact, Logos, Outcomes, TierPicker } from "./sections";
import { phoneStory } from "./story";
import { usePhonePage } from "./usePhonePage";

/**
 * For partners, on a phone: what you get, the tiers (no prices; those come
 * up on a call), who has done it before, and one tap to email or book a call.
 */
export function PhonePartners() {
  const ref = useRef<HTMLElement>(null);
  usePhonePage(ref, "/partners");

  return (
    <main ref={ref} className="ph-page">
      <section id="m-top" className="ph-cover ph-cover-sub">
        <p className="ph-label ph-kicker">
          <i className="ph-live" aria-hidden="true" />
          Partners · FORGe 2026
        </p>
        <h1 className="ph-display">
          Partner with Portugal’s <span className="ph-lilac">biggest hackathon.</span>
        </h1>
        <p className="ph-lead">
          Put your product in front of builders from Portugal and beyond, in Lisbon during Web
          Summit week, November 2026.
        </p>
        <div className="ph-cover-actions">
          <a
            href="#m-tiers"
            onClick={(e) => {
              e.preventDefault();
              phoneStory.go("m-tiers");
            }}
            className="ph-btn ph-btn-light"
          >
            Pick a tier
            <ArrowDownIcon size={16} weight="bold" aria-hidden="true" />
          </a>
          <a
            href={CALL_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="ph-btn ph-btn-ghost"
          >
            Book a call
            <ArrowUpRightIcon size={16} weight="bold" aria-hidden="true" />
          </a>
        </div>
        <Follow />
      </section>

      <Chapter
        id="m-outcomes"
        n={1}
        label="What you get"
        tone="sky"
        title={
          <>
            What you <span className="ph-tone">get.</span>
          </>
        }
        lead="Six things partners leave with. Tap each one."
      >
        <Outcomes next="m-tiers" />
      </Chapter>

      <Chapter
        id="m-tiers"
        n={2}
        label="Tiers"
        tone="lilac"
        title={
          <>
            Pick how you want to <span className="ph-tone">partner.</span>
          </>
        }
      >
        <TierPicker />
      </Chapter>

      <Chapter
        id="m-backers"
        n={3}
        label="Backers"
        tone="coral"
        title={
          <>
            Confirmed for <span className="ph-tone">2026.</span>
          </>
        }
      >
        <Confirmed />
        <Logos title="Backed us in 2025" skip="NOVA IMS" />
      </Chapter>

      <Chapter id="m-faq" n={4} label="Questions" tone="sky" title="Quick answers.">
        <Faqs faqs={PARTNER_FAQS} />
      </Chapter>

      <Chapter
        id="m-contact"
        n={5}
        label="Talk to us"
        tone="lilac"
        title={
          <>
            Build with Portugal’s <span className="ph-tone">best talent.</span>
          </>
        }
        lead={`${EMAIL}, or a 15-minute call with the Event Director.`}
      >
        <Contact />
        <div className="ph-doors">
          <Door
            to="/builders"
            tone="lime"
            word="Build"
            body="Here to build instead? Apply solo or with a team."
            cta="Apply to build"
          />
        </div>
      </Chapter>

      <PhoneFooter />
    </main>
  );
}
