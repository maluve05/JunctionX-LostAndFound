import "./lib/error-capture";

import { AsyncLocalStorage } from "node:async_hooks";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { httpsRedirect, pagePolicy, withSecurityHeaders } from "./lib/security";

/**
 * Per-request CSP nonce.
 *
 * The nonce is minted here and has to reach `getRouter()` in src/router.tsx,
 * which the framework calls during SSR. That file is bundled for the browser
 * too, so it cannot import anything server-only — and a plain global would
 * race, handing one request another's nonce the moment two overlap. A
 * mismatched nonce blocks every script and renders a blank page, so this has to
 * be genuinely request-scoped.
 *
 * AsyncLocalStorage gives that: `run()` wraps the whole render and the value
 * propagates through every await inside it. The accessor is installed on
 * globalThis so the router can read it with a plain property lookup and no
 * import — undefined in the browser, which is correct there.
 *
 * Same mechanism TanStack itself uses for `getRequest()`.
 */
const NONCE_STORAGE = "__forgeNonceStorage";
const NONCE_ACCESSOR = "__forgeGetNonce";

type NonceGlobal = {
  [NONCE_STORAGE]?: AsyncLocalStorage<string>;
  [NONCE_ACCESSOR]?: () => string | undefined;
};

const nonceGlobal = globalThis as unknown as NonceGlobal;
const nonceStorage = (nonceGlobal[NONCE_STORAGE] ??= new AsyncLocalStorage<string>());
nonceGlobal[NONCE_ACCESSOR] = () => nonceStorage.getStore();

/** 128 bits of randomness, base64'd — comfortably beyond guessing. */
function mintNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

type CfEnv = Record<string, unknown>;

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

/**
 * Normalizes catastrophic SSR errors swallowed by Nitro/H3 into a clean 500 response.
 */
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Before anything else: never answer a cleartext request with content.
    const toHttps = httpsRedirect(request);
    if (toHttps) return withSecurityHeaders(toHttps);

    // Extract Cloudflare runtime env from all possible injection points
    const reqAny = request as unknown as {
      runtime?: { cloudflare?: { env?: CfEnv } };
      context?: { cloudflare?: { env?: CfEnv } };
      env?: CfEnv;
    };

    const cfEnv =
      (env && typeof env === "object" ? (env as CfEnv) : undefined) ||
      reqAny.runtime?.cloudflare?.env ||
      reqAny.context?.cloudflare?.env ||
      reqAny.env;

    if (cfEnv && typeof cfEnv === "object") {
      const g = globalThis as unknown as { __env__?: CfEnv };
      g.__env__ = Object.assign(g.__env__ || {}, cfEnv);

      // Attach env directly onto request object for downstream handlers
      reqAny.env = cfEnv;

      // Merge into process.env if available/writable (Node / local development)
      try {
        if (typeof process !== "undefined" && process.env) {
          Object.assign(process.env, cfEnv);
        }
      } catch {
        // process.env may be read-only in strict workerd runtimes
      }
    }

    // Every response leaves through here, including the error paths below, so
    // there is no route that can quietly ship without a policy attached. The
    // render runs inside the nonce scope, so the value the router stamps onto
    // the script tags is the same one this header advertises.
    const nonce = mintNonce();
    // What this path may do beyond the default policy (see pagePolicy).
    const page = pagePolicy(new URL(request.url).pathname);

    return await nonceStorage.run(nonce, async () => {
      try {
        const handler = await getServerEntry();
        const response = await handler.fetch(request, env, ctx);
        return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response), nonce, page);
      } catch (error) {
        console.error(error);
        return withSecurityHeaders(
          new Response(renderErrorPage(), {
            status: 500,
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
          nonce,
          page,
        );
      }
    });
  },
};
