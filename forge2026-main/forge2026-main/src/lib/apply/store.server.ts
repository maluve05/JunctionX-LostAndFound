import { ageOn, type Application } from "./fields";
import type { D1 } from "./env.server";

/*
  Where applications live: one row per applicant in D1, and the CV in R2
  under `cv/<id>.pdf`.

  Answers are columns rather than one JSON blob, so the team (or a quick
  `wrangler d1 execute` query) can sort and filter them, and the CSV export
  is a straight copy. Lists (skills, dietary needs, teammates) are JSON text.
  `extra` holds answers to questions added later (the challenge section, say)
  until they earn a column of their own: today the date of birth
  (`birthDate`, "YYYY-MM-DD"). `age` is worked out from it when they apply,
  so the list still sorts and exports by age.

  `audit_log` records what the team does with the data: who read the list,
  downloaded a CV, saved a review, exported everything or deleted an
  application, and when. Admins can read it on the review page. Nothing about
  applicants goes in it beyond the application id.
*/

const SCHEMA = `
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  linkedin TEXT NOT NULL,
  portfolio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  status_other TEXT NOT NULL DEFAULT '',
  university TEXT NOT NULL DEFAULT '',
  course TEXT NOT NULL DEFAULT '',
  age INTEGER NOT NULL,
  skills TEXT NOT NULL,
  skills_other TEXT NOT NULL DEFAULT '',
  last_built TEXT NOT NULL,
  experience TEXT NOT NULL,
  has_team INTEGER NOT NULL,
  team_name TEXT NOT NULL DEFAULT '',
  teammates TEXT NOT NULL DEFAULT '[]',
  hopes TEXT NOT NULL,
  why_you TEXT NOT NULL,
  dietary TEXT NOT NULL DEFAULT '[]',
  dietary_other TEXT NOT NULL DEFAULT '',
  heard TEXT NOT NULL,
  heard_other TEXT NOT NULL DEFAULT '',
  consent_comms INTEGER NOT NULL,
  consent_media INTEGER NOT NULL,
  cv_key TEXT NOT NULL,
  cv_name TEXT NOT NULL,
  cv_size INTEGER NOT NULL,
  extra TEXT NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'new',
  review_rating INTEGER,
  review_notes TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS applications_created ON applications (created_at);
CREATE INDEX IF NOT EXISTS applications_team ON applications (team_name);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS audit_log_at ON audit_log (at);
`;

/** Once per isolate: creating the tables is idempotent, so a cold start just checks. */
let ready: Promise<void> | null = null;

export function ensureSchema(db: D1): Promise<void> {
  ready ??= (async () => {
    const statements = SCHEMA.split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => db.prepare(s));
    await db.batch(statements);
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

export type Row = {
  id: string;
  created_at: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  linkedin: string;
  portfolio: string;
  status: string;
  status_other: string;
  university: string;
  course: string;
  age: number;
  skills: string;
  skills_other: string;
  last_built: string;
  experience: string;
  has_team: number;
  team_name: string;
  teammates: string;
  hopes: string;
  why_you: string;
  dietary: string;
  dietary_other: string;
  heard: string;
  heard_other: string;
  consent_comms: number;
  consent_media: number;
  cv_key: string;
  cv_name: string;
  cv_size: number;
  extra: string;
  review_status: string;
  review_rating: number | null;
  review_notes: string;
  reviewed_by: string;
  reviewed_at: string | null;
};

export async function emailTaken(db: D1, email: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS hit FROM applications WHERE email = ?")
    .bind(email)
    .first();
  return row !== null;
}

export async function insertApplication(
  db: D1,
  id: string,
  a: Application,
  cv: { key: string; name: string; size: number },
) {
  const row: Omit<
    Row,
    "review_status" | "review_rating" | "review_notes" | "reviewed_by" | "reviewed_at"
  > = {
    id,
    created_at: new Date().toISOString(),
    email: a.email,
    first_name: a.firstName,
    last_name: a.lastName,
    phone: `${a.phoneCode} ${a.phone}`,
    linkedin: a.linkedin,
    portfolio: a.portfolio,
    status: a.status,
    status_other: a.statusOther,
    university: a.university,
    course: a.course,
    age: ageOn(a.birthDate, new Date()) ?? 0,
    skills: JSON.stringify(a.skills),
    skills_other: a.skillsOther,
    last_built: a.lastBuilt,
    experience: a.experience,
    has_team: a.hasTeam === "yes" ? 1 : 0,
    team_name: a.teamName,
    teammates: JSON.stringify(a.teammates),
    hopes: a.hopes,
    why_you: a.whyYou,
    dietary: JSON.stringify(a.dietary),
    dietary_other: a.dietaryOther,
    heard: a.heard,
    heard_other: a.heardOther,
    consent_comms: a.consentComms ? 1 : 0,
    consent_media: a.consentMedia ? 1 : 0,
    cv_key: cv.key,
    cv_name: cv.name,
    cv_size: cv.size,
    extra: JSON.stringify({ birthDate: a.birthDate }),
  };
  const columns = Object.keys(row);
  await db
    .prepare(
      `INSERT INTO applications (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    )
    .bind(...Object.values(row))
    .run();
}

export async function listApplications(db: D1): Promise<Row[]> {
  const { results } = await db
    .prepare("SELECT * FROM applications ORDER BY created_at DESC")
    .all<Row>();
  return results;
}

export async function getApplication(db: D1, id: string): Promise<Row | null> {
  return db.prepare("SELECT * FROM applications WHERE id = ?").bind(id).first<Row>();
}

export async function reviewApplication(
  db: D1,
  id: string,
  review: { status: string; rating: number | null; notes: string },
  by: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE applications
         SET review_status = ?, review_rating = ?, review_notes = ?, reviewed_by = ?, reviewed_at = ?
       WHERE id = ?`,
    )
    .bind(review.status, review.rating, review.notes, by, new Date().toISOString(), id)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/**
 * One decision for a whole team: the status changes for each of them, while
 * every score and note stays as it was. The changes and their audit entries
 * are one batch, so either all of them land or none. Returns the updated rows.
 */
export async function reviewTeam(
  db: D1,
  ids: string[],
  status: string,
  by: string,
): Promise<Row[]> {
  const marks = ids.map(() => "?").join(", ");
  const { results: found } = await db
    .prepare(`SELECT id FROM applications WHERE id IN (${marks})`)
    .bind(...ids)
    .all<{ id: string }>();
  if (found.length === 0) return [];
  const at = new Date().toISOString();
  await db.batch([
    ...found.map(({ id }) =>
      db
        .prepare(
          "UPDATE applications SET review_status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?",
        )
        .bind(status, by, at, id),
    ),
    ...found.map(({ id }) =>
      db
        .prepare("INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)")
        .bind(at, by, "review", id, `${status} (whole team)`),
    ),
  ]);
  const { results } = await db
    .prepare(`SELECT * FROM applications WHERE id IN (${found.map(() => "?").join(", ")})`)
    .bind(...found.map((f) => f.id))
    .all<Row>();
  return results;
}

export type SourceCount = { day: string; heard: string; status: string; n: number };

/**
 * How people heard about FORGe, as counts per day (UTC), answer and review
 * status: nothing about anyone in particular, so the review page can refresh
 * it every few seconds without an audit entry each time. `newer` counts the
 * applications sent after `since` (the newest one the page has loaded).
 */
export async function sourceCounts(
  db: D1,
  since: string,
): Promise<{ total: number; newer: number; counts: SourceCount[] }> {
  const [totals, rows] = await db.batch([
    db
      .prepare(
        "SELECT COUNT(*) AS total, COALESCE(SUM(created_at > ?), 0) AS newer FROM applications",
      )
      .bind(since),
    db.prepare(
      `SELECT substr(created_at, 1, 10) AS day, heard, review_status AS status, COUNT(*) AS n
         FROM applications GROUP BY day, heard, review_status ORDER BY day`,
    ),
  ]);
  const first = (totals as { results?: { total: number; newer: number }[] }).results?.[0];
  return {
    total: first?.total ?? 0,
    newer: first?.newer ?? 0,
    counts: (rows as { results?: SourceCount[] }).results ?? [],
  };
}

/** Removes an application's row; returns its CV's key so the caller can delete the file. */
export async function deleteApplication(db: D1, id: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT cv_key FROM applications WHERE id = ?")
    .bind(id)
    .first<{ cv_key: string }>();
  if (!row) return null;
  await db.prepare("DELETE FROM applications WHERE id = ?").bind(id).run();
  return row.cv_key;
}

export type AuditAction = "list" | "cv" | "review" | "export" | "delete" | "activity";

export async function logAction(
  db: D1,
  actor: string,
  action: AuditAction,
  target = "",
  detail = "",
) {
  await db
    .prepare("INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)")
    .bind(new Date().toISOString(), actor, action, target, detail.slice(0, 200))
    .run();
}

export type AuditRow = {
  id: number;
  at: string;
  actor: string;
  action: AuditAction;
  target: string;
  detail: string;
};

export async function listActivity(db: D1, limit = 300): Promise<AuditRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?")
    .bind(limit)
    .all<AuditRow>();
  return results;
}
