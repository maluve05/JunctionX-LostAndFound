import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/*
  Cloudflare Turnstile: the check that the application comes from a person.
  Loaded only on /apply, only when the last step shows it.

  The loader script carries this page's CSP nonce (Turnstile passes it on to
  anything it loads), so the policy only has to allow Turnstile's iframe
  (frame-src, set for /apply in src/lib/security.ts). A token is valid for
  one try and five minutes; the widget fetches a new one on its own when it
  expires, and `reset()` asks for one after a failed send.
*/

type Api = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
};

declare global {
  interface Window {
    turnstile?: Api;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<Api> | null = null;

function load(): Promise<Api> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Api>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
    if (nonce) script.nonce = nonce;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error()));
    script.onerror = () => {
      loading = null;
      reject(new Error("Turnstile did not load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type TurnstileHandle = { reset(): void };

export const Turnstile = forwardRef<
  TurnstileHandle,
  { siteKey: string; onToken: (token: string | null) => void; className?: string }
>(function Turnstile({ siteKey, onToken, className }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
      onToken(null);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    load()
      .then((api) => {
        if (cancelled || !box.current) return;
        widget.current = api.render(box.current, {
          sitekey: siteKey,
          action: "apply",
          theme: "dark",
          size: "flexible",
          "refresh-expired": "auto",
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, onToken]);

  return <div ref={box} className={className} />;
});
