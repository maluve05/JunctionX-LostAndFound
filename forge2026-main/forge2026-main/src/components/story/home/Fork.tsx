import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Seam } from "../Seam";
import { stage } from "../stage";
import { Roll } from "../Roll";

type DoorProps = {
  to: "/builders" | "/partners";
  side: -1 | 1;
  word: string;
  body: string;
  cta: string;
  tone: "lime" | "lilac";
};

/**
 * A way in. It swings open on its hinge as the chapter arrives, leans toward
 * the pointer with a light that follows it, and the stream of shards on its
 * side of the screen runs faster while you are over it.
 */
function Door({ to, side, word, body, cta, tone }: DoorProps) {
  const leave = () => stage.setBias(0);

  return (
    <div className="door-hinge" data-side={side < 0 ? "left" : "right"}>
      <Link
        to={to}
        data-tone={tone}
        data-cursor="Enter"
        data-glyph={to === "/builders" ? "build" : "partner"}
        className="door"
        onPointerEnter={() => stage.setBias(side)}
        onPointerLeave={leave}
        onFocus={() => stage.setBias(side)}
        onBlur={leave}
      >
        <span className="door-word">{word}</span>
        <span className="mt-auto block">
          <span className="door-body block max-w-[30ch] text-[17px] leading-relaxed">{body}</span>
          <span className="door-cta" data-glyph-host>
            <Roll>{cta}</Roll>
            <ArrowRightIcon size={18} weight="bold" className="arrow" aria-hidden="true" />
          </span>
        </span>
      </Link>
    </div>
  );
}

/** The last chapter: the story splits in two, and you pick your way in. */
export function Fork() {
  return (
    <section id="join" data-chapter="Your move" className="relative">
      <Seam label="Your move" />
      <div data-scene="fork" className="scene-marker" />
      <div className="shell pb-28 pt-28 md:pb-36 md:pt-40">
        <h2 data-split className="h2 text-center">
          One room.
          <br />
          One weekend.
          <br />
          <span className="text-lime">Your move.</span>
        </h2>
        <div
          data-enter="doors"
          className="mt-14 grid grid-cols-1 gap-4 md:mt-20 md:grid-cols-2 md:gap-5"
        >
          <Door
            to="/builders"
            side={-1}
            tone="lime"
            word="Build"
            body="Apply solo or with a team. Any subject, any year, any country."
            cta="Apply to build"
          />
          <Door
            to="/partners"
            side={1}
            tone="lilac"
            word="Partner"
            body="Set a real challenge and meet the builders who take it on."
            cta="Partner with FORGe"
          />
        </div>
      </div>
    </section>
  );
}
