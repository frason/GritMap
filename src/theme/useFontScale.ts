import { useSyncExternalStore } from "react";
import { Dimensions, PixelRatio } from "react-native";

function subscribe(onChange: () => void): () => void {
  const subscription = Dimensions.addEventListener("change", onChange);
  return () => subscription.remove();
}

/**
 * The rider's current text-size setting (1 at the default size), kept live. React Native tells
 * JavaScript when the setting changes mid-session (a Control Center text-size slider), but text that
 * is already on screen keeps the layout it measured at the old size and shows squeezed, clipped
 * lines until the app is relaunched. Components use this as a `key` so their text is rebuilt, and
 * therefore re-measured, when the size changes.
 */
export function useFontScale(): number {
  return useSyncExternalStore(subscribe, () => PixelRatio.getFontScale());
}
