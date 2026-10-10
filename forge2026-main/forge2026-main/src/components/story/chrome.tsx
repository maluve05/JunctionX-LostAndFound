import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { InstagramLogoIcon, LinkedinLogoIcon } from "@phosphor-icons/react";
import { SOCIAL_HANDLE, SOCIALS } from "./content";
import { stage } from "./stage";
import { Roll } from "./Roll";

/** On the home page, the logo and the Story tab scroll back to the top instead of reloading it. */
function useHomeTop() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (e: MouseEvent) => {
    if (path !== "/") return;
    e.preventDefault();
    stage.scrollTo(0);
  };
}

/**
 * The header: the wordmark as supplied, FORGe's socials, and the two ways in. It glasses over
 * once the page moves, and on wide screens tucks away while you read down and
 * returns the moment you scroll back up.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [tucked, setTucked] = useState(false);
  const goTop = useHomeTop();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        const y = self.scroll();
        setScrolled(y > 24);
        setTucked(self.direction === 1 && y > 360);
      },
    });
    return () => st.kill();
  }, []);

  return (
    <header
      className="site-nav"
      data-scrolled={scrolled ? "" : undefined}
      data-tucked={tucked ? "" : undefined}
    >
      <div className="site-nav-inner">
        <Link
          to="/"
          onClick={goTop}
          aria-label="FORGe home"
          data-cursor="Home"
          data-magnetic
          className="press flex items-center"
        >
          <img
            src="/brand/wordmark.webp"
            alt="FORGe Hackathon"
            width={325}
            height={95}
            className="h-7 w-auto md:h-8"
          />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-2 md:flex">
          {/* FORGe's socials, at the top of every page. */}
          <a
            href={SOCIALS.instagram}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`FORGe on Instagram, ${SOCIAL_HANDLE}`}
            data-cursor="Instagram"
            className="nav-social nav-ig"
          >
            <InstagramLogoIcon size={17} aria-hidden="true" />
            <span className="hidden lg:inline">{SOCIAL_HANDLE}</span>
          </a>
          <a
            href={SOCIALS.linkedin}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="FORGe on LinkedIn"
            data-cursor="LinkedIn"
            className="nav-social"
          >
            <LinkedinLogoIcon size={17} weight="fill" aria-hidden="true" />
          </a>
          <span className="nav-rule" aria-hidden="true" />
          <Link
            to="/builders"
            data-cursor="Apply"
            data-glyph="build"
            className="btn btn-ghost btn-sm"
            activeProps={{ className: "btn-ghost-active" }}
          >
            <Roll>Apply to build</Roll>
          </Link>
          <Link
            to="/partners"
            data-cursor="Partner"
            data-glyph="partner"
            className="btn btn-iris btn-sm"
          >
            <Roll>Partner with FORGe</Roll>
          </Link>
        </nav>
      </div>
    </header>
  );
}

/**
 * Where you are in the story. Wide screens get a rail of chapters on the right
 * edge (each one a jump); phones get a row of segments under the header that
 * fill as you read, the way stories do. Progress is written straight to the
 * DOM, never through React state.
 */
export function StoryProgress() {
  const { chapters, active } = useSyncExternalStore(
    stage.subscribe,
    stage.getSnapshot,
    stage.getServerSnapshot,
  );
  const railFills = useRef<(HTMLSpanElement | null)[]>([]);
  const barFills = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(
    () =>
      stage.onProgress((i, p) => {
        const r = railFills.current[i];
        if (r) r.style.transform = `scaleY(${p.toFixed(3)})`;
        const b = barFills.current[i];
        if (b) b.style.transform = `scaleX(${p.toFixed(3)})`;
      }),
    [],
  );

  if (!chapters.length) return null;

  return (
    <>
      <nav aria-label="Chapters" className="story-rail">
        {chapters.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => stage.scrollTo(`#${c.id}`)}
            data-active={i === active ? "" : undefined}
            aria-current={i === active ? "step" : undefined}
            className="rail-item"
          >
            <span className="rail-label">{c.label}</span>
            <span className="rail-track">
              <span
                ref={(el) => {
                  railFills.current[i] = el;
                }}
                className="rail-fill"
              />
            </span>
          </button>
        ))}
      </nav>
      <div className="story-bar" aria-hidden="true">
        <div className="story-bar-segs">
          {chapters.map((c, i) => (
            <span key={c.id} className="bar-seg">
              <span
                ref={(el) => {
                  barFills.current[i] = el;
                }}
                className="bar-fill"
              />
            </span>
          ))}
        </div>
        <span className="story-bar-label">{chapters[active]?.label}</span>
      </div>
    </>
  );
}
