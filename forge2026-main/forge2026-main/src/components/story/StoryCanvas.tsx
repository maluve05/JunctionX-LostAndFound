import { useEffect, useRef } from "react";
import { stage } from "./stage";

/**
 * The one canvas behind every page. It lives in the root layout, so the scene
 * survives page changes: moving from the home page to /builders, the shards
 * fly from where they were into the new page's first formation.
 */
export function StoryCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) stage.start(ref.current);
  }, []);

  return (
    <>
      <canvas ref={ref} aria-hidden="true" className="story-canvas" />
      <div aria-hidden="true" className="story-vignette" />
    </>
  );
}
