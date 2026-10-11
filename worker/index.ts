/**
 * Cloudflare Worker entrypoint with Static Assets binding and API reverse-proxy.
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

    // Proxy /api/* to the Python backend (e.g. running via Cloudflare Tunnel, local tunnel, or remote server)
    if (url.pathname.startsWith("/api/")) {
      const backendBase = env.BACKEND_URL || "http://127.0.0.1:8000";
      const targetUrl = new URL(url.pathname + url.search, backendBase);

      try {
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
            error: "Backend currently unreachable",
            detail: "Ensure the Python FastAPI backend (api.py) is running and reachable via BACKEND_URL.",
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

    // Serve static assets with SPA fallback for client-side routing
    return env.ASSETS.fetch(request);
  },
};
