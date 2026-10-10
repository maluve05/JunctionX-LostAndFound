import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { clientKey, isSameOriginStrict, rateLimit } from "./security";

/**
 * Brevo subscribe function for FORGe.
 *
 * Runs server-side only. Reads API key and list IDs from:
 *   1. TanStack Start request context (Cloudflare runtime env)
 *   2. getRequest() runtime object
 *   3. globalThis.__env__ (populated by server.ts fetch entry)
 *   4. process.env (local development)
 *   5. import.meta.env (Vite build-time fallbacks)
 */

const BREVO_API = "https://api.brevo.com/v3/contacts";

/**
 * Bounded on every field. Without a max length this accepts a multi-megabyte
 * string and hands it to `fetch`, which makes the endpoint a cheap way to
 * spend someone else's bandwidth. 254 is the maximum length of a real address.
 * `list` is an enum rather than a free string so a caller cannot aim the
 * subscription at an arbitrary list id.
 */
const subscribeInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  honeypot: z.string().max(200).optional(),
  list: z.enum(["forge"]).optional(),
});

/** Per address, per minute. Generous for a person, useless for a script. */
const PER_CLIENT = { limit: 5, windowMs: 60_000 };

/**
 * A ceiling across all callers, protecting the Brevo quota from a flood spread
 * across many addresses — the case the per-client limit cannot see.
 */
const GLOBAL = { limit: 200, windowMs: 60_000 };

/**
 * @param secret  Narrows where the value may come from, and refuses to look
 *                for a `VITE_`-prefixed spelling.
 *
 *                Vite inlines every `VITE_*` variable into the client bundle.
 *                Accepting `VITE_BREVO_API_KEY` as a fallback meant that
 *                naming the variable that way in a dashboard would silently
 *                publish the API key to every visitor, and the code would keep
 *                working — the worst kind of failure, because nothing breaks.
 *                Secrets are also not read from `import.meta.env` or from bare
 *                globals for the same reason.
 */
function resolveEnvValue(
  key: string,
  contextEnv?: Record<string, unknown>,
  { secret = false }: { secret?: boolean } = {},
): string | undefined {
  const sources: Array<Record<string, unknown> | undefined> = [];

  // 1. Context passed from middleware
  if (contextEnv && typeof contextEnv === "object") {
    sources.push(contextEnv);
  }

  // 2. Global runtime bridge (populated by server.ts and start.ts)
  const g = globalThis as unknown as { __env__?: Record<string, unknown> } & Record<
    string,
    unknown
  >;
  if (g.__env__) {
    sources.push(g.__env__);
  }
  if (!secret) sources.push(g);

  // 3. process.env (Node / local development)
  if (typeof process !== "undefined" && process.env) {
    sources.push(process.env as Record<string, unknown>);
  }

  // 4. import.meta.env (Vite build-time env) — public values only
  if (
    !secret &&
    typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, unknown> }).env
  ) {
    sources.push((import.meta as { env: Record<string, unknown> }).env);
  }

  const candidates = secret
    ? [key, key.toLowerCase()]
    : [key, `VITE_${key}`, key.toLowerCase(), `vite_${key.toLowerCase()}`];

  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const candidate of candidates) {
      const val = src[candidate];
      if (typeof val === "string" && val.trim().length > 0) {
        return val.trim();
      }
      if (typeof val === "number") {
        return String(val);
      }
    }
  }

  return undefined;
}

/** How long to wait on Brevo before giving up, so a slow upstream cannot pin requests open. */
const UPSTREAM_TIMEOUT_MS = 8000;

export const subscribeToNewsletter = createServerFn({ method: "POST" })
  // A failed parse would otherwise send the validator's full issue list back
  // to the caller. The form only needs to know the input was not accepted.
  .inputValidator((data: unknown) => {
    const parsed = subscribeInput.safeParse(data);
    if (!parsed.success) throw new Error("Please enter a valid email address.");
    return parsed.data;
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error: string | null }> => {
    // Honeypot spam trap. Answers exactly as a success would, so a bot gets
    // no signal that it was caught.
    if (data.honeypot) {
      return { ok: true, error: null };
    }

    // Read runtime env from request if available
    let reqEnv: Record<string, unknown> | undefined;
    let request: Request | undefined;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest() as unknown as Request & {
        runtime?: { cloudflare?: { env?: Record<string, unknown> } };
        context?: { cloudflare?: { env?: Record<string, unknown> } };
        env?: Record<string, unknown>;
      };
      request = req;
      reqEnv = req?.runtime?.cloudflare?.env || req?.context?.cloudflare?.env || req?.env;
    } catch {
      // Handled via context fallback
    }

    // Only this site's own pages may submit, and a browser always says
    // which page sent it. A request without that is not from our pages.
    if (!request?.headers || !isSameOriginStrict(request)) {
      return { ok: false, error: "Sign-up is not available right now." };
    }

    // Throttle before spending anything. Both limits are checked so a flood
    // spread across many addresses still hits the ceiling. If the request
    // could not be read, the limits still apply (under one shared key)
    // rather than being skipped: failing open here would remove the only
    // brake on the Brevo quota.
    const who = request?.headers ? clientKey(request) : "unknown";
    const mine = rateLimit(`subscribe:${who}`, PER_CLIENT);
    const all = rateLimit("subscribe:global", GLOBAL);
    if (!mine.ok || !all.ok) {
      return { ok: false, error: "Too many attempts. Please try again in a minute." };
    }

    const ctxEnv = (context as { env?: Record<string, unknown> } | undefined)?.env || reqEnv;

    const apiKey = resolveEnvValue("BREVO_API_KEY", ctxEnv, { secret: true });
    const listIdRaw =
      (data.list === "forge" ? resolveEnvValue("BREVO_LIST_ID_FORGE", ctxEnv) : undefined) ??
      resolveEnvValue("BREVO_LIST_ID_FORGE", ctxEnv) ??
      resolveEnvValue("BREVO_LIST_ID", ctxEnv) ??
      "8";

    const listId = Number(listIdRaw);

    if (!apiKey) {
      console.error("[Brevo] BREVO_API_KEY is missing in server environment variables.");
      return { ok: false, error: "Sign-up is not available right now." };
    }

    if (isNaN(listId) || listId <= 0) {
      console.error("[Brevo] List ID is invalid:", listIdRaw);
      return { ok: false, error: "Sign-up is not available right now." };
    }

    try {
      const res = await fetch(BREVO_API, {
        method: "POST",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          email: data.email.trim().toLowerCase(),
          listIds: [listId],
          updateEnabled: true,
        }),
      });

      // 201 Created (new contact) and 204 No Content (already on the list)
      // answer the same. Telling them apart would let anyone check whether
      // an address is subscribed.
      if (res.ok) return { ok: true, error: null };

      const body = (await res.json().catch(() => null)) as {
        code?: string;
        message?: string;
      } | null;
      const code = body?.code;
      const message = body?.message ?? `Brevo error ${res.status}`;

      // Check if duplicate contact or already exists
      if (
        code === "duplicate_parameter" ||
        message.toLowerCase().includes("already exist") ||
        message.toLowerCase().includes("duplicate")
      ) {
        return { ok: true, error: null };
      }

      if (res.status === 400) {
        // Brevo's own wording stays in the logs. Relaying it verbatim put
        // upstream error text on our page and told callers how the
        // integration is configured.
        console.warn("[Brevo] 400 Bad Request:", message);
        return { ok: false, error: "Please check the email address and try again." };
      }

      console.error("[Brevo] API error:", res.status, message);
      return { ok: false, error: "Something went wrong. Please try again later." };
    } catch (e) {
      console.error("[Brevo] Subscribe network failed:", e);
      return { ok: false, error: "Network error. Please try again later." };
    }
  });
