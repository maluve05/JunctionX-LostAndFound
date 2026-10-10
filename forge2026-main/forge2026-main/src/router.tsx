import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * The per-request CSP nonce, if we are rendering on the server.
 *
 * Read through an accessor that `src/server.ts` installs on globalThis rather
 * than by importing it. This module is bundled for the browser as well, and
 * `@tanstack/react-start/server` has no browser condition in its exports — a
 * static import would drag server code into the client bundle. A plain property
 * lookup is undefined in the browser, which is exactly right: nonces only mean
 * anything on the server-rendered HTML.
 *
 * The value itself lives in AsyncLocalStorage, so concurrent requests cannot
 * see each other's nonce.
 */
function requestNonce(): string | undefined {
  return (
    globalThis as unknown as { __forgeGetNonce?: () => string | undefined }
  ).__forgeGetNonce?.();
}

/**
 * The browser skips a View Transition when the tab is hidden or a second
 * navigation interrupts the first, and rejects its `ready` promise when it
 * does. The router never awaits that promise, so each skip surfaced as an
 * "Uncaught (in promise) InvalidStateError" in the console. Navigation itself
 * is unaffected; this only marks the rejection as handled.
 */
if (typeof document !== "undefined" && "startViewTransition" in document) {
  const start = document.startViewTransition.bind(document);
  document.startViewTransition = ((arg?: Parameters<typeof start>[0]) => {
    const transition = start(arg);
    transition.ready.catch(() => {});
    return transition;
  }) as typeof document.startViewTransition;
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Page changes run inside a View Transition: the old page lifts away, a
    // colour curtain shows through, and the new page wipes up over it while
    // the nav holds still. Browsers without support just swap instantly.
    // The transition is typed by destination, so each page arrives through its
    // own colour (styles.css, "Page transitions"). Hash-only moves, like the
    // nav's "The event", scroll instead of transitioning.
    defaultViewTransition: {
      types: ({ toLocation, pathChanged }) => {
        if (!pathChanged) return false;
        const path = toLocation.pathname;
        if (path.startsWith("/builders")) return ["to-builders"];
        if (path.startsWith("/partners")) return ["to-partners"];
        return ["to-home"];
      },
    },
    defaultPreloadStaleTime: 0,
    // `Scripts` and `HeadContent` read this and stamp it onto every script tag
    // they emit, which is what lets the CSP drop 'unsafe-inline'.
    ssr: { nonce: requestNonce() },
  });

  return router;
};
