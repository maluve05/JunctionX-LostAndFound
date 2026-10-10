import { Seam } from "../Seam";

/**
 * Chapter two: what FORGe really is. The sparks warp in and gather into
 * "2026", this year's edition, while the idea rises up out of depth in three
 * short sentences. The chapter holds for a beat (a sticky stage) so the year
 * can land.
 */
export function Idea() {
  return (
    <section id="event" data-chapter="The idea" className="relative h-[175svh]">
      <Seam label="The idea" />
      <div data-scene="year" className="scene-marker" />
      <div className="sticky top-0 flex h-[100svh] items-end overflow-clip lg:items-center">
        <div className="shell pb-[calc(env(safe-area-inset-bottom)+112px)] md:pb-16 lg:pb-0">
          <div data-enter="depth" className="max-w-[560px] lg:max-w-[44%]">
            <h2 data-split className="h2">
              Real problems.
              <br />
              Real tools.
              <br />
              <span className="text-lime">Real demos.</span>
            </h2>
            <div>
              <p data-rise className="lead mt-7">
                FORGe puts developers, designers, founders and students in one room with partners
                who bring real challenges. Teams form fast, build for a weekend and ship to a public
                demo.
              </p>
              <dl data-rise className="facts mt-10">
                <div className="fact">
                  <dt>How long</dt>
                  <dd>One weekend</dd>
                </div>
                <div className="fact">
                  <dt>The challenges</dt>
                  <dd>Set by partners</dd>
                </div>
                <div className="fact">
                  <dt>When</dt>
                  <dd>Web Summit week</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
