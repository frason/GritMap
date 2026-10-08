import type { ColorPalette } from "../colors.ts";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";

export interface ButtonColors {
  background: string;
  border: string;
  text: string;
}

/**
 * The colors for a button in a given variant and state, from the active palette. Pure, so the
 * contrast of every variant (including disabled) is covered by a test in both palettes.
 *
 * - primary: filled brand, for the one action a screen wants taken.
 * - secondary: outlined, for an alternative.
 * - tertiary: text only, for low-emphasis actions such as "Skip".
 * - destructive: tinted red, for removing something. Tinted rather than solid red because white on
 *   the dark palette's red does not meet contrast.
 */
export function resolveButtonColors(palette: ColorPalette, variant: ButtonVariant, disabled: boolean): ButtonColors {
  if (disabled) {
    return {
      background: variant === "tertiary" ? "transparent" : palette.disabledBackground,
      border: "transparent",
      text: palette.disabledText,
    };
  }
  switch (variant) {
    case "primary":
      return { background: palette.brandFill, border: "transparent", text: palette.textOnBrand };
    case "secondary":
      return { background: "transparent", border: palette.brand, text: palette.brand };
    case "tertiary":
      return { background: "transparent", border: "transparent", text: palette.brand };
    case "destructive":
      return { background: palette.statusDangerSubtle, border: "transparent", text: palette.statusDanger };
  }
}

export interface ButtonAccessibility {
  accessibilityRole: "button";
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityState: { disabled: boolean; busy: boolean };
}

/** VoiceOver description of a button: loading reads as busy, and a busy or disabled button is not actionable. */
export function buttonAccessibility(input: {
  label: string;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
}): ButtonAccessibility {
  const loading = input.loading === true;
  return {
    accessibilityRole: "button",
    accessibilityLabel: loading ? `${input.label}, in progress` : input.label,
    ...(input.hint === undefined ? {} : { accessibilityHint: input.hint }),
    accessibilityState: { disabled: input.disabled === true || loading, busy: loading },
  };
}
