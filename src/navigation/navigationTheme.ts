import type { ColorPalette } from "../theme/colors.ts";

/** The colours React Navigation draws its own chrome with (tab bar, headers, back buttons), from our tokens. */
export interface NavigationColors {
  primary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  notification: string;
}

export function navigationColors(palette: ColorPalette): NavigationColors {
  return {
    primary: palette.ctaText,
    background: palette.background,
    card: palette.surface,
    text: palette.textPrimary,
    border: palette.border,
    notification: palette.statusDanger,
  };
}
