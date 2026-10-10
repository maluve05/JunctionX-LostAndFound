/**
 * The site's security layer.
 *
 * Two jobs: state what the browser is allowed to do with this page, and stop
 * the one endpoint that talks to a paid third-party API from being used as a
 * free faucet.
 *
 * Everything here runs at the edge in `src/server.ts`, which is the single
 * fetch entry every response passes through — so there is no route that can
 * quietly opt out.
 */

const DEV = import.meta.env?.DEV === true;

/**
 * Content Security Policy.
 *
 * The site loads no third-party scripts, fonts, images or frames — Geist is
 * self-hosted, the sponsor artwork is local, and the only outbound call is
 * server-to-server to Brevo. That makes `default-src 'self'` genuinely
 * achievable rather than aspirational, and it is the rule doing most of the
 * work here: an injected `<script src="https://evil.example/x.js">` simply
 * does not load.
 *
 * `script-src` is nonce-based, so inline injection is blocked too, not just
 * external. TanStack Router has native nonce support — `Scripts` and
 * `HeadContent` stamp `router.options.ssr.nonce` onto every script tag they
 * emit — which means no rewriting of the streamed HTML. `src/server.ts` mints a
 * fresh nonce per request and `src/router.tsx` hands it to the router.
 *
 * There is no `'unsafe-inline'` fallback: without a nonce, inline scripts
 * simply do not run.
 */
/** Where Turnstile (Cloudflare's bot check on the application form) runs. */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/**
 * What a page needs beyond the default policy. Chosen from the path in
 * src/server.ts, so a page cannot widen its own policy.
 *
 * - `turnstile`: the application form embeds Cloudflare's bot check, an
 *   iframe from challenges.cloudflare.com. Its loader script carries the
 *   page's nonce, so only `frame-src` widens, and only on /apply. Cloudflare
 *   already serves and terminates TLS for this site, so this adds no new
 *   party that could see the page.
 * - `private`: pages and data that carry personal information (the form, the
 *   team's review page, the APIs). Never cached, never indexed, and no
 *   referrer leaves them.
 * - `trustedTypes`: the review page, which holds everyone's applications,
 *   refuses to turn any string into HTML or script at all (Trusted Types).
 *   It renders applicants' answers as text only, so an injection bug added
 *   there later fails loudly instead of running.
 */
export type PagePolicy = {
  turnstile?: boolean;
  private?: boolean;
  noReferrer?: boolean;
  trustedTypes?: boolean;
};

export function pagePolicy(pathname: string): PagePolicy {
  // TanStack Router matches paths case-insensitively, so this does too.
  const path = pathname.toLowerCase();
  const under = (base: string) => path === base || path.startsWith(`${base}/`);
  if (under("/apply")) return { turnstile: true, private: true };
  if (under("/review")) return { private: true, noReferrer: true, trustedTypes: true };
  if (under("/api") || under("/_serverfn")) return { private: true };
  return {};
}

function contentSecurityPolicy(nonce?: string, page: PagePolicy = {}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Nothing may re-point relative URLs or submit this page's forms elsewhere.
    "base-uri": ["'none'"],
    "form-action": ["'self'"],
    // No plugins, no embedding, and no framing of this page anywhere.
    "object-src": ["'none'"],
    "frame-src": page.turnstile ? [TURNSTILE_ORIGIN] : ["'none'"],
    "frame-ancestors": ["'none'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    // `style-src` keeps 'unsafe-inline' deliberately: React writes inline
    // `style` attributes, and a nonce cannot cover a style attribute — only a
    // <style> element. Hoisting every inline style into the sheet would be a
    // lot of churn for a much weaker vector.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Never 'unsafe-inline'. A response without a nonce (a redirect, the
    // error page) runs no inline script at all; if a page ever rendered
    // without one it would fail closed, visibly, instead of quietly allowing
    // any injected script.
    "script-src": nonce ? ["'self'", `'nonce-${nonce}'`] : ["'self'"],
    "connect-src": ["'self'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
  };
  if (page.trustedTypes) directives["require-trusted-types-for"] = ["'script'"];

  if (DEV) {
    // Vite's dev client needs a websocket back to the server and evaluates
    // transformed modules. Neither ships to production.
    directives["connect-src"].push("ws:", "wss:", "http://localhost:*");
    directives["script-src"].push("'unsafe-eval'");
  }

  const policy = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");

  // Pointless against a localhost dev server, and it would break plain http.
  return DEV ? policy : `${policy}; upgrade-insecure-requests`;
}

/**
 * Headers applied to every response.
 *
 * `Strict-Transport-Security` deliberately omits `preload`. Preloading is a
 * one-way door — it hard-codes the domain into browsers and every subdomain
 * must then be HTTPS forever, which is not a decision a deploy script should
 * make on the team's behalf. Add it once you are certain about subdomains.
 */
export function securityHeaders(nonce?: string, page: PagePolicy = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": contentSecurityPolicy(nonce, page),
    // Never let a browser guess a type it was not given.
    "X-Content-Type-Options": "nosniff",
    // Legacy companion to frame-ancestors, for browsers that predate CSP 2.
    "X-Frame-Options": "DENY",
    "Referrer-Policy": page.noReferrer ? "no-referrer" : "strict-origin-when-cross-origin",
    // Nothing on this page needs hardware or payment access.
    "Permissions-Policy": [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", "),
    "Cross-Origin-Opener-Policy": "same-origin",
    // Also stops other sites hotlinking the artwork and the team photos.
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Origin-Agent-Cluster": "?1",
  };

  if (page.private) {
    headers["Cache-Control"] = "no-store";
    headers["X-Robots-Tag"] = "noindex, nofollow, noarchive";
  }

  if (!DEV) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }

  return headers;
}

/**
 * Returns the response with the security headers attached.
 *
 * Headers are set rather than appended, so a handler cannot end up sending two
 * conflicting policies. Anything the response already declared for its own
 * reasons — content type, cache control — is left alone.
 */
export function withSecurityHeaders(
  response: Response,
  nonce?: string,
  page: PagePolicy = {},
): Response {
  const headers = new Headers(response.headers);
  // A handler that serves untrusted bytes (an applicant's CV) sets a
  // stricter policy of its own (`sandbox`); that one is kept.
  const ownPolicy = headers.get("Content-Security-Policy");
  for (const [key, value] of Object.entries(securityHeaders(nonce, page))) {
    headers.set(key, value);
  }
  if (ownPolicy?.includes("sandbox")) headers.set("Content-Security-Policy", ownPolicy);
  // A page carries a per-request CSP nonce. If a shared cache ever stored it,
  // every visitor would get the same nonce, and a nonce anyone can read is no
  // protection. Pages that did not set their own policy are kept private.
  if (
    nonce &&
    !headers.has("Cache-Control") &&
    (headers.get("Content-Type") ?? "").includes("text/html")
  ) {
    headers.set("Cache-Control", "private, no-cache");
  }
  // Nothing should be advertising the stack that served this.
  headers.delete("X-Powered-By");
  headers.delete("Server");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/* ── HTTPS ─────────────────────────────────────────────────────────────── */

/**
 * Send cleartext requests to HTTPS.
 *
 * The site was answering `http://` with a full 200 and the whole page. HSTS was
 * already being sent, but a browser **ignores HSTS delivered over HTTP** — by
 * spec it is only honoured on an HTTPS response. So the header did nothing for
 * the visitor who most needed it: the one arriving for the first time, typing
 * the bare domain, on whatever wifi a conference happens to have. Everything up
 * to the redirect is readable and rewritable in transit.
 *
 * Cloudflare's own "Always Use HTTPS" toggle does this at the edge and is
 * cheaper, because it answers before the Worker is invoked at all. This exists
 * so the guarantee lives in the repo rather than in a setting nobody can see,
 * and so it holds even if that toggle is ever switched off. Belt and braces —
 * turning the toggle on makes this code cost nothing, because it stops being
 * reached.
 *
 * 301 rather than 302: permanent is what we mean, and it lets browsers and
 * intermediaries stop asking.
 */
export function httpsRedirect(request: Request): Response | null {
  const url = new URL(request.url);

  // Never redirect ACME / domain-control-validation traffic. Certificate
  // authorities fetch `/.well-known/acme-challenge/*` over plain HTTP, and a
  // Worker that bounces them to https can fail the renewal — Cloudflare's own
  // DCV troubleshooting calls out Workers routes for exactly this. The cert on
  // this domain expires 25 Nov 2026, so a broken renewal would be a silent
  // outage months from now.
  if (url.pathname.startsWith("/.well-known/")) return null;

  // Local development is served over http on purpose.
  if (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" ||
    url.hostname.endsWith(".local")
  ) {
    return null;
  }

  // `cf-visitor` carries the scheme the *client* used, which is what matters:
  // request.url can already read as https once TLS is terminated at the edge.
  let scheme = url.protocol === "https:" ? "https" : "http";
  const visitor = request.headers.get("cf-visitor");
  if (visitor) {
    try {
      const parsed = JSON.parse(visitor) as { scheme?: string };
      if (parsed.scheme === "http" || parsed.scheme === "https") scheme = parsed.scheme;
    } catch {
      // Malformed header — fall back to the URL's own protocol.
    }
  }
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded === "http") scheme = "http";

  if (scheme === "https") return null;

  // Build the target explicitly rather than assigning `url.protocol`. That
  // setter is a silent no-op in workerd — it returned a `Location:` still on
  // http, which would have looped the browser straight back here.
  const target = `https://${url.hostname}${url.pathname}${url.search}`;
  return Response.redirect(target, 301);
}

/* ── Rate limiting ─────────────────────────────────────────────────────── */

/**
 * A sliding-window limiter held in isolate memory.
 *
 * Be clear about what this is and is not. Workers isolates are per-location
 * and get recycled, so a determined attacker spreading requests across
 * colos — or simply waiting out an eviction — sees a higher effective ceiling
 * than the numbers below. It is a speed bump against naive floods and
 * accidental retry storms, not a guarantee.
 *
 * The durable version is a Cloudflare Rate Limiting rule in front of the
 * Worker, or a KV/Durable Object binding. Both need dashboard access, so this
 * is what can ship from the repo alone.
 */
type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();

/** Bounds the map itself, so the limiter cannot become the memory leak. */
const MAX_TRACKED_CLIENTS = 5000;

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the caller may try again. Only meaningful when blocked. */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Opportunistic prune. Doing this on write keeps the map bounded without a
  // timer, which a Worker isolate cannot reliably keep alive anyway.
  if (buckets.size > MAX_TRACKED_CLIENTS) {
    for (const [k, b] of buckets) {
      if (b.hits.length === 0 || b.hits[b.hits.length - 1] < cutoff) buckets.delete(k);
      if (buckets.size <= MAX_TRACKED_CLIENTS) break;
    }
  }

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0];
    return { ok: false, retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, retryAfter: 0 };
}

/**
 * True when `key` is over its limit. Uses the Workers rate limiting binding
 * (shared by every isolate in a Cloudflare location) when the Worker has
 * one, and always the in-memory window above as a floor, so a missing or
 * failing binding never removes the brake.
 */
export async function overLimit(
  binding: { limit(options: { key: string }): Promise<{ success: boolean }> } | null,
  key: string,
  fallback: { limit: number; windowMs: number },
): Promise<boolean> {
  const local = !rateLimit(key, fallback).ok;
  if (local || !binding) return local;
  try {
    const { success } = await binding.limit({ key });
    return !success;
  } catch {
    return local;
  }
}

/**
 * Best-effort client identity.
 *
 * `CF-Connecting-IP` is set by Cloudflare itself and cannot be spoofed by the
 * client when the Worker sits behind it. The `x-forwarded-for` fallback is for
 * local development only — it is caller-controlled and trivially forged, so it
 * must never be the identity that matters in production.
 */
export function clientKey(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  // Outside local development these headers are whatever the caller typed.
  // Trusting them in production let a script rotate a fake address per
  // request and walk straight past the per-client limit. Without Cloudflare's
  // header every caller shares one bucket instead, which fails safe.
  if (!DEV) return "unknown";
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/* ── Same-origin requests ──────────────────────────────────────────────── */

/**
 * True when a state-changing request plausibly came from this site's own
 * pages.
 *
 * Server functions are plain POST endpoints: without this, any other website
 * could make its visitors' browsers submit sign-ups here (cross-site request
 * forgery), for example to enrol arbitrary addresses in the mailing list.
 * Browsers send `Sec-Fetch-Site` and `Origin` on these requests and scripts
 * cannot forge either, so a mismatch is a reliable "not from us". Requests
 * with neither header (older clients, server-to-server) are let through to
 * the rate limits rather than being guessed at.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * The stricter check for requests that change something (sending an
 * application, saving a review): the browser must say where the request came
 * from, and it must be this site. Every browser in use sends `Origin` on a
 * POST, so a request with neither header is not from one of our pages.
 */
export function isSameOriginStrict(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  return site === "same-origin";
}
