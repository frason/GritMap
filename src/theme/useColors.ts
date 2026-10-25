import { paletteForScheme, type ColorPalette } from "./colors";
import { useAppearance } from "./AppearanceProvider";

/**
 * Use this, not the static `colors` export, in anything new: it follows the rider's appearance
 * choice (light, dark or system; see AppearanceProvider.tsx). Until every screen has moved to it the
 * default choice is light (DEFAULT_APPEARANCE in appearance.ts), so today it returns the light
 * palette unless a rider has chosen otherwise.
 */
export function useColors(): ColorPalette {
  return paletteForScheme(useAppearance().scheme);
}
