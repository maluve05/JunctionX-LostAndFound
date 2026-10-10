import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Load all .env variables into process.env for local development & SSR functions
const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, env);

export default defineConfig({
  nitro: {
    // This project deploys through Workers Builds, not Pages. The
    // `cloudflare-pages` preset emits a Pages-shaped artifact —
    // `pages_build_output_dir`, a `_routes.json`, and a declared deploy command
    // of `wrangler pages deploy` — which a Workers deploy cannot publish. The
    // module preset emits `main` + `assets` and deploys with `wrangler deploy`.
    preset: "cloudflare-module",
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // The dev server answers this computer only. Lovable's default listens on
    // every network interface, which put the dev site (and its local
    // applications) on any Wi-Fi you joined. To try the phone build on a real
    // phone, opt in for that session: `npm run dev -- --host`.
    server: { host: "localhost" },
  },
});
