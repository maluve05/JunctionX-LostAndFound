import { lazy, Suspense, useEffect, useState } from "react";
import { layout } from "../layout";
import { StoryCanvas } from "./StoryCanvas";
import { SiteHeader } from "./chrome";
import { Cursor, FxLayer } from "./Cursor";
import { ForgeIntro } from "./ForgeIntro";
import { watchKonami } from "./eggs";
import { stage } from "./stage";

// Button scenes only exist for a mouse, so touch screens never download them.
const ScenesInButtons = lazy(() => import("./Glyphs").then((m) => ({ default: m.ButtonScenes })));

function ButtonScenes() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);
  return on ? (
    <Suspense fallback={null}>
      <ScenesInButtons />
    </Suspense>
  ) : null;
}

/**
 * Everything the 3D story keeps on screen across pages: the canvas, the
 * header, the loading intro, the sparks layer, button scenes and the cursor.
 * Wide screens only (see components/layout.tsx); the phone build has its own
 * chrome. If the window is narrowed to phone width, the scene stops drawing.
 */
export function WideChrome() {
  useEffect(() => layout.onChange((mode) => stage.cover("narrow", mode === "phone")), []);
  // A secret (eggs.ts): the Konami code turns the night shift on and off.
  useEffect(() => watchKonami(), []);

  return (
    <>
      <StoryCanvas />
      <SiteHeader />
      <ForgeIntro />
      <FxLayer />
      <ButtonScenes />
      <Cursor />
    </>
  );
}
