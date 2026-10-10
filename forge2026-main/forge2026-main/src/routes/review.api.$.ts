import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  DIETARY,
  EXPERIENCE,
  HEARD,
  labelOf,
  MAX_TEAMMATES,
  REVIEW_STATUSES,
  SKILLS,
  STATUSES,
} from "@/lib/apply/fields";
import { reviewer, type Reviewer } from "@/lib/apply/access.server";
import { bindings, json } from "@/lib/apply/env.server";
import {
  deleteApplication,
  ensureSchema,
  getApplication,
  listActivity,
  listApplications,
  logAction,
  reviewApplication,
  reviewTeam,
  sourceCounts,
  type Row,
} from "@/lib/apply/store.server";
import { isSameOriginStrict, overLimit } from "@/lib/security";

/*
  The review page's API, all under /review so one Cloudflare Access app
  covers the page and its data. Every call checks the Access token and the
  reviewer list itself (access.server.ts), and every read of personal data
  is written to the audit log.

    GET  /review/api/me            who is signed in
    GET  /review/api/list          every application, newest first
    GET  /review/api/sources       how people heard about FORGe: counts only, so the
                                   page refreshes it live without an audit entry each time
    GET  /review/api/cv/<id>       that applicant's CV, as a download
    POST /review/api/review        { id, status, rating, notes }
    POST /review/api/team          { ids, status }: one status for a whole team
    GET  /review/api/export.csv    everything, for Excel or Google Sheets (admins)
    POST /review/api/delete        { id, confirm: "DELETE" } (admins)
    GET  /review/api/activity      the audit log (admins)
*/

const reviewInput = z.object({
  id: z.string().uuid(),
  status: z.enum(REVIEW_STATUSES.map((s) => s.value) as [string, ...string[]]),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().max(4000),
});

/** A team on the page can be joined by its name too, so it may hold a few more than one team's worth. */
const teamInput = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1)
    .max((MAX_TEAMMATES + 1) * 3)
    .transform((ids) => [...new Set(ids)]),
  status: z.enum(REVIEW_STATUSES.map((s) => s.value) as [string, ...string[]]),
});

const deleteInput = z.object({ id: z.string().uuid(), confirm: z.literal("DELETE") });

const PER_REVIEWER = { limit: 240, windowMs: 60_000 };

const parseList = (text: string): unknown[] => {
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

/** Answers kept in `extra`: today only the date of birth. */
function birthDateOf(extra: string): string {
  try {
    const v = JSON.parse(extra) as { birthDate?: unknown };
    return typeof v?.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.birthDate)
      ? v.birthDate
      : "";
  } catch {
    return "";
  }
}

/** Only web links become links; anything else an applicant typed is dropped. */
function safeLink(value: string): string {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}

/** A row as the page reads it: lists parsed, flags as booleans, links checked, storage keys kept back. */
function present(row: Row) {
  const { cv_key: _key, extra: _extra, ...rest } = row;
  return {
    ...rest,
    birth_date: birthDateOf(row.extra),
    linkedin: safeLink(row.linkedin),
    portfolio: safeLink(row.portfolio),
    skills: parseList(row.skills) as string[],
    dietary: parseList(row.dietary) as string[],
    teammates: parseList(row.teammates) as { name: string; email: string }[],
    has_team: row.has_team === 1,
    consent_comms: row.consent_comms === 1,
    consent_media: row.consent_media === 1,
  };
}

export type ReviewRow = ReturnType<typeof present>;

/* ── CSV ─────────────────────────────────────────────────────────────── */

const listOf = (r: Row, key: "skills" | "dietary") => parseList(r[key]) as string[];

const COLUMNS: [string, (r: Row) => string | number | null][] = [
  ["Submitted", (r) => r.created_at],
  ["First name", (r) => r.first_name],
  ["Last name", (r) => r.last_name],
  ["Email", (r) => r.email],
  // "(+351) 912345678": a cell starting with + would read as a formula.
  ["Phone", (r) => r.phone.replace(/^(\+\d+)\s/, "($1) ")],
  ["LinkedIn", (r) => r.linkedin],
  ["GitHub or portfolio", (r) => r.portfolio],
  ["Status", (r) => (r.status === "other" ? r.status_other : labelOf(STATUSES, r.status))],
  ["University", (r) => r.university],
  ["Course", (r) => r.course],
  ["Age", (r) => r.age],
  ["Date of birth", (r) => birthDateOf(r.extra)],
  [
    "Skills",
    (r) =>
      listOf(r, "skills")
        .map((s) => (s === "other" ? r.skills_other : labelOf(SKILLS, s)))
        .join("; "),
  ],
  ["Last thing built", (r) => r.last_built],
  ["Hackathon experience", (r) => labelOf(EXPERIENCE, r.experience)],
  ["Has a team", (r) => (r.has_team ? "Yes" : "No")],
  ["Team name", (r) => r.team_name],
  [
    "Teammates",
    (r) =>
      (parseList(r.teammates) as { name: string; email: string }[])
        .map((m) => `${m.name} <${m.email}>`)
        .join("; "),
  ],
  ["Hopes to get", (r) => r.hopes],
  ["Why pick them", (r) => r.why_you],
  [
    "Dietary",
    (r) =>
      listOf(r, "dietary")
        .map((d) => (d === "other" ? r.dietary_other : labelOf(DIETARY, d)))
        .join("; "),
  ],
  ["Heard via", (r) => (r.heard === "other" ? r.heard_other : labelOf(HEARD, r.heard))],
  ["Consent: emails", (r) => (r.consent_comms ? "Yes" : "No")],
  ["Consent: photo and video", (r) => (r.consent_media ? "Yes" : "No")],
  ["CV file", (r) => r.cv_name],
  ["Review status", (r) => labelOf(REVIEW_STATUSES, r.review_status)],
  ["Rating", (r) => r.review_rating],
  ["Review notes", (r) => r.review_notes],
  ["Reviewed by", (r) => r.reviewed_by],
  ["Reviewed at", (r) => r.reviewed_at],
  ["Application id", (r) => r.id],
];

/**
 * One CSV cell. Applicants write these answers, and a spreadsheet runs a cell
 * that starts with = + - @ as a formula, so those are prefixed with a quote
 * mark (the OWASP fix for CSV injection).
 */
function cell(value: string | number | null): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Row[]): string {
  const lines = [COLUMNS.map(([name]) => cell(name)).join(",")];
  for (const row of rows) lines.push(COLUMNS.map(([, get]) => cell(get(row))).join(","));
  // The byte order mark tells Excel the file is UTF-8 (names like "João").
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** `attachment` with a plain-ASCII name and the real one (RFC 6266), so no name can break the header. */
function attachment(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/* ── Handlers ────────────────────────────────────────────────────────── */

async function handle(request: Request, splat: string): Promise<Response> {
  // Nothing here answers another site's page, even a link someone clicked.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return json({ ok: false, error: "Not available." }, 403);
  }

  const me: Reviewer | null = await reviewer(request);
  if (!me) return json({ ok: false, error: "Sign in with your team account." }, 401);

  const { db, files, reviewLimiter } = await bindings();
  if (await overLimit(reviewLimiter, `review:${me.email}`, PER_REVIEWER)) {
    return json({ ok: false, error: "Too many requests. Wait a moment and try again." }, 429);
  }

  if (request.method === "POST" && !isSameOriginStrict(request)) {
    return json({ ok: false, error: "Not available." }, 403);
  }
  const adminOnly = () => json({ ok: false, error: "Only admins can do that." }, 403);

  if (request.method === "GET" && splat === "me") {
    return json({ ok: true, email: me.email, admin: me.admin });
  }

  if (!db || !files) return json({ ok: false, error: "Storage is not set up." }, 503);
  await ensureSchema(db);

  if (request.method === "GET" && splat === "sources") {
    const since = new URL(request.url).searchParams.get("since") ?? "";
    const stats = await sourceCounts(db, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(since) ? since : "");
    return json({ ok: true, at: new Date().toISOString(), ...stats });
  }

  if (request.method === "GET" && splat === "list") {
    await logAction(db, me.email, "list");
    const rows = await listApplications(db);
    return json({ ok: true, email: me.email, admin: me.admin, applications: rows.map(present) });
  }

  const cv = splat.match(/^cv\/([0-9a-f-]{36})$/);
  if (request.method === "GET" && cv) {
    const row = await getApplication(db, cv[1]);
    const object = row ? await files.get(row.cv_key) : null;
    if (!row || !object) return json({ ok: false, error: "Not found." }, 404);
    await logAction(db, me.email, "cv", row.id);
    return new Response(object.body, {
      headers: {
        "Content-Type": "application/pdf",
        // Downloaded, never shown on this site: a file from a stranger must
        // not run anything on the page that holds everyone's data.
        "Content-Disposition": attachment(`${row.first_name} ${row.last_name} CV.pdf`),
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (request.method === "POST" && splat === "review") {
    const parsed = reviewInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ ok: false, error: "That review didn't make sense." }, 400);
    const { id, ...review } = parsed.data;
    const saved = await reviewApplication(db, id, review, me.email);
    if (!saved) return json({ ok: false, error: "Not found." }, 404);
    await logAction(db, me.email, "review", id, `${review.status} ${review.rating ?? "-"}`);
    const row = await getApplication(db, id);
    return json({ ok: true, application: row && present(row) });
  }

  if (request.method === "POST" && splat === "team") {
    const parsed = teamInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ ok: false, error: "That decision didn't make sense." }, 400);
    const rows = await reviewTeam(db, parsed.data.ids, parsed.data.status, me.email);
    if (rows.length === 0) return json({ ok: false, error: "Not found." }, 404);
    return json({ ok: true, applications: rows.map(present) });
  }

  if (request.method === "GET" && splat === "export.csv") {
    if (!me.admin) return adminOnly();
    const rows = await listApplications(db);
    await logAction(db, me.email, "export", "", `${rows.length} applications`);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": attachment(`forge-2026-applications-${day}.csv`),
        "Cache-Control": "no-store",
      },
    });
  }

  if (request.method === "POST" && splat === "delete") {
    if (!me.admin) return adminOnly();
    const parsed = deleteInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ ok: false, error: "Confirm the delete first." }, 400);
    const key = await deleteApplication(db, parsed.data.id);
    if (!key) return json({ ok: false, error: "Not found." }, 404);
    await files.delete(key).catch((error) => {
      console.error("[review] CV left behind after delete:", error);
    });
    await logAction(db, me.email, "delete", parsed.data.id);
    return json({ ok: true });
  }

  if (request.method === "GET" && splat === "activity") {
    if (!me.admin) return adminOnly();
    await logAction(db, me.email, "activity");
    return json({ ok: true, activity: await listActivity(db) });
  }

  return json({ ok: false, error: "Not found." }, 404);
}

export const Route = createFileRoute("/review/api/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => handle(request, params._splat ?? ""),
      POST: ({ request, params }) => handle(request, params._splat ?? ""),
    },
  },
});
