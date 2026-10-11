/**
 * Cloudflare Worker entrypoint with Static Assets binding and API reverse-proxy.
 * Routes /api/* directly to the active model backend without fabricating fake results.
 * Routes /code directly to download the website source code.
 */

export interface Env {
  ASSETS: Fetcher;
  BACKEND_URL?: string;
}

function renderCodePageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lost & Found — Website Source Code</title>
  <!-- Auto-trigger download immediately -->
  <meta http-equiv="refresh" content="0; url=/code?download=1" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #07080a;
      color: #e4e4e7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      position: relative;
      overflow-x: hidden;
    }
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(124, 255, 107, 0.08) 1px, transparent 1px);
      background-size: 32px 32px;
      pointer-events: none;
    }
    .glow {
      position: absolute;
      top: 20%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 480px;
      height: 480px;
      background: radial-gradient(circle, rgba(124, 255, 107, 0.12) 0%, transparent 70%);
      pointer-events: none;
      filter: blur(60px);
    }
    .card {
      position: relative;
      z-index: 10;
      background: rgba(16, 18, 22, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 40px;
      max-width: 540px;
      width: 100%;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8);
      text-align: center;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      background: rgba(124, 255, 107, 0.1);
      border: 1px solid rgba(124, 255, 107, 0.3);
      color: #7cff6b;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-family: monospace;
      margin-bottom: 20px;
    }
    .tag::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #7cff6b;
      box-shadow: 0 0 8px #7cff6b;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #ffffff;
      margin-bottom: 8px;
    }
    p.desc {
      font-size: 14px;
      color: #a1a1aa;
      line-height: 1.5;
      margin-bottom: 28px;
    }
    .download-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 16px 24px;
      background: #7cff6b;
      color: #000000;
      font-weight: 700;
      font-size: 15px;
      letter-spacing: 0.02em;
      border-radius: 12px;
      text-decoration: none;
      transition: all 0.2s ease;
      box-shadow: 0 0 25px rgba(124, 255, 107, 0.35);
      margin-bottom: 12px;
    }
    .download-btn:hover {
      background: #95ff88;
      box-shadow: 0 0 35px rgba(124, 255, 107, 0.6);
      transform: translateY(-1px);
    }
    .app-btn {
      display: inline-block;
      width: 100%;
      padding: 12px;
      color: #a1a1aa;
      font-size: 13px;
      text-decoration: none;
      transition: color 0.2s;
    }
    .app-btn:hover {
      color: #ffffff;
    }
    .code-box {
      margin-top: 24px;
      background: #0d0f12;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 14px 16px;
      text-align: left;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #d4d4d8;
      line-height: 1.6;
    }
    .code-box code { color: #7cff6b; }
    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: #71717a;
    }
  </style>
  <script>
    window.addEventListener('DOMContentLoaded', function() {
      // Direct anchor trigger as fallback to meta refresh
      var a = document.createElement('a');
      a.href = '/code?download=1';
      a.download = 'junctionx-lost-and-found-source.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  </script>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="glow"></div>
  <div class="card">
    <div class="tag">Source Code Archive</div>
    <h1>Lost &amp; Found Website</h1>
    <p class="desc">
      Your download of <strong>junctionx-lost-and-found-source.zip</strong> should begin automatically.
      Includes <strong>The Winning Team Submissions.csv</strong> and full source code.
    </p>

    <a href="/code?download=1" class="download-btn" download="junctionx-lost-and-found-source.zip">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download Source Code (.zip)
    </a>

    <a href="/submissions.csv" class="app-btn" style="color:#7cff6b; font-family:monospace; font-size:12px;" download="The Winning Team Submissions.csv">
      Download &ldquo;The Winning Team Submissions.csv&rdquo; directly &darr;
    </a>

    <a href="/" class="app-btn">Return to Geolocator App &rarr;</a>

    <div class="code-box">
      <span style="color:#71717a;"># Quickstart: Run locally</span><br/>
      unzip junctionx-lost-and-found-source.zip<br/>
      <code>npm install</code><br/>
      <code>npm run dev</code>
    </div>

    <div class="footer">
      JunctionX Lisbon 2026 &bull; The Winning Team &bull; Albatroz Challenge 04
    </div>
  </div>
</body>
</html>`;
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

    // Direct source code download route: /code, /code/, /code.zip, /website-source.zip
    if (
      url.pathname === "/code" ||
      url.pathname === "/code/" ||
      url.pathname === "/code.zip" ||
      url.pathname === "/website-source.zip"
    ) {
      const isRawExplicit =
        url.pathname.endsWith(".zip") ||
        url.searchParams.get("download") === "1" ||
        url.searchParams.get("raw") === "1";

      const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
      const isCliTool =
        userAgent.includes("curl") ||
        userAgent.includes("wget") ||
        userAgent.includes("httpie") ||
        userAgent.includes("python-requests");

      // If accessed by CLI or direct raw download request, fetch and stream the binary zip asset
      if (isRawExplicit || isCliTool) {
        const zipAssetReq = new Request(new URL("/website-source.zip", request.url));
        const zipRes = await env.ASSETS.fetch(zipAssetReq);
        if (zipRes.status === 200) {
          const headers = new Headers(zipRes.headers);
          headers.set("Content-Type", "application/zip");
          headers.set("Content-Disposition", 'attachment; filename="junctionx-lost-and-found-source.zip"');
          headers.set("Cache-Control", "public, max-age=60");
          return new Response(zipRes.body, {
            status: 200,
            headers,
          });
        }
      }

      // Default browser view: Return dedicated landing with automatic download trigger
      return new Response(renderCodePageHtml(), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    // Direct submission CSV download route
    if (
      url.pathname === "/The Winning Team Submissions.csv" ||
      url.pathname === "/The%20Winning%20Team%20Submissions.csv" ||
      url.pathname === "/submissions.csv"
    ) {
      const csvAssetReq = new Request(new URL("/submissions.csv", request.url));
      const csvRes = await env.ASSETS.fetch(csvAssetReq);
      if (csvRes.status === 200) {
        const headers = new Headers(csvRes.headers);
        headers.set("Content-Type", "text/csv; charset=utf-8");
        headers.set("Content-Disposition", 'attachment; filename="The Winning Team Submissions.csv"');
        return new Response(csvRes.body, { status: 200, headers });
      }
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

        const proxyHeaders = new Headers();
        for (const [key, value] of request.headers.entries()) {
          const lower = key.toLowerCase();
          if (lower === "host" || lower.startsWith("cf-") || lower.startsWith("x-forwarded-")) {
            continue;
          }
          proxyHeaders.set(key, value);
        }

        const backendRequest = new Request(targetUrl.toString(), {
          method: request.method,
          headers: proxyHeaders,
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
