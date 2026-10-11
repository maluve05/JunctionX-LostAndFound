/**
 * Cloudflare Worker entrypoint with Static Assets binding and API reverse-proxy.
 * Routes /api/* directly to the active model backend without fabricating fake results.
 */

export interface Env {
  ASSETS: Fetcher;
  BACKEND_URL?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle preflight OPTIONS for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Proxy /api/* to the actual model backend (e.g. cloudflared tunnel or local backend)
    if (url.pathname.startsWith("/api/")) {
      const backendBase = env.BACKEND_URL;

      if (!backendBase || backendBase.includes("127.0.0.1") || backendBase.includes("localhost")) {
        return new Response(
          JSON.stringify({
            error: "Backend tunnel not connected",
            detail:
              "The Cloudflare Worker requires a reachable BACKEND_URL to perform neural model inference. Please launch the backend with cloudflared tunnel.",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      try {
        const targetUrl = new URL(url.pathname + url.search, backendBase);
        const backendRequest = new Request(targetUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body,
          redirect: "follow",
        });

        const response = await fetch(backendRequest);
        const headers = new Headers(response.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "*");

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (err: unknown) {
        return new Response(
          JSON.stringify({
            error: "Model backend unreachable",
            detail:
              "Could not communicate with the Python model backend. Ensure the server and tunnel are active.",
            message: err instanceof Error ? err.message : String(err),
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // Serve static assets from the compiled Vite SPA bundle
    return env.ASSETS.fetch(request);
  },
};
