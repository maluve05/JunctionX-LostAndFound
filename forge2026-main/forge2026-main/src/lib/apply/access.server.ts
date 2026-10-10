import { DEV, isLocalHost, list, onSiteHost, variable } from "./env.server";

/*
  Who may use the review page: a team member Cloudflare Access let through,
  whose email is also on this Worker's own list.

  Three locks, each enough on its own to stop a stranger:

  1. Cloudflare Access sits in front of /review and makes the team sign in
     (a one-time code by email). The site never sees a password.
  2. This file checks the JWT Access attaches to every request it lets
     through (`Cf-Access-Jwt-Assertion`): the signature against the team's
     published keys, the issuer, this application's audience tag, and the
     expiry. A request that reached the Worker without passing Access (its
     workers.dev address, a preview URL) has no valid token and gets nothing.
  3. The email in that token must be on REVIEWER_EMAILS (or
     REVIEW_ADMIN_EMAILS), a secret on the Worker. If the Access policy is
     ever widened by mistake, this list still holds.

  Admins (REVIEW_ADMIN_EMAILS) can also export everything and delete
  applications. Without CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD and a reviewer
  list, the review page is closed to everyone. The only exception is
  `npm run dev` on this machine (localhost), where you are the reviewer.
*/

type Jwk = JsonWebKey & { kid?: string };

type KeySet = { keys: Map<string, CryptoKey>; fetched: number };
const keyCache = new Map<string, KeySet>();
/** Keys are refetched hourly, or on an unknown key id (Access rotates them)... */
const KEY_TTL_MS = 60 * 60 * 1000;
/** ...but at most once a minute, so made-up key ids cannot make us hammer Access. */
const MIN_REFRESH_MS = 60 * 1000;

function b64urlBytes(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function b64urlJson<T>(input: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(input))) as T;
}

async function signingKeys(team: string, refresh = false): Promise<Map<string, CryptoKey>> {
  const cached = keyCache.get(team);
  const age = cached ? Date.now() - cached.fetched : Infinity;
  if (cached && age < KEY_TTL_MS && (!refresh || age < MIN_REFRESH_MS)) return cached.keys;

  const res = await fetch(`https://${team}/cdn-cgi/access/certs`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Access certs: ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };

  const map = new Map<string, CryptoKey>();
  for (const jwk of keys) {
    if (!jwk.kid || jwk.kty !== "RSA") continue;
    map.set(
      jwk.kid,
      await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      ),
    );
  }
  keyCache.set(team, { keys: map, fetched: Date.now() });
  return map;
}

export type Reviewer = { email: string; admin: boolean };

/** The signed-in team member, or null. Never throws. */
export async function reviewer(request: Request): Promise<Reviewer | null> {
  const host = new URL(request.url).hostname;
  const team = variable("CF_ACCESS_TEAM_DOMAIN")
    ?.replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  const aud = variable("CF_ACCESS_AUD");
  const reviewers = list("REVIEWER_EMAILS");
  const admins = list("REVIEW_ADMIN_EMAILS");

  // `npm run dev` on this machine only. A phone on the same Wi-Fi reaching
  // the dev server by its IP address is not localhost, so it gets nothing.
  if (DEV && isLocalHost(host) && !aud) return { email: "dev@localhost", admin: true };

  if (!onSiteHost(request)) return null;
  if (!team || !aud || (reviewers.size === 0 && admins.size === 0)) {
    console.error("[review] Access or the reviewer list is not configured; review is closed.");
    return null;
  }

  // The header Access adds, not the CF_Authorization cookie: the header only
  // exists on requests that went through Access (Cloudflare recommends it).
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token || token.length > 8192) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const header = b64urlJson<{ alg?: string; kid?: string }>(parts[0]);
    // Only RS256: never "none", never a symmetric algorithm.
    if (header.alg !== "RS256" || !header.kid) return null;

    let key = (await signingKeys(team)).get(header.kid);
    if (!key) key = (await signingKeys(team, true)).get(header.kid);
    if (!key) return null;

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return null;

    const claims = b64urlJson<{
      aud?: string | string[];
      iss?: string;
      exp?: number;
      nbf?: number;
      iat?: number;
      email?: string;
    }>(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(aud)) return null;
    if (claims.iss !== `https://${team}`) return null;
    if (typeof claims.exp !== "number" || claims.exp < now) return null;
    if (typeof claims.nbf === "number" && claims.nbf > now + 60) return null;
    if (typeof claims.iat === "number" && claims.iat > now + 60) return null;
    if (typeof claims.email !== "string" || !claims.email) return null;

    const email = claims.email.trim().toLowerCase();
    const admin = admins.has(email);
    if (!admin && !reviewers.has(email)) {
      console.warn("[review] Signed in through Access but not on the reviewer list.");
      return null;
    }
    return { email, admin };
  } catch (error) {
    console.error("[review] Access token check failed:", error);
    return null;
  }
}
