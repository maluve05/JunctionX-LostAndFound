import { useRef } from "react";
import { useStoryPage } from "../useStoryPage";
import { StoryProgress } from "../chrome";
import { Footer } from "../Footer";
import { BUILDER_FAQS } from "../content";
import { CrossLink, FaqSection, SubHero } from "../sub/parts";
import { RegisterInterest } from "../sub/RegisterInterest";
import { FinalCall, Numbers2025, WeekendTrack } from "./sections";
import { WhoCanApply } from "./WhoCanApply";

/**
 * For builders, on wide screens: say yes quickly. The form is in the first
 * screen; everything after it answers the questions that stop people applying.
 */
export function WideBuilders() {
  const ref = useRef<HTMLElement>(null);
  useStoryPage(ref);

  return (
    <main ref={ref} className="story-page">
      <StoryProgress />
      <SubHero
        crumb="Builders"
        scene="field"
        lines={["Build at Portugal’s", <span className="text-lime">biggest hackathon.</span>]}
        lead="One weekend in Lisbon during Web Summit week, November 2026. Apply solo or with a team."
        aside={
          <div id="apply" className="apply-panel glass scroll-mt-28">
            <RegisterInterest />
          </div>
        }
      />
      <WeekendTrack />
      <WhoCanApply />
      <Numbers2025 />
      <FinalCall />
      <FaqSection faqs={BUILDER_FAQS} scene="field" />
      <CrossLink
        to="/partners"
        kicker="Here to back it?"
        title="Partner with FORGe instead."
        cta="Partner with FORGe"
      />
      <Footer />
    </main>
  );
}
