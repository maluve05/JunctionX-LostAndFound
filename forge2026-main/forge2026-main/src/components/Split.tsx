import { memo, Suspense, use, type ComponentType, type ReactNode } from "react";
import { layout, type Mode } from "./layout";

/** Builds that have been shown at least once in this visit. They stay mounted after. */
const woken: Record<Mode, boolean> = { phone: false, wide: false };

function Gate({ mode, children }: { mode: Mode; children: ReactNode }) {
  if (typeof window !== "undefined" && !woken[mode]) {
    // Suspending here, during hydration, leaves the server's HTML for this
    // build in place without hydrating it; on a later render it renders
    // nothing. Either way it waits until the screen fits it.
    if (layout.mode !== mode) use(layout.until(mode));
    woken[mode] = true;
  }
  return children;
}

/**
 * Renders `of` only in the build for `mode`. Pass a component, not children:
 * the props never change, so an unwoken build is never disturbed by a
 * re-render above it.
 */
export const Only = memo(function Only({ mode, of: Of }: { mode: Mode; of: ComponentType }) {
  return (
    <Suspense fallback={null}>
      <Gate mode={mode}>
        <div className={mode === "phone" ? "only-phone" : "only-wide"}>
          <Of />
        </div>
      </Gate>
    </Suspense>
  );
});

/** A page with a phone build and a wide build. */
export function Split({ phone, wide }: { phone: ComponentType; wide: ComponentType }) {
  return (
    <>
      <Only mode="phone" of={phone} />
      <Only mode="wide" of={wide} />
    </>
  );
}
