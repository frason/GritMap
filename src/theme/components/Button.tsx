import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Icon } from "../Icon";
import type { IconName } from "../icons";
import { MIN_TOUCH_TARGET, PRIMARY_BUTTON_HEIGHT } from "../layout";
import { radius, spacing } from "../spacing";
import { useColors } from "../useColors";
import { AppText } from "./AppText";
import { buttonAccessibility, resolveButtonColors, type ButtonVariant } from "./buttonStyle";

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  /** Shows a spinner and ignores taps; VoiceOver reads it as in progress. */
  loading?: boolean;
  /** Stretch to the container's width (the default for primary actions). */
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

/** A touch target of at least 44 pt (50 pt for filled buttons), with the variant's contrast-checked colors. */
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  loading = false,
  fullWidth = true,
  accessibilityHint,
  testID,
}: Props) {
  const palette = useColors();
  const inactive = disabled || loading;
  const colors = resolveButtonColors(palette, variant, disabled);
  const filled = variant === "primary" || variant === "destructive";

  return (
    <Pressable
      testID={testID}
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      {...buttonAccessibility({
        label,
        disabled,
        loading,
        ...(accessibilityHint === undefined ? {} : { hint: accessibilityHint }),
      })}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: filled ? PRIMARY_BUTTON_HEIGHT : MIN_TOUCH_TARGET,
          backgroundColor: colors.background,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : icon === undefined ? null : (
          <Icon name={icon} size={20} color={variant === "primary" && !disabled ? "textOnBrand" : variant === "destructive" && !disabled ? "statusDanger" : disabled ? "disabledText" : "brand"} />
        )}
        <AppText variant="headline" style={{ color: colors.text }} align="center">
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.space16,
    paddingVertical: spacing.space12,
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.space8,
  },
});
