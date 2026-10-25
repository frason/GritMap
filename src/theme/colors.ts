// Semantic colour tokens, in a light and a dark palette with identical keys. Names mirror the
// "GritMap v2/Color" variable collection in the Figma file (figma.com/design/cyaMDDfLBKFc4NNK1SUUnb)
// so a design change and a code change can be cross-referenced by name: `textOnCta` is
// `color/text-on-cta`, `intensityHoldSubtle` is `color/intensity-hold-subtle`, and so on.
//
// Values come from the primitives in palette.ts; nothing here is a hex literal. To change how the
// app looks, edit palette.ts (a rebrand) or repoint a token here (a role change). Screens and
// components only ever name tokens, never colours.
//
// Contrast is a rule, not a hope: src/theme/colors.test.ts asserts WCAG AA (4.5:1 for text, 3:1 for
// the borders of form controls) for every text/background pairing in BOTH palettes. If you change a
// step, that test says which pairing broke.
//
// Which palette applies follows the rider's appearance setting (light, dark or system) via
// useColors() (useColors.ts and AppearanceProvider.tsx). `colors` below is the light palette for the
// screens that still import it directly; they are moved to useColors() as each screen is rebuilt.

import { palette } from "./palette.ts";

const { blue, slate, cyan, emerald, orange, green, amber, red, info } = palette;

export const lightColors = {
  background: slate[50],
  surface: palette.white,
  /** Cards that sit on a card, sheets and menus. Same as surface in light; lifted in dark. */
  surfaceRaised: palette.white,
  /** Hairlines and card edges: decorative, not required to meet contrast. */
  border: slate[200],
  /** The edge of an interactive control (text field, outlined button): needs 3:1 against its surroundings. */
  borderStrong: slate[450],

  textPrimary: slate[950],
  textSecondary: slate[600],
  /** Hints and placeholders. Still meets 4.5:1, so it is safe for real information. */
  textTertiary: slate[500],

  /** The interactive fill: primary buttons, selected controls, the "solid" chip. */
  cta: blue[600],
  ctaPressed: blue[700],
  /** A quiet interactive tint: selected rows, info panels, the "cta" chip. */
  ctaSubtle: blue[50],
  /** Text and icons on `cta`. */
  textOnCta: palette.white,
  /** Interactive colour for text, links, icons and the active tab: lighter than `cta` in dark so it reads on black. */
  ctaText: blue[600],

  /** How hard a stretch of a plan asks you to ride. Text/icons use the strong colour, backgrounds the subtle one. */
  intensityRest: cyan[700],
  intensityRestSubtle: cyan[50],
  intensityHold: emerald[700],
  intensityHoldSubtle: emerald[50],
  intensityPush: orange[700],
  intensityPushSubtle: orange[50],
  intensityMax: red[700],
  intensityMaxSubtle: red[50],

  statusSuccess: green[800],
  statusSuccessSubtle: green[50],
  statusWarning: amber[800],
  statusWarningSubtle: amber[50],
  statusDanger: red[700],
  statusDangerSubtle: red[50],
  statusInfo: info[700],
  statusInfoSubtle: info[50],

  disabledBackground: slate[100],
  disabledText: slate[550],

  /** Chart ink and gridlines. */
  chartLine: slate[950],
  chartGrid: slate[200],
  /** Behind sheets and dialogs; used at partial opacity. */
  scrim: palette.black,

  /** @deprecated Old names for the interactive colour, kept so existing screens keep working until they are rebuilt. Use `ctaText`. */
  brand: blue[600],
  /** @deprecated Use `cta`. */
  brandFill: blue[600],
  /** @deprecated Use `ctaSubtle`. */
  brandSubtle: blue[50],
  /** @deprecated Use `textOnCta`. */
  textOnBrand: palette.white,
} as const;

export type ColorToken = keyof typeof lightColors;
export type ColorPalette = { readonly [Token in ColorToken]: string };

export const darkColors: ColorPalette = {
  background: palette.black,
  surface: slate[900],
  surfaceRaised: slate[850],
  border: slate[750],
  borderStrong: slate[450],

  textPrimary: slate[50],
  textSecondary: slate[300],
  textTertiary: slate[400],

  cta: blue[500],
  ctaPressed: blue[800],
  ctaSubtle: blue[950],
  textOnCta: palette.white,
  ctaText: blue[400],

  intensityRest: cyan[400],
  intensityRestSubtle: cyan[950],
  intensityHold: emerald[400],
  intensityHoldSubtle: emerald[950],
  intensityPush: orange[400],
  intensityPushSubtle: orange[950],
  intensityMax: red[400],
  intensityMaxSubtle: red[950],

  statusSuccess: green[400],
  statusSuccessSubtle: green[950],
  statusWarning: amber[400],
  statusWarningSubtle: amber[950],
  statusDanger: red[400],
  statusDangerSubtle: red[950],
  statusInfo: info[400],
  statusInfoSubtle: info[950],

  disabledBackground: slate[800],
  disabledText: slate[400],

  chartLine: slate[50],
  chartGrid: slate[750],
  scrim: palette.black,

  brand: blue[400],
  brandFill: blue[500],
  brandSubtle: blue[950],
  textOnBrand: palette.white,
};

/** The light palette, kept under its original name for screens not yet moved to useColors(). */
export const colors: ColorPalette = lightColors;

/** The palette for a system appearance; anything but "dark" (including unknown) is light. */
export function paletteForScheme(scheme: string | null | undefined): ColorPalette {
  return scheme === "dark" ? darkColors : lightColors;
}
