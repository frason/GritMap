// The rider's appearance choice: follow the phone (system), or always light or dark. Pure helpers,
// no React or storage, so the rules are unit-tested (appearance.test.ts).

export type AppearancePreference = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

export const APPEARANCE_SETTING_KEY = "appearance";

/**
 * What a rider with no saved choice gets. Light until every screen has moved to the themed
 * components; then change this one line to "system" to turn dark mode on for everyone who has not
 * chosen.
 */
export const DEFAULT_APPEARANCE: AppearancePreference = "light";

/** A saved value, or the default when it is missing or not one of ours (never throws). */
export function parseAppearance(stored: string | undefined): AppearancePreference {
  return stored === "system" || stored === "light" || stored === "dark" ? stored : DEFAULT_APPEARANCE;
}

/** The scheme to draw with: an explicit choice wins, "system" follows the phone, anything unknown is light. */
export function resolveScheme(preference: AppearancePreference, system: string | null | undefined): ColorScheme {
  if (preference === "light" || preference === "dark") return preference;
  return system === "dark" ? "dark" : "light";
}
