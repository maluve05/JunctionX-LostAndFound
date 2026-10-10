/**
 * A light tap in the hand. Android browsers vibrate; Safari on iPhone has no
 * vibration API, but since iOS 18 toggling a switch control plays its system
 * haptic, so a hidden one is toggled instead. Anywhere else it does nothing.
 * Call it from inside a tap handler.
 */
export function haptic(ms = 10) {
  if (typeof navigator === "undefined") return;
  // Not every browser has it, whatever the DOM types say (Safari doesn't).
  const nav = navigator as Omit<Navigator, "vibrate"> & { vibrate?: Navigator["vibrate"] };
  if (typeof nav.vibrate === "function") {
    try {
      nav.vibrate(ms);
    } catch {
      // Some browsers refuse it; it's a nicety.
    }
    return;
  }
  if (!/iPhone/.test(nav.userAgent)) return;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText =
    "position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  label.click();
  label.remove();
}
