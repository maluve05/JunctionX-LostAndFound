import { createFileRoute } from "@tanstack/react-router";
import { applicationSchema, cleanText, collectErrors, CV_MAX_BYTES } from "@/lib/apply/fields";
import { applicationsOpen, bindings, json, onSiteHost } from "@/lib/apply/env.server";
import { inspectPdf, pdfProblem } from "@/lib/apply/pdf.server";
import { emailTaken, ensureSchema, insertApplication } from "@/lib/apply/store.server";
import { turnstileSiteKey, verifyTurnstile } from "@/lib/apply/turnstile.server";
import { clientKey, isSameOriginStrict, overLimit, rateLimit } from "@/lib/security";

/*
  POST /api/apply: one builder application, as multipart form data: the
  answers as JSON in `data`, the CV (a PDF) in `cv`, and the Turnstile token
  in `turnstile`.

  In order, each step refusing before the next costs anything:
  1. Only this site's own pages, on its real hostname, may send.
  2. Applications must be open, and storage and Turnstile set up.
  3. Rate limits, per address and overall.
  4. At most the CV's size plus a little is ever read, however the body is sent.
  5. Every answer is checked against the same schema the form uses (before
     Turnstile, so a typo doesn't burn the applicant's one-use token).
  6. Turnstile must confirm a person sent it, from this form.
  7. The CV must be a real PDF without scripts, attachments or risky links.
  8. One application per email. A repeat gets the same reply as a first
     application, so nobody can use this form to learn who has applied.
*/

/** A classroom applying together shares one address, so this stays generous; Turnstile stops scripts. */
const PER_CLIENT = { limit: 30, windowMs: 10 * 60_000 };
const GLOBAL = { limit: 120, windowMs: 60_000 };

/** The CV plus generous room for the answers and the token. */
const MAX_BODY = CV_MAX_BYTES + 96 * 1024;

const UNAVAILABLE = "Applications are unavailable right now. Please try again later.";
const UNREADABLE = "We couldn't read that. Please try again.";

/** The body, or null once it passes `max` bytes: never buffered beyond the limit. */
async function readBody(request: Request, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!request.body) return new Uint8Array(new ArrayBuffer(0));
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(new ArrayBuffer(size));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

async function handle(request: Request): Promise<Response> {
  if (!isSameOriginStrict(request) || !onSiteHost(request)) {
    return json({ ok: false, error: "Not available." }, 403);
  }
  if (!applicationsOpen()) {
    return json({ ok: false, error: "Applications aren't open yet." }, 403);
  }

  const { db, files, applyLimiter } = await bindings();
  if (!db || !files || !turnstileSiteKey()) {
    console.error("[apply] Storage or Turnstile is not configured; refusing applications.");
    return json({ ok: false, error: UNAVAILABLE }, 503);
  }

  const who = clientKey(request);
  if (
    (await overLimit(applyLimiter, `apply:${who}`, PER_CLIENT)) ||
    !rateLimit("apply:global", GLOBAL).ok
  ) {
    return json({ ok: false, error: "Too many attempts. Please try again in a few minutes." }, 429);
  }

  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data")) {
    return json({ ok: false, error: UNREADABLE }, 415);
  }
  const body = await readBody(request, MAX_BODY);
  if (!body) {
    return json({ ok: false, error: "Your CV is over 5 MB. Please send a smaller PDF." }, 413);
  }

  let form: FormData;
  try {
    form = await new Response(body, { headers: { "content-type": type } }).formData();
  } catch {
    return json({ ok: false, error: UNREADABLE }, 400);
  }

  const raw = form.get("data");
  const cv = form.get("cv");
  if (typeof raw !== "string" || raw.length > 32_000) {
    return json({ ok: false, error: UNREADABLE }, 400);
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: UNREADABLE }, 400);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json({ ok: false, error: UNREADABLE }, 400);
  }

  // The honeypot: a field people never see. Answer as a success would, so a
  // bot learns nothing.
  if (typeof data.website === "string" && data.website) return json({ ok: true });

  const parsed = applicationSchema.safeParse(data);
  if (!parsed.success) {
    return json(
      { ok: false, error: "Some answers need another look.", fields: collectErrors(parsed.error) },
      422,
    );
  }
  const application = parsed.data;

  if (!(cv instanceof File) || cv.size === 0) {
    return json({ ok: false, error: "Add your CV.", fields: { cv: "Add your CV as a PDF." } }, 422);
  }
  if (cv.size > CV_MAX_BYTES) {
    return json(
      { ok: false, error: "Your CV is over 5 MB.", fields: { cv: "Use a PDF under 5 MB." } },
      422,
    );
  }
  if (!(await verifyTurnstile(form.get("turnstile"), who === "unknown" ? null : who))) {
    return json(
      {
        ok: false,
        error: "We couldn't confirm the check at the bottom. Please do it again, then send.",
        retry: "turnstile",
      },
      403,
    );
  }

  const bytes = new Uint8Array(await cv.arrayBuffer());
  const verdict = inspectPdf(bytes);
  if (!verdict.ok) {
    const message = pdfProblem(verdict.reason);
    return json({ ok: false, error: message, fields: { cv: message } }, 422);
  }

  try {
    await ensureSchema(db);

    // Same answer as a new application: see 8 above.
    if (await emailTaken(db, application.email)) return json({ ok: true });

    const id = crypto.randomUUID();
    const key = `cv/${id}.pdf`;
    const name =
      cleanText(cv.name)
        .replace(/[^\p{L}\p{N} ._()-]/gu, "_")
        .slice(0, 120) || "cv.pdf";

    await files.put(key, bytes, {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: { application: id },
    });

    try {
      await insertApplication(db, id, application, { key, name, size: cv.size });
    } catch (error) {
      await files.delete(key).catch(() => {});
      // Two submissions racing past the email check: the second hits UNIQUE.
      if (String(error).includes("UNIQUE")) return json({ ok: true });
      throw error;
    }

    return json({ ok: true });
  } catch (error) {
    console.error("[apply] Storing the application failed:", error);
    return json({ ok: false, error: "Something went wrong on our side. Please try again." }, 500);
  }
}

export const Route = createFileRoute("/api/apply")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
