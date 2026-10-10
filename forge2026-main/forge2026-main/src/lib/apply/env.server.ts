/*
  The Worker's environment: Cloudflare bindings (D1, R2, rate limiters) and
  variables.

  src/server.ts copies the runtime env onto `globalThis.__env__` for every
  request. Read it inside a handler, never at module scope: on Workers it is
  bound per request.
*/

/** The slice of D1 this app uses. */
export type D1 = {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
};
export type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
};

/** The slice of R2 this app uses. */
export type R2 = {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
  delete(key: string): Promise<void>;
};

/** A Workers rate limiting binding (wrangler.jsonc, `ratelimits`). */
export type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

export const DEV = import.meta.env?.DEV === true;

function env(): Record<string, unknown> {
  const g = globalThis as unknown as { __env__?: Record<string, unknown> };
  return g.__env__ ?? {};
}

type Bindings = {
  db: D1 | null;
  files: R2 | null;
  applyLimiter: RateLimiter | null;
  reviewLimiter: RateLimiter | null;
};

/**
 * D1, R2 and the rate limiters. On Workers they come with the request.
 * `vite dev` doesn't run the Workers runtime, so while developing they come
 * from wrangler's local emulation of wrangler.jsonc instead (data in
 * .wrangler/state), started once and kept across hot reloads.
 */
export async function bindings(): Promise<Bindings> {
  let e = env();
  if (DEV && !e.APPLICATIONS_DB) e = await devEnv();
  const limiter = (v: unknown) =>
    v && typeof (v as RateLimiter).limit === "function" ? (v as RateLimiter) : null;
  return {
    db: (e.APPLICATIONS_DB as D1 | undefined) ?? null,
    files: (e.APPLICATION_FILES as R2 | undefined) ?? null,
    applyLimiter: limiter(e.APPLY_LIMITER),
    reviewLimiter: limiter(e.REVIEW_LIMITER),
  };
}

function devEnv(): Promise<Record<string, unknown>> {
  const g = globalThis as unknown as { __forgeDevEnv?: Promise<Record<string, unknown>> };
  g.__forgeDevEnv ??= (async () => {
    // A variable, so the production build never tries to bundle wrangler.
    const pkg = "wrangler";
    const { getPlatformProxy } = (await import(/* @vite-ignore */ pkg)) as {
      getPlatformProxy: () => Promise<{ env: Record<string, unknown> }>;
    };
    return (await getPlatformProxy()).env;
  })();
  return g.__forgeDevEnv;
}

/** A plain string variable or secret (dashboard, wrangler, or .dev.vars). */
export function variable(key: string): string | undefined {
  const value = env()[key] ?? (typeof process !== "undefined" ? process.env?.[key] : undefined);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** A comma- or newline-separated variable as a set of lowercase entries. */
export function list(key: string): Set<string> {
  return new Set(
    (variable(key) ?? "")
      .split(/[\s,;]+/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );
}

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLocalHost(hostname: string): boolean {
  return LOCAL.has(hostname.toLowerCase());
}

/**
 * The hostnames the site is meant to answer on. The application form and the
 * review API refuse every other one: a request that reached the Worker
 * through its workers.dev address or a preview URL skipped the zone's
 * Cloudflare Access, WAF and rate limiting rules, so it gets nothing.
 */
export function siteHosts(): Set<string> {
  const configured = list("SITE_HOSTS");
  return configured.size ? configured : new Set(["forgehackathon.com", "www.forgehackathon.com"]);
}

export function onSiteHost(request: Request): boolean {
  const host = new URL(request.url).hostname.toLowerCase();
  if (DEV && isLocalHost(host)) return true;
  return siteHosts().has(host);
}

/**
 * Whether the form takes applications. Off until the team sets
 * APPLICATIONS_OPEN=true, so the page can be reviewed on the live site
 * before it opens. Always on while developing.
 */
export function applicationsOpen(): boolean {
  return DEV || variable("APPLICATIONS_OPEN") === "true";
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}
