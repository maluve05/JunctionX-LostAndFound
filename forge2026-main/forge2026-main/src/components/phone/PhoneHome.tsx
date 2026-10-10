import { useEffect, useRef, useState } from "react";
import { ArrowDownIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { Anvil } from "./Anvil";
import { Chapter, Door, Follow, PhoneFooter, Share } from "./parts";
import {
  CrewRail,
  ForYou,
  Logos,
  NovaePillars,
  PAGE_PHOTOS,
  Proof,
  VisitNovae,
  Weekend,
} from "./sections";
import { playNovaeE } from "./eggs";
import { phoneStory, type PhoneChapter } from "./story";
import { usePhonePage } from "./usePhonePage";

/**
 * The home page on a phone: FORGe as a story in seven short chapters, read
 * top to bottom or tapped through with the Next button. The cover is the
 * forge itself, live under your thumb.
 */
export function PhoneHome() {
  const ref = useRef<HTMLElement>(null);
  usePhonePage(ref, "/");

  return (
    <main ref={ref} className="ph-page">
      <Cover />

      <Chapter
        id="m-event"
        n={1}
        label="The idea"
        tone="lime"
        title={
          <>
            Real problems.
            <br />
            Real tools.
            <br />
            <span className="ph-tone">Real demos.</span>
          </>
        }
      >
        <dl className="ph-facts ph-stagger" data-ph-rise>
          <div>
            <dt>How long</dt>
            <dd>One weekend</dd>
          </div>
          <div>
            <dt>The challenges</dt>
            <dd>Set by partners</dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>Web Summit week</dd>
          </div>
        </dl>
      </Chapter>

      <Chapter
        id="m-weekend"
        n={2}
        label="The weekend"
        tone="sky"
        title={
          <>
            One weekend, <span className="ph-tone">three moves.</span>
          </>
        }
      >
        <Weekend id="m-weekend" photos={PAGE_PHOTOS.home.weekend} />
      </Chapter>

      <Chapter
        id="m-edition-2025"
        n={3}
        label="2025"
        tone="coral"
        title={
          <>
            We’ve done this <span className="ph-tone">before.</span>
          </>
        }
        lead="The first FORGe, 7 and 8 November 2025."
      >
        <Proof shots={PAGE_PHOTOS.home.shots} />
        <Logos title="Backed in 2025 by" />
      </Chapter>

      <Chapter
        id="m-for-you"
        n={4}
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
        id="m-crew"
        n={5}
        label="The crew"
        tone="lilac"
        title={
          <>
            Run by people who <span className="ph-tone">build.</span>
          </>
        }
        lead="The team organising FORGe 2026. Tap a face to meet them."
      >
        <CrewRail />
      </Chapter>

      <Chapter
        id="m-novae"
        n={6}
        label="NOVAe"
        tone="lime"
        title={
          <>
            Built by NOVA
            <span className="ph-novae-e" onClick={(e) => playNovaeE(e.currentTarget)}>
              e
            </span>
            .
          </>
        }
        lead="The student startup hub at NOVA IMS, Lisbon. It ran FORGe 2025 and is building 2026."
      >
        <NovaePillars />
        <VisitNovae />
      </Chapter>

      <Chapter
        id="m-join"
        n={7}
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
        <div className="ph-doors">
          <Door
            to="/builders"
            tone="lime"
            word="Build"
            body="Apply solo or with a team. Any subject, any year, any country."
            cta="Apply to build"
          />
          <Door
            to="/partners"
            tone="lilac"
            word="Partner"
            body="Set a real challenge and meet the builders who take it on."
            cta="Partner with FORGe"
          />
        </div>
        <div className="ph-share-row" data-ph-rise>
          <p>Know someone who should be there?</p>
          <Share text="FORGe 2026 is Portugal’s biggest hackathon. Come build with me." />
        </div>
      </Chapter>

      <PhoneFooter />
    </main>
  );
}

function Cover() {
  return (
    <section id="m-top" className="ph-cover">
      <p className="ph-label ph-kicker">
        <i className="ph-live" aria-hidden="true" />
        Lisbon · November 2026
      </p>
      <Anvil />
      <h1 className="ph-display">Portugal’s biggest hackathon.</h1>
      <p className="ph-lead ph-cover-lead">
        Builders from Portugal and beyond. One weekend, during Web Summit week.
      </p>
      <a
        href="#m-event"
        onClick={(e) => {
          e.preventDefault();
          phoneStory.go("m-event");
        }}
        className="ph-btn ph-btn-light ph-wide"
      >
        Start the story
        <ArrowDownIcon size={16} weight="bold" aria-hidden="true" />
      </a>
      <Follow />
      <PickUp />
    </section>
  );
}

/** Greets a returning reader once per visit, and offers the chapter they stopped at. */
let greeted = false;

function PickUp() {
  const [to, setTo] = useState<PhoneChapter | null>(null);

  useEffect(() => {
    if (greeted) return;
    const check = () => {
      const { page, chapters, active } = phoneStory.getSnapshot();
      if (page !== "/" || !chapters.length) return;
      greeted = true;
      // Already partway down (a reload): nothing to pick up.
      if (active < 0) setTo(phoneStory.resume("/", chapters));
      stop();
    };
    const stop = phoneStory.subscribe(check);
    check();
    return stop;
  }, []);

  if (!to) return null;
  return (
    <button type="button" onClick={() => phoneStory.go(to.id)} className="ph-pickup">
      <span className="ph-label">Welcome back</span>
      <span className="ph-pickup-t">Pick up at {to.label}</span>
      <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
    </button>
  );
}
