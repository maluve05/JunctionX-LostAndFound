import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

type CfEnv = Record<string, unknown>;

const envMiddleware = createMiddleware().server(async ({ next, request }) => {
  const reqAny = request as unknown as {
    runtime?: { cloudflare?: { env?: CfEnv } };
    context?: { cloudflare?: { env?: CfEnv } };
    env?: CfEnv;
  };

  const cfEnv =
    reqAny.runtime?.cloudflare?.env ||
    reqAny.context?.cloudflare?.env ||
    reqAny.env ||
    (globalThis as unknown as { __env__?: CfEnv }).__env__ ||
    {};

  if (cfEnv && typeof cfEnv === "object") {
    const g = globalThis as unknown as { __env__?: CfEnv };
    g.__env__ = Object.assign(g.__env__ || {}, cfEnv);
  }

  return await next({
    context: {
      env: cfEnv,
    },
  });
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [envMiddleware, errorMiddleware],
}));
