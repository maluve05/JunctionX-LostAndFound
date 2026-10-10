import { useRef } from "react";
import { ArrowUpIcon } from "@phosphor-icons/react";
import { BUILDER_FAQS } from "../story/content";
import { Chapter, Door, EarlyAccess, Faqs, Follow, PhoneFooter } from "./parts";
import { ForYou, PAGE_PHOTOS, Proof, Weekend } from "./sections";
import { phoneStory } from "./story";
import { usePhonePage } from "./usePhonePage";

/**
 * For builders, on a phone: say yes quickly. The early-access form is on the
 * first screen; each chapter after it answers one question that stops people
 * applying, and the last one brings you back to the form.
 */
export function PhoneBuilders() {
  const ref = useRef<HTMLElement>(null);
  usePhonePage(ref, "/builders");

  return (
    <main ref={ref} className="ph-page">
      <section id="m-top" className="ph-cover ph-cover-sub">
        <p className="ph-label ph-kicker">
          <i className="ph-live" aria-hidden="true" />
          Builders · FORGe 2026
        </p>
        <h1 className="ph-display">
          Build at Portugal’s <span className="ph-lime">biggest hackathon.</span>
        </h1>
        <p className="ph-lead">
          One weekend in Lisbon during Web Summit week, November 2026. Apply solo or with a team.
        </p>
        <div id="m-apply" className="ph-card ph-apply">
          <p className="ph-apply-title">Be first in line.</p>
          <EarlyAccess />
        </div>
        <Follow />
      </section>

      <Chapter
        id="m-weekend"
        n={1}
        label="The weekend"
        tone="sky"
        title={
          <>
            One weekend, <span className="ph-tone">three moves.</span>
          </>
        }
      >
        <Weekend id="m-weekend" photos={PAGE_PHOTOS.builders.weekend} />
      </Chapter>

      <Chapter
        id="m-who"
        n={2}
        label="Who gets in"
        tone="lime"
        title={
          <>
            Who we’re <span className="ph-tone">looking for.</span>
          </>
        }
        lead="Places are limited. We look for people who build, whatever they study."
      >
        <ForYou />
      </Chapter>

      <Chapter
        id="m-record"
        n={3}
        label="2025"
        tone="coral"
        title={
          <>
            2025, in <span className="ph-tone">numbers.</span>
          </>
        }
        lead="The first FORGe, 7 and 8 November 2025."
      >
        <Proof shots={PAGE_PHOTOS.builders.shots} />
      </Chapter>

      <Chapter id="m-faq" n={4} label="Questions" tone="lilac" title="Quick answers.">
        <Faqs faqs={BUILDER_FAQS} />
      </Chapter>

      <Chapter
        id="m-your-move"
        n={5}
        label="Your move"
        tone="lime"
        title={
          <>
            One room.
            <br />
            One weekend.
            <br />
            <span className="ph-tone">Your move.</span>
          </>
        }
      >
        <a
          href="#m-apply"
          onClick={(e) => {
            e.preventDefault();
            phoneStory.go("m-apply");
          }}
          className="ph-btn ph-btn-light ph-wide"
          data-ph-rise
        >
          Get early access
          <ArrowUpIcon size={16} weight="bold" aria-hidden="true" />
        </a>
        <div className="ph-doors">
          <Door
            to="/partners"
            tone="lilac"
            word="Partner"
            body="Here to back it instead? Set a real challenge and meet the builders."
            cta="Partner with FORGe"
          />
        </div>
      </Chapter>

      <PhoneFooter />
    </main>
  );
}
