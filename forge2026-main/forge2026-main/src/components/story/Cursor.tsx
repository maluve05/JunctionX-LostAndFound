import { useEffect, useRef } from "react";
import { fx } from "./fx";
import { interactions } from "./interact";

/**
 * The FORGe cursor: a crystal shard whose tip is the pointer, and a tag that
 * names what a click will do. Driven by `interactions` (see shardCursor.ts);
 * it only appears with a mouse, and never for reduced motion, where the
 * system cursor stays.
 */
export function Cursor() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tag = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!canvas.current || !tag.current) return;
    interactions.registerCursor({ canvas: canvas.current, tag: tag.current });
    return () => interactions.registerCursor(null);
  }, []);

  return (
    <div className="cursor" aria-hidden="true">
      <canvas ref={canvas} className="cursor-shard" />
      <span ref={tag} className="cursor-tag" />
    </div>
  );
}

/** The layer sparks fly on, over everything, on every device. */
export function FxLayer() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    fx.mount(ref.current);
    return () => fx.unmount();
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="fx-layer" />;
}
