import { TLDS } from "./tlds";

/*
  Mistyped email addresses, caught before they cost an applicant our reply.

  - emailProblem: the address can't work, because no address ends that way
    (".con", ".cmo"). The form and the server both refuse it.
  - emailSuggestion: the likely fix, for the form to offer in one tap. It
    also covers slips that are still valid addresses ("gmial.com"), which
    are never refused: a suggestion, not a rule.
*/

/** Where most applicants' mail lives. A domain a keystroke or two away from one of these is probably a slip. */
const PROVIDERS = [
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "outlook.pt",
  "live.com",
  "live.com.pt",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "email.com",
  "sapo.pt",
  "zoho.com",
];

/** Endings offered as the fix for one that doesn't exist, most likely first. */
const COMMON_ENDINGS = ["com", "net", "org", "pt", "edu", "eu", "io", "co", "uk", "de", "fr", "es"];

/** Edits between two short strings, counting a swap of neighbours as one (so "gmial" is one from "gmail"). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function split(email: string): { local: string; domain: string; ending: string } | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  const dot = domain.lastIndexOf(".");
  if (dot < 1 || dot === domain.length - 1) return null;
  return { local: email.slice(0, at).trim(), domain, ending: domain.slice(dot + 1) };
}

/** Why this address can't work, or null. Only judges addresses that are otherwise well formed. */
export function emailProblem(email: string): string | null {
  const parts = split(email);
  if (!parts || !/^[a-z]{2,24}$/.test(parts.ending) || TLDS.has(parts.ending)) return null;
  return `No email address ends in .${parts.ending}. Check for a typo.`;
}

/** The address the applicant probably meant, or null when it looks right. */
export function emailSuggestion(email: string): string | null {
  const parts = split(email);
  if (!parts || !parts.local || PROVIDERS.includes(parts.domain)) return null;
  const { local, domain, ending } = parts;

  let provider: string | null = null;
  let best = Infinity;
  for (const p of PROVIDERS) {
    // Short names sit close to many real domains, so they need a closer match.
    const limit = p.length >= 9 ? 2 : 1;
    const d = distance(domain, p);
    if (d <= limit && d < best) {
      provider = p;
      best = d;
    }
  }
  if (provider) return `${local}@${provider}`;

  if (!TLDS.has(ending)) {
    let fix: string | null = null;
    let closest = 3;
    for (const e of COMMON_ENDINGS) {
      const d = distance(ending, e);
      if (d < closest) {
        fix = e;
        closest = d;
      }
    }
    if (fix) return `${local}@${domain.slice(0, domain.length - ending.length)}${fix}`;
  }
  return null;
}
