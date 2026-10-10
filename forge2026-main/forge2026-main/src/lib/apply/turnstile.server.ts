import { DEV, siteHosts, variable } from "./env.server";

/*
  Turnstile: Cloudflare's check that an application was sent by a person in
  a browser, not a script. The widget on the form's last step returns a
  token; the server asks Cloudflare whether that token is genuine, unused,
  and was made on this site for this form.

  Without TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY the form takes nothing
  in production (it fails closed). While developing, Cloudflare's published
  test keys stand in: they always pass and talk to no real widget.
*/

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TEST_SITE_KEY = "1x00000000000000000000AA";
const TEST_SECRET = "1x0000000000000000000000000000000AA";

/** The action the form's widget declares, so a token minted elsewhere cannot be reused here. */
export const TURNSTILE_ACTION = "apply";

function keys(): { siteKey: string; secret: string } | null {
  const siteKey = variable("TURNSTILE_SITE_KEY");
  const secret = variable("TURNSTILE_SECRET_KEY");
  if (siteKey && secret) return { siteKey, secret };
  if (DEV) return { siteKey: TEST_SITE_KEY, secret: TEST_SECRET };
  return null;
}

/** The public site key for the widget, or null when Turnstile is not set up. */
export function turnstileSiteKey(): string | null {
  return keys()?.siteKey ?? null;
}

/** True only when Cloudflare confirms the token. Network trouble counts as no. */
export async function verifyTurnstile(token: unknown, ip: string | null): Promise<boolean> {
  const k = keys();
  if (!k || typeof token !== "string" || !token || token.length > 2048) return false;

  const body = new FormData();
  body.set("secret", k.secret);
  body.set("response", token);
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  body.set("idempotency_key", crypto.randomUUID());

  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return false;
    const out = (await res.json()) as { success?: boolean; action?: string; hostname?: string };
    if (out.success !== true) return false;
    // The test secret answers for any page; real tokens must match this form and site.
    if (k.secret === TEST_SECRET) return DEV;
    if (out.action !== TURNSTILE_ACTION) return false;
    return typeof out.hostname === "string" && siteHosts().has(out.hostname.toLowerCase());
  } catch (error) {
    console.error("[apply] Turnstile check failed:", error);
    return false;
  }
}
