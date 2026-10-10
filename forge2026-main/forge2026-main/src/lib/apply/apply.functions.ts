import { createServerFn } from "@tanstack/react-start";
import { applicationsOpen, bindings } from "./env.server";
import { turnstileSiteKey } from "./turnstile.server";

/**
 * What the form needs to know before anyone fills it in: whether it takes
 * applications (APPLICATIONS_OPEN), whether storage and Turnstile are set up
 * (if not, it says so instead of failing at the last step), and Turnstile's
 * public site key.
 */
export const getApplyState = createServerFn({ method: "GET" }).handler(async () => {
  const { db, files } = await bindings();
  const siteKey = turnstileSiteKey();
  return {
    open: applicationsOpen(),
    ready: Boolean(db && files && siteKey),
    siteKey,
  };
});
