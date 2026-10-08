import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { radius, spacing } from "../spacing";
import { useColors } from "../useColors";

type Props = {
  children: ReactNode;
  /** Makes the whole card one button. Give it an accessibilityLabel that reads as a sentence. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
};

/** A raised group of related content on the screen background. */
export function Card({ children, onPress, accessibilityLabel, accessibilityHint, style }: Props) {
  const palette = useColors();
  const base = [styles.card, { backgroundColor: palette.surface, borderColor: palette.border }, style];
  if (onPress === undefined) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      {...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
      {...(accessibilityHint === undefined ? {} : { accessibilityHint })}
      style={({ pressed }) => [...base, { opacity: pressed ? 0.85 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.space16,
    gap: spacing.space12,
  },
});
