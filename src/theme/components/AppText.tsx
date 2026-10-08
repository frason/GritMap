import { Text, type TextProps } from "react-native";
import type { ColorToken } from "../colors";
import { typography, type TypographyVariant } from "../typography";
import { useColors } from "../useColors";

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: ColorToken;
  align?: "left" | "center" | "right";
};

/**
 * The one way to put text on screen in new code: a type-scale variant plus a color token, so size,
 * weight, line height, Dynamic Type cap and contrast-checked color all come from the design system.
 */
export function AppText({ variant = "body", color = "textPrimary", align, style, ...rest }: Props) {
  const palette = useColors();
  const { fontSize, lineHeight, fontWeight, maxFontSizeMultiplier } = typography[variant];
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={[{ fontSize, lineHeight, fontWeight, color: palette[color] }, align === undefined ? null : { textAlign: align }, style]}
    />
  );
}
