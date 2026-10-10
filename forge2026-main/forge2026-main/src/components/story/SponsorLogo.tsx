import { useCallback, useState, type ReactNode } from "react";

/**
 * A partner logo from public/partners/2025/, with a typographic fallback if
 * the artwork is missing.
 *
 * `onError` alone is not enough: the browser starts fetching while the server
 * HTML is still parsing, so a 404 can land before React attaches the handler.
 * The ref re-checks the load state on mount to catch that.
 */
export function SponsorLogo({
  file,
  name,
  className,
  fallback,
  lazy = true,
}: {
  file: string;
  name: string;
  className?: string;
  fallback: ReactNode;
  lazy?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const check = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return <>{fallback}</>;

  return (
    <img
      ref={check}
      src={`/partners/2025/${file}`}
      alt={name}
      loading={lazy ? "lazy" : undefined}
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
