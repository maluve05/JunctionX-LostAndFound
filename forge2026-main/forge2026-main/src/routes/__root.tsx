import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import phoneCss from "../phone.css?url";
import { Only } from "../components/Split";
import { PhoneNav, PhoneTop } from "../components/phone/chrome";
import { PhoneIntro } from "../components/phone/Intro";
import { WideChrome } from "../components/story/wide";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // viewport-fit=cover lets the tab bar sit on the home indicator's safe area.
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "FORGe" },
      { title: "FORGe 2026: Portugal's Biggest Hackathon | Lisbon" },
      {
        name: "description",
        content:
          "FORGe is Portugal's biggest hackathon. Builders from Portugal and beyond, one weekend, in Lisbon during Web Summit week, November 2026.",
      },
      { name: "author", content: "FORGe" },
      { name: "theme-color", content: "#0B0B0F" },
      { property: "og:title", content: "FORGe 2026: Portugal's Biggest Hackathon" },
      {
        property: "og:description",
        content: "One room. One weekend. Lisbon, November 2026, during Web Summit week.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "FORGe" },
      // The share card (1200 x 630). PNG, because several social scrapers still
      // do not read WebP, and an absolute URL, because most ignore relative ones.
      { property: "og:image", content: "https://forgehackathon.com/og/forge-2026-v2.png" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content:
          "FORGe, Portugal's biggest hackathon. Lisbon, November 2026, during Web Summit week.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://forgehackathon.com/og/forge-2026-v2.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // The phone build's styles only apply on a phone, so wider screens never
      // wait for them to paint.
      { rel: "stylesheet", href: phoneCss, media: "(max-width: 767px)" },
      // A real icon, not the hero artwork. Pointing this at anvil-symbol.png
      // made every cold load fetch 125KB for a 16px tab icon.
      { rel: "icon", href: "/brand/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/brand/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "preload",
        href: "/fonts/Geist-Variable.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/GeistMono-Variable.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {/* Without scripts the loading intro never runs; don't let it cover the page. */}
        <noscript>
          <style>{".intro{display:none}"}</style>
        </noscript>
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Pages that are tools rather than chapters of the story: the application
 * form and the team's review page. They get no 3D scene, intro or phone bars,
 * so filling in a form never waits on three.js. Links into and out of them
 * are plain full-page loads, so the story's chrome never has to tear down or
 * wake mid-visit.
 */
const PLAIN = /^\/(apply|review)(\/|$)/;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const plain = useRouterState({ select: (s) => PLAIN.test(s.location.pathname) });

  if (plain) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    );
  }

  // The chrome lives here, outside the routes, so it stays put across page
  // changes: on wide screens the 3D scene carries its shards from one page to
  // the next instead of starting over. Phones get their own bars instead (see
  // components/layout.tsx for how the two builds share one app).
  return (
    <QueryClientProvider client={queryClient}>
      <Only mode="wide" of={WideChrome} />
      <Only mode="phone" of={PhoneTop} />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Only mode="phone" of={PhoneNav} />
      <Only mode="phone" of={PhoneIntro} />
    </QueryClientProvider>
  );
}
