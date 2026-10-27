import type { ColorPalette } from "../colors.ts";

/**
 * A chip is a small label that says one thing: a state ("On Karoo"), a result ("New PR"), a filter
 * or a plan intensity. The tone says what kind of thing it is, so the colour carries meaning
 * consistently across screens.
 *
 * - neutral: quiet information ("No plan yet").
 * - cta: interactive or informational emphasis; solid is the strongest ("New PR", the selected filter).
 * - rest, hold, push, max: how hard a plan stretch asks you to ride.
 * - success, warning, danger, info: status; use for outcomes, not for intensity.
 */
export type ChipTone = "neutral" | "cta" | "solid" | "rest" | "hold" | "push" | "max" | "success" | "warning" | "danger" | "info";

export interface ChipColors {
  background: string;
  text: string;
  /** "transparent" for every tone except neutral, which has a hairline so it still reads as a chip. */
  border: string;
}

export function resolveChipColors(palette: ColorPalette, tone: ChipTone): ChipColors {
  const tint = (text: string, background: string): ChipColors => ({ background, text, border: "transparent" });
  switch (tone) {
    case "neutral":
      return { background: palette.surfaceRaised, text: palette.textSecondary, border: palette.border };
    case "cta":
      return tint(palette.ctaText, palette.ctaSubtle);
    case "solid":
      return tint(palette.textOnCta, palette.cta);
    case "rest":
      return tint(palette.intensityRest, palette.intensityRestSubtle);
    case "hold":
      return tint(palette.intensityHold, palette.intensityHoldSubtle);
    case "push":
      return tint(palette.intensityPush, palette.intensityPushSubtle);
    case "max":
      return tint(palette.intensityMax, palette.intensityMaxSubtle);
    case "success":
      return tint(palette.statusSuccess, palette.statusSuccessSubtle);
    case "warning":
      return tint(palette.statusWarning, palette.statusWarningSubtle);
    case "danger":
      return tint(palette.statusDanger, palette.statusDangerSubtle);
    case "info":
      return tint(palette.statusInfo, palette.statusInfoSubtle);
  }
}

/** What VoiceOver says for a chip that is a button: the label, and "selected" when it is a chosen filter. */
export function chipAccessibilityLabel(label: string, selected: boolean | undefined): string {
  return selected === true ? `${label}, selected` : label;
}
