import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import {
  AGE,
  CV_MAX_BYTES,
  daysIn,
  DIETARY,
  EXPERIENCE,
  HEARD,
  HEARD_GROUPS,
  isStudying,
  lastBuiltOptional,
  LIMITS,
  MAX_TEAMMATES,
  MONTHS,
  SKILLS,
  STATUSES,
  validate,
  type Errors,
  type Option,
} from "@/lib/apply/fields";
import { COUNTRIES } from "@/lib/apply/countries";
import { emailSuggestion } from "@/lib/apply/email";
import { Roll } from "@/components/story/Roll";
import { PlainCursor } from "./PlainCursor";
import { Turnstile, type TurnstileHandle } from "./Turnstile";

/*
  The builder application, one short step at a time.

  Each step checks its own answers against the shared schema
  (lib/apply/fields.ts) before moving on (and each field as you leave it),
  and the server checks everything again. Answers are kept in this tab as
  they are typed (not the CV), so a reload does not cost anyone their
  answers; they go when the tab closes, so nothing personal stays behind on a
  shared computer.
*/

type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  phoneCountry: string;
  phoneCode: string;
  phone: string;
  /** The date of birth as picked; sent as one "YYYY-MM-DD" birthDate. */
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  status: string;
  statusOther: string;
  university: string;
  course: string;
  linkedin: string;
  portfolio: string;
  skills: string[];
  skillsOther: string;
  experience: string;
  lastBuilt: string;
  hasTeam: string;
  teamName: string;
  teammates: { name: string; email: string }[];
  hopes: string;
  whyYou: string;
  dietary: string[];
  dietaryOther: string;
  heard: string;
  heardOther: string;
  consentComms: boolean;
  consentMedia: boolean;
  /** The honeypot. People never see it; bots fill it in. */
  website: string;
};

const EMPTY: Draft = {
  firstName: "",
  lastName: "",
  email: "",
  phoneCountry: "Portugal",
  phoneCode: "+351",
  phone: "",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
  status: "",
  statusOther: "",
  university: "",
  course: "",
  linkedin: "",
  portfolio: "",
  skills: [],
  skillsOther: "",
  experience: "",
  lastBuilt: "",
  hasTeam: "",
  teamName: "",
  teammates: [],
  hopes: "",
  whyYou: "",
  dietary: [],
  dietaryOther: "",
  heard: "",
  heardOther: "",
  consentComms: false,
  consentMedia: false,
  website: "",
};

/*
  The steps, in order, each with its colour. The team's draft has a challenge
  section (to be decided) between motivation and logistics: it becomes a step
  here, with its fields added to fields.ts and its answers stored in the
  `extra` column.
*/
const STEPS: { title: string; lead: string; fields: string[] }[] = [
  {
    title: "About you",
    lead: "So we know who you are and how to reach you.",
    fields: ["firstName", "lastName", "email", "phoneCode", "phone", "birthDate"],
  },
  {
    title: "Where you are now",
    lead: "What you do day to day, and where we can see your work.",
    fields: ["status", "statusOther", "university", "course", "linkedin", "portfolio", "cv"],
  },
  {
    title: "What you build",
    lead: "Developers, designers, founders and students all have a place here.",
    fields: ["skills", "skillsOther", "experience", "lastBuilt"],
  },
  {
    title: "Your team",
    lead: "Come with a team, or come alone and we'll place you on one.",
    fields: ["hasTeam", "teamName", "teammates"],
  },
  {
    title: "Why FORGe",
    lead: "Short answers. We read every one.",
    fields: ["hopes", "whyYou"],
  },
  {
    title: "Last details",
    lead: "A few things that help us plan the weekend.",
    fields: ["dietary", "dietaryOther", "heard", "heardOther", "consentComms", "consentMedia"],
  },
];

/** Each step's colour (apply.css), in order. */
const COLOURS = ["lime", "sky", "coral", "lilac", "sun", "rose"];

const TEAM_OPTIONS = [
  { value: "no", label: "No, place me on a team" },
  { value: "yes", label: "Yes, I have a team" },
];

/** "How did you hear" under its headings; "Somewhere else" closes the list without one. */
const HEARD_CHIPS = HEARD_GROUPS.map((g) => ({
  label: g.value === "other" ? undefined : g.label,
  options: HEARD.filter((h) => h.group === g.value),
}));

const DRAFT_KEY = "forge:apply-draft";

/** Whether a draft holds anything the applicant typed or picked (the country code alone is not an answer). */
function hasAnswers(d: Partial<Draft>): boolean {
  return Object.entries(d).some(([key, v]) => {
    if (key === "phoneCountry" || key === "phoneCode" || key === "website") return false;
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "boolean" ? v : Boolean(v);
  });
}

const stepOf = (key: string) => STEPS.findIndex((s) => s.fields.includes(key.split(".")[0]));
const pad = (n: number) => String(n).padStart(2, "0");

function cvError(cv: File | null): string | undefined {
  if (!cv) return "Add your CV as a PDF.";
  const pdf = cv.type === "application/pdf" || /\.pdf$/i.test(cv.name);
  if (!pdf) return "Use a PDF file.";
  if (cv.size > CV_MAX_BYTES) return "Use a PDF under 5 MB.";
  return undefined;
}

/** The date of birth as the server takes it: "YYYY-MM-DD", or "" until all three parts are picked. */
function birthDateOf(d: Draft): string {
  if (!d.birthDay || !d.birthMonth || !d.birthYear) return "";
  return `${d.birthYear}-${pad(Number(d.birthMonth))}-${pad(Number(d.birthDay))}`;
}

/** The answers as the shared schema reads them. */
function answersOf(d: Draft) {
  const { phoneCountry: _country, birthDay: _d, birthMonth: _m, birthYear: _y, ...rest } = d;
  return { ...rest, birthDate: birthDateOf(d) };
}

function allErrors(draft: Draft, cv: File | null): Errors {
  const errors = validate(answersOf(draft));
  const parts = [draft.birthDay, draft.birthMonth, draft.birthYear];
  if (errors.birthDate && parts.some(Boolean) && !parts.every(Boolean)) {
    errors.birthDate = "Pick the day, the month and the year.";
  }
  const cvMessage = cvError(cv);
  if (cvMessage) errors.cv = cvMessage;
  return errors;
}

const isEmailKey = (key: string) => key === "email" || /^teammates\.\d+\.email$/.test(key);

/** Every email on a step, keyed as its errors are. */
function emailsOn(step: number, d: Draft): [string, string][] {
  if (step === 0) return [["email", d.email]];
  if (step === 3 && d.hasTeam === "yes") {
    return d.teammates.map((m, i) => [`teammates.${i}.email`, m.email]);
  }
  return [];
}

function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Sent = { firstName: string; email: string; teamName: string };

export function ApplyForm({
  open,
  ready,
  siteKey,
}: {
  open: boolean;
  ready: boolean;
  siteKey: string | null;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [cv, setCv] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  /** "Did you mean …?" for an email that looks mistyped, keyed like errors. */
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  /** Fixes already offered at Continue ("email>ana@gmail.com"), so each holds the step only once. */
  const offered = useRef(new Set<string>());
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [restored, setRestored] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const canSend = open && ready && Boolean(siteKey);

  // Bring back answers typed earlier in this tab. After hydration, so the
  // server's empty form and the first browser render match.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      const raw = saved ? (JSON.parse(saved) as Record<string, unknown>) : null;
      // Only questions the form still asks (an older draft may hold an age).
      const parsed = raw
        ? (Object.fromEntries(Object.entries(raw).filter(([k]) => k in EMPTY)) as Partial<Draft>)
        : null;
      if (parsed && hasAnswers(parsed)) {
        setDraft({ ...EMPTY, ...parsed, website: "" });
        setRestored(true);
      }
      // Older versions kept drafts on the device; clear any left behind.
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Storage can be unavailable (private windows); the form works without it.
    }
  }, []);

  useEffect(() => {
    if (sent) return;
    try {
      const { website: _honeypot, ...rest } = draft;
      if (hasAnswers(rest)) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // As above.
    }
  }, [draft, sent]);

  // A new step: bring its top into view and move focus to its heading, so a
  // screen reader announces where you are.
  useEffect(() => {
    if (!moved.current) return;
    topRef.current?.scrollIntoView({ block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, [step, sent]);

  /** Clears what was said about these answers (and anything under them, like "teammates.0.email"). */
  const forget = (...keys: string[]) => {
    const hit = (k: string) => keys.some((key) => k === key || k.startsWith(`${key}.`));
    const drop = <T,>(o: Record<string, T>) =>
      Object.keys(o).some(hit) ? Object.fromEntries(Object.entries(o).filter(([k]) => !hit(k))) : o;
    setErrors(drop);
    setSuggestions(drop);
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    forget(String(key));
    setProblem("");
  };

  /** A field just left: if it holds something, say now whether it's right. */
  const check = (key: string, value: string) => {
    if (!value.trim()) return;
    const message = validate(answersOf(draft))[key];
    if (message) setErrors((e) => ({ ...e, [key]: message }));
    // An address that can't work comes with its likely fix.
    const better = message && isEmailKey(key) ? emailSuggestion(value) : null;
    if (better) setSuggestions((s) => ({ ...s, [key]: better }));
  };

  /** The applicant took a suggested email. */
  const takeSuggestion = (key: string) => {
    const better = suggestions[key];
    if (!better) return;
    if (key === "email") set("email", better);
    else {
      const i = Number(key.split(".")[1]);
      set(
        "teammates",
        draft.teammates.map((m, j) => (j === i ? { ...m, email: better } : m)),
      );
    }
  };

  const startOver = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nothing to clear.
    }
    setDraft(EMPTY);
    setCv(null);
    setErrors({});
    setSuggestions({});
    setRestored(false);
    setReached(0);
    setStep(0);
  };

  const stepErrors = (i: number, all: Errors) =>
    Object.fromEntries(Object.entries(all).filter(([k]) => stepOf(k) === i));

  const focusFirst = (errs: Errors) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    // The date of birth is three pickers: start at the first one still empty.
    const part =
      first === "birthDate"
        ? ["", "-month", "-year"][[draft.birthDay, draft.birthMonth, draft.birthYear].indexOf("")]
        : undefined;
    requestAnimationFrame(() => {
      const id =
        first === "birthDate" ? `ap-birthDate${part ?? ""}` : `ap-${first.replace(/\./g, "-")}`;
      document.getElementById(id)?.focus();
    });
  };

  const goTo = (i: number) => {
    moved.current = true;
    setStep(i);
    setReached((r) => Math.max(r, i));
    setProblem("");
  };

  const next = () => {
    const errs = stepErrors(step, allErrors(draft, cv));
    setErrors(errs);
    // A likely typo in an email stops Continue once, to offer the fix; pressed
    // again, Continue keeps the address as typed.
    const found = emailsOn(step, draft)
      .map(([key, value]) => [key, emailSuggestion(value)] as const)
      .filter((pair): pair is readonly [string, string] => Boolean(pair[1]));
    setSuggestions(Object.fromEntries(found));
    const fresh = found.filter(([key, better]) => !offered.current.has(`${key}>${better}`));
    for (const [key, better] of found) offered.current.add(`${key}>${better}`);
    if (Object.keys(errs).length) {
      focusFirst(errs);
      return;
    }
    if (fresh.length) {
      const id = `ap-${fresh[0][0].replace(/\./g, "-")}`;
      requestAnimationFrame(() => document.getElementById(id)?.focus());
      return;
    }
    goTo(step + 1);
  };

  const onToken = useCallback((t: string | null) => setToken(t), []);

  const submit = async () => {
    const all = allErrors(draft, cv);
    if (Object.keys(all).length) {
      const first = Math.min(...Object.keys(all).map(stepOf));
      const errs = stepErrors(first, all);
      setErrors(errs);
      if (first !== step) goTo(first);
      focusFirst(errs);
      return;
    }
    if (!canSend || !cv) return;
    if (!token) {
      setProblem("Please complete the check above the button first.");
      return;
    }

    setSending(true);
    setProblem("");
    try {
      const body = new FormData();
      body.set("data", JSON.stringify(answersOf(draft)));
      body.set("cv", cv, cv.name);
      body.set("turnstile", token);
      const res = await fetch("/api/apply", { method: "POST", body });
      const result = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        fields?: Errors;
        retry?: string;
      } | null;

      if (res.ok && result?.ok) {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          // Nothing to clear.
        }
        moved.current = true;
        setSent({ firstName: draft.firstName, email: draft.email, teamName: draft.teamName });
        return;
      }

      // A token is good for one try: get a fresh one whatever went wrong.
      setToken(null);
      turnstile.current?.reset();

      if (result?.fields && Object.keys(result.fields).length) {
        const steps = Object.keys(result.fields)
          .map(stepOf)
          .filter((i) => i >= 0);
        if (steps.length) {
          const first = Math.min(...steps);
          const errs = stepErrors(first, result.fields);
          setErrors(errs);
          if (first !== step) goTo(first);
          focusFirst(errs);
        }
      }
      setProblem(result?.error ?? "Something went wrong. Please try again.");
    } catch {
      setToken(null);
      turnstile.current?.reset();
      setProblem("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const err = (key: string) => errors[key];
  const label = last ? (sending ? "Sending" : "Send application") : "Continue";

  return (
    <div className="ap-page" data-step={sent ? "done" : String(step)}>
      <PlainCursor />

      <header className="ap-top">
        <a
          href="/builders"
          className="ap-wordmark"
          aria-label="FORGe, back to the builders page"
          data-cursor="Home"
        >
          <img src="/brand/wordmark.webp" alt="FORGe Hackathon" width={296} height={95} />
        </a>
        <a href="/builders" className="btn btn-ghost btn-sm" data-cursor="Home">
          <Roll>Back to FORGe</Roll>
        </a>
      </header>

      <div className="ap-wrap">
        <aside className="ap-side">
          <h1 className="ap-title">
            Apply to build at <em>FORGe 2026.</em>
          </h1>
          <p className="ap-intro">
            One weekend in Lisbon during Web Summit week. Places are limited, and every builder is
            picked from these applications.
          </p>

          {!sent && (
            <ol className="ap-steps" aria-label="Application steps">
              {STEPS.map((s, i) => {
                const state = i === step ? "on" : i < reached || i < step ? "done" : "todo";
                return (
                  <li key={s.title}>
                    <button
                      type="button"
                      className="ap-step"
                      style={{ "--s": `var(--${COLOURS[i]})` } as CSSProperties}
                      data-state={state}
                      disabled={i > reached}
                      aria-current={i === step ? "step" : undefined}
                      data-cursor={i <= reached && i !== step ? "Go" : undefined}
                      onClick={() => i <= reached && goTo(i)}
                    >
                      <span className="ap-step-num">{pad(i + 1)}</span>
                      {s.title}
                      <span className="ap-step-end">
                        {state === "on" ? "Now" : state === "done" ? "Done" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          <p className="ap-private">
            <span>
              <strong>Your application is private.</strong> Only the FORGe team can read it.
            </span>
          </p>
        </aside>

        <main className="ap-main" ref={topRef}>
          {!sent && (
            <div className="ap-mprogress" aria-hidden="true">
              <div className="ap-segments">
                {STEPS.map((s, i) => (
                  <span key={s.title} data-on={i <= step || undefined} />
                ))}
              </div>
              <p>
                Step {step + 1} of {STEPS.length}
              </p>
            </div>
          )}

          {sent ? (
            <div className="ap-panel">
              <div className="ap-head">
                <p className="ap-kicker">
                  <span>Sent</span>
                  <span>FORGe 2026</span>
                </p>
                <h2 ref={headingRef} tabIndex={-1} className="ap-step-title">
                  Application sent.
                </h2>
                <p className="ap-lead">
                  Thanks, {sent.firstName}. If you applied before with this email, we keep your
                  first application.
                </p>
              </div>
              <div className="ap-panel-body">
                <ol className="ap-next">
                  <li data-tone="sky">
                    <span className="ap-next-num">01</span>
                    <strong>We read your application</strong>
                    <p>Every application is read by the FORGe team.</p>
                  </li>
                  <li data-tone="lilac">
                    <span className="ap-next-num">02</span>
                    <strong>You hear from us by email</strong>
                    <p>We write to {sent.email}. Check your spam folder too.</p>
                  </li>
                  <li data-tone="sun">
                    <span className="ap-next-num">03</span>
                    <strong>See you in Lisbon</strong>
                    <p>One weekend during Web Summit week, November 2026.</p>
                  </li>
                </ol>
                {sent.teamName && (
                  <p className="ap-note" data-tone="rose" style={{ marginTop: 20 }}>
                    <span>
                      Each of your teammates applies too. Ask them to use the team name{" "}
                      <strong>{sent.teamName}</strong> so we keep you together.
                    </span>
                  </p>
                )}
                <div className="ap-done-actions">
                  <a href="/builders" className="btn btn-light" data-cursor="Home">
                    <Roll>Back to FORGe</Roll>
                    <ArrowRightIcon size={16} weight="bold" className="arrow" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <form
              className="ap-panel"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (last) void submit();
                else next();
              }}
            >
              <div className="ap-head">
                <p className="ap-kicker">
                  <span>
                    Step {pad(step + 1)} / {pad(STEPS.length)}
                  </span>
                  <span>FORGe 2026</span>
                </p>
                <h2 ref={headingRef} tabIndex={-1} className="ap-step-title">
                  {current.title}
                </h2>
                <p className="ap-lead">{current.lead}</p>
              </div>

              <div className="ap-panel-body">
                {!open && (step === 0 || last) && (
                  <p className="ap-note" data-tone="warn">
                    Applications aren&apos;t open yet. You can look around, but sending is switched
                    off.
                  </p>
                )}
                {open && !canSend && (
                  <p className="ap-note" data-tone="warn">
                    Applications are unavailable right now. Please come back a little later.
                  </p>
                )}
                {restored && step === 0 && (
                  <p className="ap-note">
                    <span>We kept the answers you started in this tab.</span>
                    <button type="button" onClick={startOver} data-cursor="Clear">
                      Start over
                    </button>
                  </p>
                )}

                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="ap-trap"
                  value={draft.website}
                  onChange={(e) => set("website", e.target.value)}
                />

                <div className="ap-fields" key={step}>
                  {step === 0 && (
                    <>
                      <div className="ap-row">
                        <TextField
                          name="firstName"
                          label="First name"
                          value={draft.firstName}
                          error={err("firstName")}
                          onChange={(v) => set("firstName", v)}
                          autoComplete="given-name"
                        />
                        <TextField
                          name="lastName"
                          label="Last name"
                          value={draft.lastName}
                          error={err("lastName")}
                          onChange={(v) => set("lastName", v)}
                          autoComplete="family-name"
                        />
                      </div>
                      <TextField
                        name="email"
                        label="Email"
                        type="email"
                        inputMode="email"
                        placeholder="you@example.com"
                        value={draft.email}
                        error={err("email")}
                        onChange={(v) => set("email", v)}
                        onBlur={() => check("email", draft.email)}
                        autoComplete="email"
                        suggest={{
                          value: suggestions.email,
                          keepable: !err("email"),
                          onUse: () => takeSuggestion("email"),
                        }}
                      />
                      <Field
                        name="phone"
                        label="Phone number"
                        hint="We only call about your application."
                        error={err("phoneCode") ?? err("phone")}
                      >
                        {(ids) => (
                          <div className="ap-phone">
                            <select
                              id="ap-phoneCode"
                              className="ap-input ap-select"
                              aria-label="Country code"
                              value={draft.phoneCountry}
                              autoComplete="tel-country-code"
                              data-cursor="Pick"
                              onChange={(e) => {
                                const c = COUNTRIES.find((x) => x.name === e.target.value);
                                set("phoneCountry", e.target.value);
                                if (c) set("phoneCode", c.code);
                              }}
                            >
                              {COUNTRIES.map((c) => (
                                <option key={c.name} value={c.name}>
                                  {c.name} {c.code}
                                </option>
                              ))}
                            </select>
                            <input
                              {...ids}
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel-national"
                              placeholder="912 345 678"
                              className="ap-input"
                              value={draft.phone}
                              onChange={(e) => set("phone", e.target.value)}
                              onBlur={() => check("phone", draft.phone)}
                            />
                          </div>
                        )}
                      </Field>
                      <BirthDate
                        day={draft.birthDay}
                        month={draft.birthMonth}
                        year={draft.birthYear}
                        error={err("birthDate")}
                        onChange={(parts) => {
                          setDraft((d) => ({ ...d, ...parts }));
                          forget("birthDate");
                          setProblem("");
                        }}
                      />
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <Options
                        name="status"
                        label="What do you do right now?"
                        options={STATUSES}
                        value={draft.status}
                        error={err("status")}
                        onChange={(v) => set("status", v)}
                      />
                      {draft.status === "other" && (
                        <TextField
                          name="statusOther"
                          label="Tell us what you do"
                          value={draft.statusOther}
                          error={err("statusOther")}
                          onChange={(v) => set("statusOther", v)}
                        />
                      )}
                      {isStudying(draft.status) && (
                        <div className="ap-row">
                          <TextField
                            name="university"
                            label="University"
                            value={draft.university}
                            error={err("university")}
                            onChange={(v) => set("university", v)}
                            autoComplete="organization"
                          />
                          <TextField
                            name="course"
                            label="Course"
                            value={draft.course}
                            error={err("course")}
                            onChange={(v) => set("course", v)}
                          />
                        </div>
                      )}
                      <TextField
                        name="linkedin"
                        label="LinkedIn profile"
                        type="url"
                        inputMode="url"
                        placeholder="linkedin.com/in/your-name"
                        value={draft.linkedin}
                        error={err("linkedin")}
                        onChange={(v) => set("linkedin", v)}
                        onBlur={() => check("linkedin", draft.linkedin)}
                      />
                      <TextField
                        name="portfolio"
                        label="GitHub or portfolio"
                        optional
                        type="url"
                        inputMode="url"
                        placeholder="github.com/your-name"
                        value={draft.portfolio}
                        error={err("portfolio")}
                        onChange={(v) => set("portfolio", v)}
                        onBlur={() => check("portfolio", draft.portfolio)}
                      />
                      <CvField
                        file={cv}
                        error={err("cv")}
                        onChange={(file) => {
                          setCv(file);
                          setErrors((e) => {
                            const { cv: _cv, ...rest } = e;
                            return rest;
                          });
                        }}
                      />
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <Chips
                        name="skills"
                        label="Your skills"
                        hint="Pick all that apply."
                        options={SKILLS}
                        value={draft.skills}
                        error={err("skills")}
                        onChange={(v) => set("skills", v)}
                      />
                      {draft.skills.includes("other") && (
                        <TextField
                          name="skillsOther"
                          label="Which other skill?"
                          value={draft.skillsOther}
                          error={err("skillsOther")}
                          onChange={(v) => set("skillsOther", v)}
                        />
                      )}
                      <Options
                        name="experience"
                        label="Hackathon experience"
                        options={EXPERIENCE}
                        value={draft.experience}
                        error={err("experience")}
                        onChange={(v) => {
                          set("experience", v);
                          // Whether the next answer is needed depends on this one.
                          forget("lastBuilt");
                        }}
                      />
                      <Written
                        name="lastBuilt"
                        label="What's the last thing you built?"
                        optional={lastBuiltOptional(draft.experience)}
                        hint={
                          lastBuiltOptional(draft.experience)
                            ? "Optional on your first hackathon. A school project, a side project or a club counts too."
                            : "An app, a product, a club, a business. What it was and what you did."
                        }
                        limits={LIMITS.lastBuilt}
                        value={draft.lastBuilt}
                        error={err("lastBuilt")}
                        onChange={(v) => set("lastBuilt", v)}
                      />
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <Options
                        name="hasTeam"
                        label="Do you already have a team?"
                        options={TEAM_OPTIONS}
                        value={draft.hasTeam}
                        error={err("hasTeam")}
                        onChange={(v) => {
                          set("hasTeam", v);
                          if (v === "yes" && draft.teammates.length === 0) {
                            set("teammates", [{ name: "", email: "" }]);
                          }
                        }}
                      />
                      {draft.hasTeam === "yes" && (
                        <>
                          <TextField
                            name="teamName"
                            label="Team name"
                            hint="Your teammates use the same name when they apply."
                            value={draft.teamName}
                            error={err("teamName")}
                            onChange={(v) => set("teamName", v)}
                          />
                          <Teammates
                            value={draft.teammates}
                            errors={errors}
                            suggestions={suggestions}
                            onChange={(v) => set("teammates", v)}
                            onCheck={check}
                            onSuggestion={takeSuggestion}
                          />
                        </>
                      )}
                    </>
                  )}

                  {step === 4 && (
                    <>
                      <Written
                        name="hopes"
                        label="What do you hope to get out of FORGe?"
                        limits={LIMITS.hopes}
                        value={draft.hopes}
                        error={err("hopes")}
                        onChange={(v) => set("hopes", v)}
                      />
                      <Written
                        name="whyYou"
                        label="Why should we pick you?"
                        hint="One or two lines."
                        limits={LIMITS.whyYou}
                        value={draft.whyYou}
                        error={err("whyYou")}
                        onChange={(v) => set("whyYou", v)}
                        rows={2}
                      />
                    </>
                  )}

                  {step === 5 && (
                    <>
                      <Chips
                        name="dietary"
                        label="Food intolerances or dietary needs"
                        hint="Pick all that apply."
                        optional
                        options={DIETARY}
                        value={draft.dietary}
                        error={err("dietary")}
                        onChange={(v) => {
                          // "None" stands alone.
                          const added = v.find((x) => !draft.dietary.includes(x));
                          set(
                            "dietary",
                            added === "none" ? ["none"] : v.filter((x) => x !== "none"),
                          );
                        }}
                      />
                      {draft.dietary.includes("other") && (
                        <TextField
                          name="dietaryOther"
                          label="What should we plan for?"
                          value={draft.dietaryOther}
                          error={err("dietaryOther")}
                          onChange={(v) => set("dietaryOther", v)}
                        />
                      )}
                      <Chips
                        name="heard"
                        label="How did you hear about FORGe?"
                        hint="Pick the place you heard about it first."
                        single
                        groups={HEARD_CHIPS}
                        value={draft.heard ? [draft.heard] : []}
                        error={err("heard")}
                        onChange={(v) => set("heard", v[v.length - 1] ?? "")}
                      />
                      {draft.heard === "other" && (
                        <TextField
                          name="heardOther"
                          label="Where did you hear about it?"
                          value={draft.heardOther}
                          error={err("heardOther")}
                          onChange={(v) => set("heardOther", v)}
                        />
                      )}
                      <fieldset className="ap-consents">
                        <legend className="ap-label">Consent</legend>
                        <Tick
                          name="consentComms"
                          checked={draft.consentComms}
                          error={err("consentComms")}
                          onChange={(v) => set("consentComms", v)}
                        >
                          I agree to receive emails from FORGe and NOVAe about my application and
                          the event.
                        </Tick>
                        <Tick
                          name="consentMedia"
                          checked={draft.consentMedia}
                          error={err("consentMedia")}
                          onChange={(v) => set("consentMedia", v)}
                        >
                          I agree to be photographed and filmed at the event, for FORGe&apos;s and
                          NOVAe&apos;s communications.
                        </Tick>
                      </fieldset>
                      {canSend && siteKey && (
                        <Field name="turnstile" label="One last check">
                          {() => (
                            <Turnstile
                              ref={turnstile}
                              siteKey={siteKey}
                              onToken={onToken}
                              className="ap-turnstile"
                            />
                          )}
                        </Field>
                      )}
                    </>
                  )}
                </div>

                {problem && (
                  <p className="ap-problem" role="alert">
                    {problem}
                  </p>
                )}

                <div className="ap-actions">
                  {step > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      data-cursor="Back"
                      onClick={() => goTo(step - 1)}
                    >
                      <ArrowLeftIcon size={16} weight="bold" aria-hidden="true" />
                      <Roll>Back</Roll>
                    </button>
                  )}
                  <div className="ap-actions-end">
                    {!last && (
                      <span className="ap-enter" aria-hidden="true">
                        or press <kbd>Enter</kbd>
                      </span>
                    )}
                    <button
                      type="submit"
                      className="btn ap-btn-step"
                      data-cursor={last ? "Send" : "Next"}
                      disabled={sending || (last && (!canSend || !token))}
                    >
                      <Roll>{label}</Roll>
                      {!sending && (
                        <ArrowRightIcon
                          size={16}
                          weight="bold"
                          className="arrow"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          <p className="ap-private ap-foot">
            <span>
              <strong>Your application is private.</strong> Only the FORGe team can read it.
            </span>
          </p>
        </main>
      </div>
    </div>
  );
}

/* ── Fields ──────────────────────────────────────────────────────────── */

type Ids = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

function ErrorText({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="ap-error">
      {children}
    </p>
  );
}

type Suggest = { value?: string; keepable: boolean; onUse: () => void };

function Field({
  name,
  label,
  hint,
  optional,
  error,
  suggest,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  /** A likely fix for what was typed, shown under the error. */
  suggest?: Suggest;
  children: (ids: Ids) => ReactNode;
}) {
  const id = `ap-${name}`;
  const described = [
    hint && `${id}-hint`,
    error && `${id}-error`,
    suggest?.value && `${id}-suggest`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="ap-field">
      <label htmlFor={id} className="ap-label">
        {label}
        {optional && <span className="ap-optional">optional</span>}
      </label>
      {children({
        id,
        "aria-describedby": described || undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && (
        <p id={`${id}-hint`} className="ap-hint">
          {hint}
        </p>
      )}
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
      {suggest?.value && <Suggestion id={`${id}-suggest`} {...suggest} value={suggest.value} />}
    </div>
  );
}

function TextField({
  name,
  label,
  hint,
  optional,
  error,
  value,
  onChange,
  onBlur,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
  narrow,
  suggest,
}: {
  name: string;
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  inputMode?: "text" | "email" | "tel" | "url" | "numeric";
  autoComplete?: string;
  placeholder?: string;
  narrow?: boolean;
  suggest?: Suggest;
}) {
  return (
    <Field
      name={name}
      label={label}
      hint={hint}
      optional={optional}
      error={error}
      suggest={suggest}
    >
      {(ids) => (
        <input
          {...ids}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete ?? "off"}
          placeholder={placeholder}
          className="ap-input"
          data-narrow={narrow || undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      )}
    </Field>
  );
}

function Written({
  name,
  label,
  hint,
  optional,
  limits,
  error,
  value,
  onChange,
  rows = 4,
}: {
  name: string;
  label: string;
  hint?: string;
  /** No minimum: any length up to the limit, or nothing. */
  optional?: boolean;
  limits: { min: number; max: number };
  error?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  const length = value.trim().length;
  const min = optional ? 0 : limits.min;
  const state = length === 0 ? "empty" : length < min ? "short" : "ok";
  const id = `ap-${name}`;
  return (
    <Field name={name} label={label} hint={hint} optional={optional} error={error}>
      {(ids) => (
        <>
          <textarea
            {...ids}
            aria-describedby={[ids["aria-describedby"], `${id}-count`].filter(Boolean).join(" ")}
            rows={rows}
            maxLength={limits.max}
            className="ap-input ap-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <p id={`${id}-count`} className="ap-counter" data-state={state}>
            {state === "short"
              ? `${min - length} more to go`
              : optional
                ? `Up to ${limits.max} characters`
                : `${limits.min} to ${limits.max} characters`}
            <span>
              {length} / {limits.max}
            </span>
          </p>
        </>
      )}
    </Field>
  );
}

function Group({
  name,
  label,
  hint,
  callout,
  optional,
  error,
  children,
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  /** Shows the hint as a block in the step's colour: something nobody should miss. */
  callout?: boolean;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const id = `ap-${name}`;
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
  return (
    <fieldset
      className="ap-field"
      aria-describedby={described || undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="ap-label">
        {label}
        {optional && <span className="ap-optional">optional</span>}
      </legend>
      {hint && (
        <p id={`${id}-hint`} className={callout ? "ap-callout" : "ap-hint ap-hint-top"}>
          {hint}
        </p>
      )}
      {children}
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
    </fieldset>
  );
}

/** One of a few, as blocks (a radio group). */
function Options({
  name,
  label,
  options,
  value,
  error,
  onChange,
}: {
  name: string;
  label: string;
  options: readonly Option[];
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Group name={name} label={label} error={error}>
      <div className="ap-options">
        {options.map((o, i) => {
          const on = value === o.value;
          return (
            <label key={o.value} className="ap-option" data-on={on || undefined} data-cursor="Pick">
              <input
                id={i === 0 ? `ap-${name}` : undefined}
                type="radio"
                name={name}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
              />
              <span className="ap-box" aria-hidden="true" />
              {o.label}
            </label>
          );
        })}
      </div>
    </Group>
  );
}

/** Smaller blocks: several at once, or one of many when `single`. */
type ChipGroup = { label?: string; options: readonly Option[] };

function Chips({
  name,
  label,
  hint,
  optional,
  single,
  options,
  groups,
  value,
  error,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  optional?: boolean;
  single?: boolean;
  options?: readonly Option[];
  /** Long lists, split under small headings (still one question). */
  groups?: readonly ChipGroup[];
  value: string[];
  error?: string;
  onChange: (value: string[]) => void;
}) {
  const first = (groups?.[0]?.options ?? options ?? [])[0]?.value;
  const chip = (o: Option) => {
    const on = value.includes(o.value);
    return (
      <label key={o.value} className="ap-chip" data-on={on || undefined} data-cursor="Pick">
        <input
          id={o.value === first ? `ap-${name}` : undefined}
          type={single ? "radio" : "checkbox"}
          name={name}
          value={o.value}
          checked={on}
          onChange={() => {
            if (single) onChange([o.value]);
            else onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value]);
          }}
        />
        <span className="ap-box" aria-hidden="true" />
        {o.label}
      </label>
    );
  };
  return (
    <Group name={name} label={label} hint={hint} optional={optional} error={error}>
      {groups ? (
        <div className="ap-chip-groups">
          {groups.map((g, i) => {
            const headingId = `ap-${name}-group-${i}`;
            return (
              <div
                key={g.label ?? i}
                className="ap-chips"
                role={g.label ? "group" : undefined}
                aria-labelledby={g.label ? headingId : undefined}
              >
                {g.label && (
                  <span id={headingId} className="ap-chip-heading">
                    {g.label}
                  </span>
                )}
                {g.options.map(chip)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ap-chips">{(options ?? []).map(chip)}</div>
      )}
    </Group>
  );
}

function Tick({
  name,
  checked,
  error,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  error?: string;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  const id = `ap-${name}`;
  return (
    <div className="ap-tick-wrap">
      <label className="ap-tick" data-on={checked || undefined} data-cursor="Agree">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="ap-box" aria-hidden="true" />
        <span>{children}</span>
      </label>
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
    </div>
  );
}

/** "Did you mean …?" under an email, with the fix one tap away. */
function Suggestion({
  id,
  value,
  keepable,
  onUse,
}: {
  id: string;
  value: string;
  /** The address as typed would work: say that Continue keeps it. */
  keepable: boolean;
  onUse: () => void;
}) {
  return (
    <p id={id} className="ap-suggest">
      <span>
        Did you mean <strong>{value}</strong>?
      </span>
      <button type="button" data-cursor="Fix" onClick={onUse}>
        Use this
      </button>
      {keepable && <span className="ap-suggest-keep">Or continue to keep yours.</span>}
    </p>
  );
}

/** The date of birth as three pickers, day first, so nobody types a date in the wrong order. */
function BirthDate({
  day,
  month,
  year,
  error,
  onChange,
}: {
  day: string;
  month: string;
  year: string;
  error?: string;
  onChange: (parts: Partial<Pick<Draft, "birthDay" | "birthMonth" | "birthYear">>) => void;
}) {
  const id = "ap-birthDate";
  const thisYear = new Date().getUTCFullYear();
  // Birth years for every age the form takes, youngest first (a 99-year-old may be born 100 years ago).
  const years = Array.from({ length: AGE.max - AGE.min + 2 }, (_, i) => thisYear - AGE.min - i);
  const days = daysIn(Number(month) || 1, Number(year) || undefined);
  const fits = (d: string, m: string, y: string) =>
    !d || Number(d) <= daysIn(Number(m) || 1, Number(y) || undefined);
  const invalid = error ? true : undefined;
  const described = error ? `${id}-error` : undefined;
  return (
    <Group name="birthDate" label="Date of birth" error={error}>
      <div className="ap-dob">
        <select
          id={id}
          className="ap-input ap-select"
          aria-label="Day"
          aria-invalid={invalid}
          aria-describedby={described}
          autoComplete="bday-day"
          data-empty={!day || undefined}
          data-cursor="Pick"
          value={day}
          onChange={(e) => onChange({ birthDay: e.target.value })}
        >
          <option value="">Day</option>
          {Array.from({ length: days }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {i + 1}
            </option>
          ))}
        </select>
        <select
          id={`${id}-month`}
          className="ap-input ap-select"
          aria-label="Month"
          aria-invalid={invalid}
          aria-describedby={described}
          autoComplete="bday-month"
          data-empty={!month || undefined}
          data-cursor="Pick"
          value={month}
          onChange={(e) => {
            const m = e.target.value;
            // A day the new month doesn't have (31 April) is cleared, to be picked again.
            onChange(fits(day, m, year) ? { birthMonth: m } : { birthMonth: m, birthDay: "" });
          }}
        >
          <option value="">Month</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={String(i + 1)}>
              {name}
            </option>
          ))}
        </select>
        <select
          id={`${id}-year`}
          className="ap-input ap-select"
          aria-label="Year"
          aria-invalid={invalid}
          aria-describedby={described}
          autoComplete="bday-year"
          data-empty={!year || undefined}
          data-cursor="Pick"
          value={year}
          onChange={(e) => {
            const y = e.target.value;
            onChange(fits(day, month, y) ? { birthYear: y } : { birthYear: y, birthDay: "" });
          }}
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </Group>
  );
}

function CvField({
  file,
  error,
  onChange,
}: {
  file: File | null;
  error?: string;
  onChange: (file: File | null) => void;
}) {
  const id = "ap-cv";
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const hintId = useId();
  return (
    <div className="ap-field">
      <span className="ap-label" id={`${id}-label`}>
        CV
      </span>
      {file ? (
        <div className="ap-file">
          <span className="ap-tag" aria-hidden="true">
            PDF
          </span>
          <span className="ap-file-text">
            <strong>{file.name}</strong>
            <span>{sizeLabel(file.size)}</span>
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label={`Remove ${file.name}`}
            data-cursor="Remove"
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <Roll>Remove</Roll>
          </button>
        </div>
      ) : (
        <label
          className="ap-drop"
          data-over={over || undefined}
          data-cursor="Upload"
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) onChange(dropped);
          }}
        >
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="application/pdf,.pdf"
            aria-labelledby={`${id}-label`}
            aria-describedby={[hintId, error && `${id}-error`].filter(Boolean).join(" ")}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
          <span className="ap-tag" aria-hidden="true">
            PDF
          </span>
          <span>
            <strong>Choose a PDF</strong>
            or drop it here
          </span>
        </label>
      )}
      <p id={hintId} className="ap-hint">
        PDF only, up to 5 MB. Export it as a plain PDF: files with scripts or attachments are
        refused.
      </p>
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
    </div>
  );
}

function Teammates({
  value,
  errors,
  suggestions,
  onChange,
  onCheck,
  onSuggestion,
}: {
  value: { name: string; email: string }[];
  errors: Errors;
  suggestions: Record<string, string>;
  onChange: (value: { name: string; email: string }[]) => void;
  onCheck: (key: string, value: string) => void;
  onSuggestion: (key: string) => void;
}) {
  const update = (i: number, patch: Partial<{ name: string; email: string }>) =>
    onChange(value.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <Group
      name="teammates"
      label="Teammates"
      callout
      hint={
        <>
          <strong>Each of them applies too, with the same team name.</strong> Up to {MAX_TEAMMATES},
          not counting you. We review your team together.
        </>
      }
      error={errors.teammates}
    >
      <div className="ap-mates">
        {value.map((m, i) => (
          <div key={i} className="ap-mate">
            <div className="ap-mate-head">
              <span>Teammate {pad(i + 1)}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`Remove teammate ${i + 1}`}
                data-cursor="Remove"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <Roll>Remove</Roll>
              </button>
            </div>
            <div className="ap-row">
              <TextField
                name={`teammates-${i}-name`}
                label="Name"
                value={m.name}
                error={errors[`teammates.${i}.name`]}
                onChange={(v) => update(i, { name: v })}
              />
              <TextField
                name={`teammates-${i}-email`}
                label="Email"
                type="email"
                inputMode="email"
                value={m.email}
                error={errors[`teammates.${i}.email`]}
                onChange={(v) => update(i, { email: v })}
                onBlur={() => onCheck(`teammates.${i}.email`, m.email)}
                suggest={{
                  value: suggestions[`teammates.${i}.email`],
                  keepable: !errors[`teammates.${i}.email`],
                  onUse: () => onSuggestion(`teammates.${i}.email`),
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {value.length < MAX_TEAMMATES && (
        <button
          type="button"
          className="btn btn-ghost btn-sm ap-add"
          data-cursor="Add"
          onClick={() => onChange([...value, { name: "", email: "" }])}
        >
          <Roll>Add a teammate</Roll>
        </button>
      )}
    </Group>
  );
}
