import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretDownIcon,
  CheckIcon,
  HammerIcon,
  HandshakeIcon,
  HouseIcon,
  ListIcon,
  XIcon,
} from "@phosphor-icons/react";
import { haptic } from "./haptic";
import { phoneStory } from "./story";

const useStory = () =>
  useSyncExternalStore(phoneStory.subscribe, phoneStory.getSnapshot, phoneStory.getServerSnapshot);

const pad = (i: number) => String(i + 1).padStart(2, "0");

/**
 * The phone's top bar: the wordmark as supplied, and the chapter you are in.
 * Tap the chapter to see them all. It turns solid once the page moves (no
 * frosted glass on phones: it costs too much to draw).
 */
export function PhoneTop() {
  const bar = useRef<HTMLElement>(null);
  const { chapters, active, page } = useStory();
  const sheet = useRef<HTMLDialogElement>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(
    () =>
      phoneStory.onScrolled((on) => {
        if (bar.current) bar.current.dataset.scrolled = on ? "on" : "off";
      }),
    [],
  );

  const home = (e: MouseEvent) => {
    if (path !== "/") return;
    e.preventDefault();
    phoneStory.top();
  };

  const current = active >= 0 ? chapters[active] : null;

  return (
    <>
      <header ref={bar} className="ph-top">
        <Link to="/" onClick={home} aria-label="FORGe home" className="ph-top-logo">
          <img src="/brand/wordmark.webp" alt="FORGe Hackathon" width={296} height={95} />
        </Link>
        {chapters.length > 0 && (
          <button
            type="button"
            className="ph-chap"
            data-ph-tone={current?.tone}
            onClick={() => {
              haptic(6);
              const d = sheet.current;
              // Safari before 15.4 has no <dialog>: show it in place instead.
              if (d?.showModal) d.showModal();
              else d?.setAttribute("open", "");
            }}
            aria-haspopup="dialog"
            aria-label={
              current ? `Chapter ${active + 1} of ${chapters.length}, ${current.label}` : "Chapters"
            }
          >
            {current ? (
              <>
                <span className="ph-chap-n tnum">{pad(active)}</span>
                <span className="ph-chap-t">{current.label}</span>
              </>
            ) : (
              <>
                <ListIcon size={15} weight="bold" aria-hidden="true" />
                <span className="ph-chap-t">Chapters</span>
              </>
            )}
            <CaretDownIcon size={12} weight="bold" aria-hidden="true" />
          </button>
        )}
      </header>
      <ChapterSheet ref={sheet} page={page} />
      <HashJump />
    </>
  );
}

/** Every chapter of the page, what you have read, and a jump to any of them. */
function ChapterSheet({
  ref,
  page,
}: {
  ref: React.RefObject<HTMLDialogElement | null>;
  page: string;
}) {
  const { chapters, active } = useStory();
  const [read, setRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // Fresh each time it opens: reading happens while it is closed.
    const open = () => setRead(phoneStory.read(page));
    const observer = new MutationObserver(() => d.open && open());
    observer.observe(d, { attributes: true, attributeFilter: ["open"] });
    // Tap outside the sheet (on the backdrop) to close it.
    const outside = (e: globalThis.MouseEvent) => {
      if (e.target === d) d.close();
    };
    d.addEventListener("click", outside);
    return () => {
      observer.disconnect();
      d.removeEventListener("click", outside);
    };
  }, [ref, page]);

  const go = (id: string) => {
    ref.current?.close();
    phoneStory.go(id);
  };

  const done = chapters.filter((c) => read.has(c.id)).length;

  return (
    <dialog ref={ref} className="ph-sheet" aria-labelledby="ph-sheet-title">
      <div className="ph-sheet-in">
        <div className="ph-sheet-head">
          <p id="ph-sheet-title" className="ph-label">
            {page === "/" ? "The story" : "On this page"}
          </p>
          <button
            type="button"
            className="ph-round"
            onClick={() => ref.current?.close()}
            aria-label="Close"
          >
            <XIcon size={18} weight="bold" aria-hidden="true" />
          </button>
        </div>
        <ol className="ph-sheet-list">
          {chapters.map((c, i) => {
            const now = i === active;
            const seen = read.has(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => go(c.id)}
                  className="ph-sheet-item"
                  data-ph-tone={c.tone}
                  data-now={now ? "" : undefined}
                  aria-current={now ? "step" : undefined}
                >
                  <span className="ph-sheet-n tnum">{pad(i)}</span>
                  <span className="ph-sheet-t">{c.label}</span>
                  {now ? (
                    <span className="ph-sheet-s">Now</span>
                  ) : seen ? (
                    <CheckIcon
                      size={16}
                      weight="bold"
                      className="ph-sheet-seen"
                      aria-label="Read"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="ph-sheet-foot">
          <span className="ph-sheet-bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${chapters.length ? done / chapters.length : 0})` }} />
          </span>
          <span className="tnum">
            {done} of {chapters.length} read
          </span>
        </div>
      </div>
    </dialog>
  );
}

/**
 * Links into a page (#apply, #tiers) land on the phone build's copy of that
 * place: its ids start with "m-", because the wide build, hidden on a phone,
 * keeps the plain ones.
 */
function HashJump() {
  const { hash, pathname } = useRouterState({
    select: (s) => ({ hash: s.location.hash, pathname: s.location.pathname }),
  });
  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`m-${hash}`);
      el?.scrollIntoView({ block: "start" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [hash, pathname]);
  return null;
}

const TABS = [
  { to: "/", label: "Story", Icon: HouseIcon },
  { to: "/builders", label: "Build", Icon: HammerIcon },
  { to: "/partners", label: "Partner", Icon: HandshakeIcon },
] as const;

/**
 * The phone's bottom bar: three tabs within thumb reach, and the Next button,
 * which moves the story on a chapter at a time (tap, tap, tap). A line along
 * the top of the bar fills as you read the page, in the colour of the chapter
 * you are in; at the end the button takes you back to the top.
 */
export function PhoneNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { chapters, active } = useStory();
  const line = useRef<HTMLElement>(null);

  useEffect(
    () =>
      phoneStory.onProgress((p) => {
        if (line.current) line.current.style.transform = `scaleX(${p.toFixed(4)})`;
      }),
    [],
  );

  const atEnd = chapters.length > 0 && active === chapters.length - 1;
  const upcoming = atEnd ? null : active < 0 ? chapters[0] : chapters[active + 1];

  const next = () => {
    haptic(8);
    const to = phoneStory.next();
    if (to) phoneStory.go(to.id);
    else phoneStory.top();
  };

  return (
    <nav aria-label="Primary" className="ph-nav" data-ph-tone={chapters[active]?.tone}>
      <span className="ph-nav-line" aria-hidden="true">
        <i ref={line} />
      </span>
      <ul className="ph-tabs">
        {TABS.map(({ to, label, Icon }) => {
          const on = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                preload="intent"
                onClick={(e) => {
                  haptic(6);
                  if (!on) return;
                  e.preventDefault();
                  phoneStory.top();
                }}
                className="ph-tab"
                data-on={on ? "" : undefined}
                aria-current={on ? "page" : undefined}
              >
                <Icon size={20} weight={on ? "fill" : "regular"} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {chapters.length > 0 && (
        <button
          type="button"
          onClick={next}
          className="ph-go"
          data-end={atEnd ? "" : undefined}
          aria-label={upcoming ? `Next: ${upcoming.label}` : "Back to the top"}
        >
          {atEnd ? (
            <ArrowUpIcon size={20} weight="bold" aria-hidden="true" />
          ) : (
            <ArrowDownIcon size={20} weight="bold" aria-hidden="true" />
          )}
        </button>
      )}
    </nav>
  );
}
