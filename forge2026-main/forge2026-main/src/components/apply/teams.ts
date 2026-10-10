import { MAX_TEAMMATES } from "@/lib/apply/fields";
import type { ReviewRow } from "@/routes/review.api.$";

/*
  Teams on the review page. Teammates apply one by one, so the page puts them
  back together: two applications are one team when either lists the other's
  email as a teammate, or when both give the same team name (compared without
  case, spaces, punctuation or accents; a placeholder like "Team" or "TBD"
  joins nobody).

  The grouping is worked out here from the list, never stored. Where it may be
  wrong it says so: a member joined only by the name, or a team bigger than a
  team can be (two teams that picked the same name), is flagged for the
  reviewer to check.
*/

export type Mate = { name: string; email: string };

export type Team = {
  /** Stable while the team exists: its first applicant's id. */
  key: string;
  /** The name most of its members gave. */
  name: string;
  /** Those who applied, first applicant first. */
  members: ReviewRow[];
  /** Listed by a member, but no application with that email yet. */
  missing: Mate[];
  /** Members linked to the team's core only by the team name, not by an email. */
  nameOnly: Set<string>;
  /** More people than one team can have: probably two teams with one name. */
  crowded: boolean;
};

const PLACEHOLDERS = new Set([
  "team",
  "myteam",
  "ourteam",
  "teamname",
  "tbd",
  "tba",
  "na",
  "none",
  "no",
  "notyet",
  "undecided",
  "unknown",
  "test",
  "hackathon",
  "forge",
  "forge2026",
  "group",
]);

/** The name as it's compared: "Byte Me", "byte-me" and "BYTE me!" are one team. */
export function teamKey(name: string): string {
  const key = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return key.length < 2 || PLACEHOLDERS.has(key) ? "" : key;
}

const mail = (s: string) => s.trim().toLowerCase();

/** Sets that merge: who ends up with whom. */
function sets() {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root) as string;
    parent.set(id, root);
    return root;
  };
  const join = (a: string, b: string) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent.set(rb, ra);
  };
  return { find, join };
}

export function groupTeams(rows: ReviewRow[]): Team[] {
  // Two layers: who is linked by an email (certain), and who by email or name (the team).
  const byMail = sets();
  const team = sets();

  const byEmail = new Map(rows.map((r) => [mail(r.email), r]));
  const inTeam = new Set<string>();

  for (const r of rows) {
    if (!r.has_team) continue;
    inTeam.add(r.id);
    for (const m of r.teammates) {
      const other = byEmail.get(mail(m.email));
      if (!other || other.id === r.id) continue;
      byMail.join(r.id, other.id);
      team.join(r.id, other.id);
      inTeam.add(other.id);
    }
  }

  const byName = new Map<string, string>();
  for (const r of rows) {
    if (!r.has_team) continue;
    const key = teamKey(r.team_name);
    if (!key) continue;
    const first = byName.get(key);
    if (first) team.join(first, r.id);
    else byName.set(key, r.id);
  }

  const groups = new Map<string, ReviewRow[]>();
  for (const r of rows) {
    if (!inTeam.has(r.id)) continue;
    const root = team.find(r.id);
    groups.set(root, [...(groups.get(root) ?? []), r]);
  }

  return [...groups.values()].map((group) => {
    const members = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const emails = new Set(members.map((m) => mail(m.email)));

    // The core is the biggest set of members linked by emails (on a tie, the
    // first applicant's). Anyone outside it joined by the name alone.
    const cores = new Map<string, number>();
    for (const m of members) {
      const root = byMail.find(m.id);
      cores.set(root, (cores.get(root) ?? 0) + 1);
    }
    let core = byMail.find(members[0].id);
    for (const [root, size] of cores) if (size > (cores.get(core) ?? 0)) core = root;

    const missing = new Map<string, Mate>();
    for (const m of members) {
      for (const mate of m.teammates) {
        const email = mail(mate.email);
        if (!emails.has(email) && !missing.has(email)) missing.set(email, mate);
      }
    }

    // The name most members gave; on a tie, the first applicant's.
    const votes = new Map<string, number>();
    for (const m of members) {
      if (m.team_name) votes.set(m.team_name, (votes.get(m.team_name) ?? 0) + 1);
    }
    let name = "";
    for (const m of members) {
      if (m.team_name && (votes.get(m.team_name) ?? 0) > (votes.get(name) ?? 0)) name = m.team_name;
    }

    return {
      key: members[0].id,
      name,
      members,
      missing: [...missing.values()],
      nameOnly: new Set(members.filter((m) => byMail.find(m.id) !== core).map((m) => m.id)),
      crowded: members.length + missing.size > MAX_TEAMMATES + 1,
    };
  });
}
