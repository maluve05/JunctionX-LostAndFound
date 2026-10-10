import { onDemand } from "../layout";
import { WideChrome as WideChromeServer } from "./WideChrome";
import { WideHome as WideHomeServer } from "./home/WideHome";
import { WideBuilders as WideBuildersServer } from "./builders/WideBuilders";
import { WidePartners as WidePartnersServer } from "./partners/WidePartners";

/*
  The wide-screen build, loaded on demand (see components/layout.tsx). The
  server renders these directly; the browser downloads them only on a wide
  screen, so phones never fetch the 3D story, GSAP or Lenis.
*/

export const WideChrome = onDemand(import.meta.env.SSR ? WideChromeServer : undefined, () =>
  import("./WideChrome").then((m) => m.WideChrome),
);

export const WideHome = onDemand(import.meta.env.SSR ? WideHomeServer : undefined, () =>
  import("./home/WideHome").then((m) => m.WideHome),
);

export const WideBuilders = onDemand(import.meta.env.SSR ? WideBuildersServer : undefined, () =>
  import("./builders/WideBuilders").then((m) => m.WideBuilders),
);

export const WidePartners = onDemand(import.meta.env.SSR ? WidePartnersServer : undefined, () =>
  import("./partners/WidePartners").then((m) => m.WidePartners),
);
