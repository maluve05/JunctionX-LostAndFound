import { z } from "zod";
import { emailProblem } from "./email";

/*
  The builder application: its questions, their options and their limits.

  Shared by the form (src/components/apply) and the server that stores it
  (src/routes/api.apply.ts), so the two can never disagree about what is
  valid. Option values are short stable codes (stored in the database and the
  exports); labels are what people read and can be reworded freely.
*/

export type Option = { value: string; label: string };

export const STATUSES = [
  { value: "student", label: "Student" },
  { value: "working", label: "Working" },
  { value: "founder", label: "Founder" },
  { value: "working-student", label: "Working student" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];

export const SKILLS = [
  { value: "web", label: "Web development" },
  { value: "data", label: "Data science" },
  { value: "ml", label: "Machine learning" },
  { value: "mobile", label: "Mobile development" },
  { value: "software", label: "Software engineering" },
  { value: "product", label: "Product design" },
  { value: "uiux", label: "UI/UX" },
  { value: "growth", label: "Growth & marketing" },
  { value: "business", label: "Business & strategy" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];

export const EXPERIENCE = [
  { value: "first", label: "First time" },
  { value: "participated", label: "I've taken part before" },
  { value: "organized", label: "I've organised one" },
] as const satisfies readonly Option[];

export const DIETARY = [
  { value: "none", label: "None" },
  { value: "lactose", label: "Lactose intolerant" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten", label: "Gluten intolerant" },
  { value: "halal", label: "Halal" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];

/** The kinds of place someone hears about FORGe, for the form's headings and the review page's totals. */
export const HEARD_GROUPS = [
  { value: "online", label: "Online" },
  { value: "inperson", label: "In person" },
  { value: "people", label: "People and partners" },
  { value: "other", label: "Somewhere else" },
] as const satisfies readonly Option[];

type HeardOption = Option & {
  group: (typeof HEARD_GROUPS)[number]["value"];
  /** For the review page's charts, where the full label is too long. */
  short: string;
};

/**
 * Every place someone might come across FORGe, so the team can see which
 * ones bring builders. The first five codes predate the rest and stay as they
 * are, because answers already stored use them.
 */
export const HEARD = [
  { value: "instagram", label: "Instagram", short: "Instagram", group: "online" },
  { value: "linkedin", label: "LinkedIn", short: "LinkedIn", group: "online" },
  { value: "tiktok", label: "TikTok", short: "TikTok", group: "online" },
  { value: "youtube", label: "YouTube", short: "YouTube", group: "online" },
  { value: "x", label: "X (Twitter)", short: "X", group: "online" },
  { value: "facebook", label: "Facebook", short: "Facebook", group: "online" },
  { value: "reddit", label: "Reddit", short: "Reddit", group: "online" },
  {
    value: "chat",
    label: "A WhatsApp, Discord or Telegram group",
    short: "Group chats",
    group: "online",
  },
  { value: "newsletter", label: "An email or newsletter", short: "Email", group: "online" },
  { value: "listing", label: "A hackathon listing site", short: "Listing sites", group: "online" },
  { value: "search", label: "A web search", short: "Search", group: "online" },
  { value: "press", label: "An article, blog or podcast", short: "Press", group: "online" },
  { value: "poster", label: "A poster or flyer", short: "Posters", group: "inperson" },
  {
    value: "university",
    label: "My university or a professor",
    short: "University",
    group: "inperson",
  },
  {
    value: "club",
    label: "A student club or association",
    short: "Student clubs",
    group: "inperson",
  },
  { value: "event", label: "An event, talk or meetup", short: "Events", group: "inperson" },
  { value: "friend", label: "A friend or colleague", short: "Friends", group: "people" },
  { value: "partner", label: "A partner company", short: "Partners", group: "people" },
  { value: "novae", label: "NOVAe", short: "NOVAe", group: "people" },
  { value: "websummit", label: "Web Summit", short: "Web Summit", group: "people" },
  { value: "returning", label: "I was at FORGe 2025", short: "FORGe 2025", group: "people" },
  { value: "other", label: "Somewhere else", short: "Other", group: "other" },
] as const satisfies readonly HeardOption[];

/** Statuses the team gives an application on the review page. */
export const REVIEW_STATUSES = [
  { value: "new", label: "New" },
  { value: "shortlist", label: "Shortlist" },
  { value: "accepted", label: "Accepted" },
  { value: "waitlist", label: "Waitlist" },
  { value: "declined", label: "Declined" },
] as const satisfies readonly Option[];

const values = <T extends readonly Option[]>(list: T) =>
  list.map((o) => o.value) as unknown as [T[number]["value"], ...T[number]["value"][]];

export function labelOf(list: readonly Option[], value: string | null | undefined) {
  return list.find((o) => o.value === value)?.label ?? value ?? "";
}

/** Character limits for the written answers, from the team's draft. */
export const LIMITS = {
  lastBuilt: { min: 100, max: 300 },
  hopes: { min: 50, max: 200 },
  whyYou: { min: 20, max: 100 },
} as const;

export const AGE = { min: 16, max: 99 } as const;
export const MAX_TEAMMATES = 4;
export const CV_MAX_BYTES = 5 * 1024 * 1024;

const STUDYING = new Set(["student", "working-student"]);
export const isStudying = (status: string) => STUDYING.has(status);

/** Someone on their first hackathon may not have built anything yet, so for them it's optional. */
export const lastBuiltOptional = (experience: string | undefined) => experience === "first";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Days in a month (1 to 12). February has 29 until the year says otherwise. */
export function daysIn(month: number, year?: number): number {
  if (month === 2)
    return year && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 28 : 29;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Age in whole years on a day, from a "YYYY-MM-DD" date of birth, or null if
 * that date doesn't exist. Counted in UTC, so the form and the server always
 * agree.
 */
export function ageOn(birthDate: string, on: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysIn(month, year)) return null;
  const [y, mo, d] = [on.getUTCFullYear(), on.getUTCMonth() + 1, on.getUTCDate()];
  return y - year - (mo < month || (mo === month && d < day) ? 1 : 0);
}

function birthDateProblem(birthDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const age = ageOn(birthDate, new Date());
  if (age === null) return "That date doesn't exist. Check the day.";
  if (age < AGE.min) return `You need to be at least ${AGE.min} to apply.`;
  if (age > AGE.max) return "Check the year.";
  return null;
}

/**
 * Characters that hide or disguise text: control characters (tabs and line
 * breaks are handled below), bidirectional overrides that can make a name or
 * file name read as something it isn't, and the byte order mark.
 */
// Matching control characters is the point of this pattern.
/* eslint-disable no-control-regex */
const HIDDEN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
/* eslint-enable no-control-regex */

export function cleanText(value: string, multiline = false): string {
  const s = value.normalize("NFC").replace(HIDDEN, "");
  const spaced = multiline
    ? s.replace(/\r\n?/g, "\n").replace(/\t/g, " ")
    : s.replace(/[\r\n\t]+/g, " ");
  return spaced.trim();
}

/** A one-line answer, cleaned, then measured. Pass a message to make it required. */
const text = (max: number, required?: string) =>
  z
    .string()
    .max(max * 4)
    .transform((v) => cleanText(v))
    .pipe(required ? z.string().min(1, required).max(max) : z.string().max(max));

/** An https URL. Bare domains are accepted and given the scheme. */
const url = z
  .string()
  .max(1200)
  .transform((v) => cleanText(v).slice(0, 300))
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
    } catch {
      return false;
    }
  }, "Enter a full link, like https://example.com");

const written = (min: number, max: number) =>
  z
    .string()
    .max(max * 4)
    .transform((v) => cleanText(v, true))
    .pipe(
      z
        .string()
        .min(min, `At least ${min} characters, please.`)
        .max(max, `${max} characters at most.`),
    );

/** A written answer with only a ceiling; whether it's needed is decided in crossChecks. */
const writtenUpTo = (max: number) =>
  z
    .string()
    .max(max * 4)
    .transform((v) => cleanText(v, true))
    .pipe(z.string().max(max, `${max} characters at most.`));

/** An address, refused when it can't work (an ending like ".con"). */
const email = (message: string) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .email(message)
    .superRefine((v, ctx) => {
      const problem = emailProblem(v);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    });

export const baseSchema = z.object({
  // Who you are
  firstName: text(60, "Enter your first name."),
  lastName: text(60, "Enter your last name."),
  email: email("Enter a valid email address."),
  phoneCode: z.string().regex(/^\+\d{1,4}$/, "Pick a country code."),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s().-]/g, ""))
    .refine((v) => /^\d{5,15}$/.test(v), "Enter your number without the country code."),
  linkedin: url.refine((v) => {
    try {
      return /(^|\.)linkedin\.com$/i.test(new URL(v).hostname);
    } catch {
      return false;
    }
  }, "Enter your LinkedIn profile link."),
  status: z.enum(values(STATUSES), { message: "Pick the one that fits best." }),
  statusOther: text(80),
  university: text(120),
  course: text(120),
  birthDate: z
    .string({ message: "Pick your date of birth." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick your date of birth.")
    .superRefine((v, ctx) => {
      const problem = birthDateProblem(v);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    }),
  portfolio: url,

  // Skills and profile
  skills: z
    .array(z.enum(values(SKILLS)))
    .min(1, "Pick at least one.")
    .max(SKILLS.length),
  skillsOther: text(80),
  lastBuilt: writtenUpTo(LIMITS.lastBuilt.max),
  experience: z.enum(values(EXPERIENCE), { message: "Pick one." }),
  hasTeam: z.enum(["no", "yes"], { message: "Pick one." }),
  teamName: text(60),
  teammates: z
    .array(
      z.object({
        name: text(120),
        email: z.string().trim().toLowerCase().max(254),
      }),
    )
    .max(MAX_TEAMMATES),

  // Motivation
  hopes: written(LIMITS.hopes.min, LIMITS.hopes.max),
  whyYou: written(LIMITS.whyYou.min, LIMITS.whyYou.max),

  // Logistics
  dietary: z.array(z.enum(values(DIETARY))).max(DIETARY.length),
  dietaryOther: text(120),
  heard: z.enum(values(HEARD), { message: "Pick one." }),
  heardOther: text(80),
  consentComms: z.literal(true, { message: "Tick this to apply." }),
  consentMedia: z.literal(true, { message: "Tick this to apply." }),
});

type Draft = z.input<typeof baseSchema>;

/**
 * The checks that depend on other answers (follow-up questions, teammates).
 * A plain function rather than a zod refinement: zod skips refinements while
 * any field is invalid, and the form validates one step at a time, when the
 * later steps are still empty.
 */
export function crossChecks(a: Draft): Errors {
  const out: Errors = {};
  const need = (when: boolean, path: string, message: string, value: string | undefined) => {
    if (when && !value?.trim()) out[path] ??= message;
  };
  const skills = a.skills ?? [];
  const dietary = a.dietary ?? [];
  need(a.status === "other", "statusOther", "Tell us what you do.", a.statusOther);
  need(isStudying(a.status ?? ""), "university", "Enter your university.", a.university);
  need(isStudying(a.status ?? ""), "course", "Enter your course.", a.course);
  need(skills.includes("other"), "skillsOther", "Tell us the skill.", a.skillsOther);
  need(dietary.includes("other"), "dietaryOther", "Tell us what to plan for.", a.dietaryOther);
  need(a.heard === "other", "heardOther", "Tell us where.", a.heardOther);
  need(a.hasTeam === "yes", "teamName", "Enter your team's name.", a.teamName);

  if (!lastBuiltOptional(a.experience)) {
    const length = cleanText(a.lastBuilt ?? "", true).length;
    const { min } = LIMITS.lastBuilt;
    if (length === 0) out.lastBuilt ??= "Tell us about the last thing you built.";
    else if (length < min) out.lastBuilt ??= `At least ${min} characters, please.`;
  }

  if (a.hasTeam === "yes") {
    const mates = a.teammates ?? [];
    if (mates.length === 0) out.teammates = "Add at least one teammate.";
    const own = a.email?.trim().toLowerCase();
    mates.forEach((m, i) => {
      const email = m.email?.trim().toLowerCase() ?? "";
      const problem = emailProblem(email);
      if (!m.name?.trim()) out[`teammates.${i}.name`] = "Enter a name.";
      if (!z.string().email().safeParse(email).success) {
        out[`teammates.${i}.email`] = "Enter a valid email.";
      } else if (problem) {
        out[`teammates.${i}.email`] = problem;
      } else if (email === own) {
        out[`teammates.${i}.email`] = "That's your own email.";
      }
    });
  }
  if (dietary.includes("none") && dietary.length > 1) {
    out.dietary = "Pick None, or the ones that apply.";
  }
  return out;
}

/** Every error in a draft, keyed by field path ("email", "teammates.0.email"). */
export function validate(draft: Record<string, unknown>): Errors {
  const parsed = baseSchema.safeParse(draft);
  return {
    ...crossChecks(draft as unknown as Draft),
    ...(parsed.success ? {} : collectErrors(parsed.error)),
  };
}

export const applicationSchema = baseSchema
  .superRefine((a, ctx) => {
    for (const [path, message] of Object.entries(crossChecks(a))) {
      ctx.addIssue({ code: "custom", path: path.split("."), message });
    }
  })
  .transform((a) => ({
    ...a,
    // Answers to questions that were hidden are dropped, not stored.
    statusOther: a.status === "other" ? a.statusOther : "",
    university: isStudying(a.status) ? a.university : "",
    course: isStudying(a.status) ? a.course : "",
    skillsOther: a.skills.includes("other") ? a.skillsOther : "",
    dietaryOther: a.dietary.includes("other") ? a.dietaryOther : "",
    heardOther: a.heard === "other" ? a.heardOther : "",
    teamName: a.hasTeam === "yes" ? a.teamName : "",
    teammates: a.hasTeam === "yes" ? a.teammates : [],
  }));

export type Application = z.output<typeof applicationSchema>;
export type ApplicationDraft = Draft;

/** Errors keyed by field path ("email", "teammates.0.email"). */
export type Errors = Record<string, string>;

export function collectErrors(error: z.ZodError): Errors {
  const out: Errors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
