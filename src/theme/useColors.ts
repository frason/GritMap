import { paletteForScheme, type ColorPalette } from "./colors";
import { useAppearance } from "./AppearanceProvider";

/**
 * Use this, not the static `colors` export, in anything new: it follows the rider's appearance
 * choice (system, light or dark; see AppearanceProvider.tsx). The default is to follow the phone
 * (DEFAULT_APPEARANCE in appearance.ts).
 */
export function useColors(): ColorPalette {
  return paletteForScheme(useAppearance().scheme);
}
