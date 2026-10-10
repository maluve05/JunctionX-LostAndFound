import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  InstagramLogoIcon,
  LinkedinLogoIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { EMAIL, NOVAE_URL, SOCIAL_HANDLE, SOCIALS, SITE_URL, type Faq } from "../story/content";
import { subscribeToNewsletter } from "@/lib/newsletter.functions";
import { playTram } from "./eggs";
import { haptic } from "./haptic";

export type Tone = "lime" | "sky" | "coral" | "lilac";

/**
 * A chapter of a phone page: its number and name, a headline, then whatever
 * it holds. Each chapter wears one colour (`tone`): its number, the words
 * marked `ph-tone` in its headline, and the progress line while you read it.
 */
export function Chapter({
  id,
  n,
  label,
  tone,
  title,
  lead,
  children,
  className = "",
}: {
  id: string;
  n: number;
  label: string;
  tone: Tone;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      data-ph-chapter={label}
      data-ph-tone={tone}
      className={`ph-chapter ${className}`}
    >
      <header className="ph-head" data-ph-rise>
        <p className="ph-label ph-num">
          <span className="tnum">{String(n).padStart(2, "0")}</span>
          {label}
        </p>
        <h2 className="ph-h2">{title}</h2>
        {lead && <p className="ph-lead">{lead}</p>}
      </header>
      {children}
    </section>
  );
}

/**
 * A photograph, sharp but no heavier than the screen needs: phones pick the
 * 800px version (`-800.webp` beside the original) unless they need more.
 */
export function Photo({
  src,
  alt,
  w,
  h,
  sizes = "100vw",
  pos,
  className = "",
  ...rest
}: {
  src: string;
  alt: string;
  w: number;
  h: number;
  sizes?: string;
  pos?: string;
  className?: string;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height">) {
  const small = src.replace(/\.webp$/, "-800.webp");
  return (
    <img
      {...rest}
      src={small}
      srcSet={`${small} 800w, ${src} ${w}w`}
      sizes={sizes}
      width={w}
      height={h}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      style={pos ? { objectPosition: pos } : undefined}
    />
  );
}

/**
 * A row you swipe sideways, one card at a time. With `dots`, a row of dots
 * says which card is showing.
 */
export function Rail({
  label,
  count,
  dots = false,
  className = "",
  children,
}: {
  label: string;
  count: number;
  dots?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [at, setAt] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !dots) return;
    const items = Array.from(el.children);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setAt(items.indexOf(e.target));
      },
      { root: el, threshold: 0.6 },
    );
    items.forEach((item) => io.observe(item));
    return () => io.disconnect();
  }, [dots]);

  return (
    <div className={`ph-rail-wrap ${className}`} data-ph-rise>
      <ul ref={ref} className="ph-rail" aria-label={label} tabIndex={0}>
        {children}
      </ul>
      {dots && count > 1 && (
        <p className="ph-dots" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <i key={i} data-on={i === at ? "" : undefined} />
          ))}
        </p>
      )}
    </div>
  );
}

/** Send FORGe to someone: the phone's own share sheet, or the link copied. */
export function Share({
  text,
  path = "/",
  label = "Send to a friend",
  className = "ph-btn ph-btn-ghost",
}: {
  text: string;
  path?: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const share = async () => {
    haptic(8);
    const url = `${SITE_URL}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "FORGe 2026", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Closed the share sheet, or no clipboard: nothing to do.
    }
  };

  return (
    <button type="button" onClick={share} className={className}>
      {copied ? (
        <CheckCircleIcon size={17} weight="fill" aria-hidden="true" />
      ) : (
        <PaperPlaneTiltIcon size={17} weight="fill" aria-hidden="true" />
      )}
      <span aria-live="polite">{copied ? "Link copied" : label}</span>
    </button>
  );
}

/** Questions that open in place. Native <details>, so answers stay in the HTML. */
export function Faqs({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="ph-faqs ph-stagger" data-ph-rise>
      {faqs.map((f) => (
        <details key={f.q} className="ph-faq">
          <summary>
            <h3>{f.q}</h3>
            <span className="ph-faq-icon" aria-hidden="true">
              <PlusIcon size={15} weight="bold" />
            </span>
          </summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

type Status = "idle" | "loading" | "success" | "error";

/**
 * Early access: an email onto the Brevo FORGe list, the same list as the wide
 * build's form, so everyone hears when applications open.
 */
export function EarlyAccess() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    setMessage("");
    try {
      const result = await subscribeToNewsletter({ data: { email, honeypot, list: "forge" } });
      if (result.ok) {
        setStatus("success");
        // The same words either way, so the form never reveals who has signed up.
        setMessage("You’re on the list. We’ll email you when applications open.");
        setEmail("");
        haptic(14);
      } else {
        setStatus("error");
        setMessage(result.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again later.");
    }
  };

  return (
    <form onSubmit={submit} className="ph-form">
      <label htmlFor={`${id}-email`} className="sr-only">
        Your email
      </label>
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        style={{ display: "none" }}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <input
        id={`${id}-email`}
        type="email"
        inputMode="email"
        autoComplete="email"
        enterKeyHint="send"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status !== "idle" && status !== "loading") {
            setStatus("idle");
            setMessage("");
          }
        }}
        placeholder="Your email"
        disabled={status === "loading"}
        aria-invalid={status === "error" || undefined}
        aria-describedby={`${id}-status`}
        className="ph-field"
      />
      <button type="submit" disabled={status === "loading"} className="ph-btn ph-btn-light">
        {status === "loading" ? "Adding you" : "Get early access"}
        {status !== "loading" && <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />}
      </button>
      <p id={`${id}-status`} role="status" data-status={status} className="ph-form-status">
        {status === "success" && <CheckCircleIcon size={16} weight="fill" aria-hidden="true" />}
        {message || "Applications open closer to the event."}
      </p>
    </form>
  );
}

/** One of the two ways in: a big card that goes to its page. */
export function Door({
  to,
  word,
  body,
  cta,
  tone,
}: {
  to: "/builders" | "/partners";
  word: string;
  body: string;
  cta: string;
  tone: "lime" | "lilac";
}) {
  return (
    <Link to={to} preload="intent" className="ph-door" data-tone={tone} data-ph-rise>
      <span className="ph-door-word">{word}</span>
      <span className="ph-door-body">{body}</span>
      <span className="ph-door-cta">
        {cta}
        <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
      </span>
    </Link>
  );
}

/** FORGe on Instagram (with its handle) and LinkedIn, near the top of the page. */
export function Follow() {
  return (
    <div className="ph-follow">
      <span className="ph-label">Follow</span>
      <a
        href={SOCIALS.instagram}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`FORGe on Instagram, ${SOCIAL_HANDLE}`}
        className="ph-follow-ig"
      >
        <InstagramLogoIcon size={17} aria-hidden="true" />
        <span>{SOCIAL_HANDLE}</span>
      </a>
      <a
        href={SOCIALS.linkedin}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="FORGe on LinkedIn"
        className="ph-round ph-follow-in"
      >
        <LinkedinLogoIcon size={18} weight="fill" aria-hidden="true" />
      </a>
    </div>
  );
}

/** The foot of every phone page. */
export function PhoneFooter() {
  return (
    <footer className="ph-footer">
      <img
        src="/brand/wordmark.webp"
        alt="FORGe Hackathon"
        width={296}
        height={95}
        loading="lazy"
        className="ph-footer-logo"
      />
      <p className="ph-footer-line">
        Portugal’s biggest hackathon.{" "}
        <span
          className="ph-lisbon"
          onClick={(e) => {
            const footer = e.currentTarget.closest("footer");
            if (footer) playTram(footer);
          }}
        >
          Lisbon
        </span>
        , November 2026, during Web Summit week.
      </p>
      <div className="ph-footer-social">
        <a
          href={SOCIALS.instagram}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="FORGe on Instagram"
          className="ph-round"
        >
          <InstagramLogoIcon size={20} aria-hidden="true" />
        </a>
        <a
          href={SOCIALS.linkedin}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="FORGe on LinkedIn"
          className="ph-round"
        >
          <LinkedinLogoIcon size={20} weight="fill" aria-hidden="true" />
        </a>
      </div>
      <p className="ph-footer-links">
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        <a href={NOVAE_URL} target="_blank" rel="noreferrer noopener">
          unlnovae.org
        </a>
      </p>
      <p className="ph-footer-copy">&copy; {new Date().getFullYear()} FORGe. Organised by NOVAe.</p>
    </footer>
  );
}
