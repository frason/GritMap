import { useColorScheme } from "react-native";
import { paletteForScheme, type ColorPalette } from "./colors";

/**
 * Use this, not the static `colors` export, in anything new: it follows the system appearance.
 * (app.json pins the app to light until every screen has moved to it, so today it always returns
 * the light palette; switching "userInterfaceStyle" to "automatic" turns dark mode on.)
 */
export function useColors(): ColorPalette {
  return paletteForScheme(useColorScheme());
}
