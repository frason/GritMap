// Semantic color tokens, in a light and a dark palette with identical keys. Names mirror the
// "GritMap/Color" variable collection in the Figma mock (figma.com/design/cyaMDDfLBKFc4NNK1SUUnb)
// so a design change and a code change can be cross-referenced by name.
//
// Contrast is a rule, not a hope: src/theme/colors.test.ts asserts WCAG AA (4.5:1 for text, 3:1 for
// the borders of form controls) for every text/background pairing in BOTH palettes. The values below
// were tuned to pass it; if you change one, that test says which pairing broke.
//
// Which palette applies follows the system appearance via useColors() (useColors.ts). app.json
// currently sets "userInterfaceStyle": "light", so the app is light-only until every screen has been
// moved to useColors(); `colors` below is the light palette for the screens that still import it.

export const lightColors = {
  background: "#F4F5F7",
  surface: "#FFFFFF",
  /** Hairlines and card edges: decorative, not required to meet contrast. */
  border: "#E5E7EB",
  /** The edge of an interactive control (text field, outlined button): needs 3:1 against its surroundings. */
  borderStrong: "#7C8493",

  textPrimary: "#15181D",
  textSecondary: "#4B5563",
  /** Hints and placeholders. Still meets 4.5:1, so it is safe for real information. */
  textTertiary: "#646B78",
  textOnBrand: "#FFFFFF",

  /** Brand teal for text links, icons and the active tab. */
  brand: "#0F766E",
  /** Brand teal for filled surfaces (buttons) that carry `textOnBrand`. */
  brandFill: "#0F766E",
  brandSubtle: "#E6F4F2",

  statusSuccess: "#166534",
  statusSuccessSubtle: "#E7F6EC",
  statusWarning: "#92400E",
  statusWarningSubtle: "#FDF1DF",
  statusDanger: "#B91C1C",
  statusDangerSubtle: "#FBE9E9",
  statusInfo: "#1D4ED8",
  statusInfoSubtle: "#E8EFFD",

  disabledBackground: "#E9EAEC",
  disabledText: "#5F6672",
} as const;

export type ColorToken = keyof typeof lightColors;
export type ColorPalette = { readonly [Token in ColorToken]: string };

export const darkColors: ColorPalette = {
  background: "#0B0E12",
  surface: "#161A20",
  border: "#2A303A",
  borderStrong: "#7A8392",

  textPrimary: "#F3F4F6",
  textSecondary: "#AEB4BE",
  textTertiary: "#8B93A0",
  textOnBrand: "#FFFFFF",

  brand: "#2DD4BF",
  brandFill: "#0F766E",
  brandSubtle: "#12302D",

  statusSuccess: "#4ADE80",
  statusSuccessSubtle: "#12301C",
  statusWarning: "#FBBF24",
  statusWarningSubtle: "#33260B",
  statusDanger: "#F87171",
  statusDangerSubtle: "#381414",
  statusInfo: "#60A5FA",
  statusInfoSubtle: "#13233F",

  disabledBackground: "#1F242C",
  disabledText: "#8B93A0",
};

/** The light palette, kept under its original name for screens not yet moved to useColors(). */
export const colors: ColorPalette = lightColors;

/** The palette for a system appearance; anything but "dark" (including unknown) is light. */
export function paletteForScheme(scheme: string | null | undefined): ColorPalette {
  return scheme === "dark" ? darkColors : lightColors;
}
