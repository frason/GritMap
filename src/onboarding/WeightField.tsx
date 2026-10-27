import { useState } from "react";
import { ActionSheetIOS, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Icon } from "../theme/Icon";
import { MIN_TOUCH_TARGET } from "../theme/layout";
import { radius, spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { useColors } from "../theme/useColors";
import { AppText } from "../theme/components";
import { fieldAccessibilityLabel } from "../theme/components/accessibility";
import { otherWeightUnit, weightUnitName, type WeightUnit } from "./riderNumbers";

const UNITS: readonly WeightUnit[] = ["lb", "kg"];

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  unit: WeightUnit;
  onUnitChange: (unit: WeightUnit) => void;
  error?: string;
  hint: string;
};

/**
 * The weight field with its unit as a tappable menu inside the box ("lb v"), so the unit is part of
 * the field it applies to and takes no row of its own. It looks like TextField (same box, label and
 * hint); it is separate only because TextField's unit is plain text.
 */
export function WeightField({ value, onChangeText, unit, onUnitChange, error, hint }: Props) {
  const palette = useColors();
  const [focused, setFocused] = useState(false);
  const borderColor = error !== undefined ? palette.statusDanger : focused ? palette.brand : palette.borderStrong;

  function chooseUnit() {
    if (Platform.OS !== "ios") {
      onUnitChange(otherWeightUnit(unit));
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Weight unit",
        options: [...UNITS.map((item) => `${weightUnitName(item)} (${item})`), "Cancel"],
        cancelButtonIndex: UNITS.length,
      },
      (index) => {
        const chosen = UNITS[index];
        if (chosen !== undefined) onUnitChange(chosen);
      },
    );
  }

  return (
    <View style={styles.container}>
      <AppText variant="subheadline" style={styles.label}>
        Weight
      </AppText>
      <View style={[styles.inputRow, { backgroundColor: palette.surface, borderColor, borderWidth: focused || error !== undefined ? 2 : 1 }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={unit === "lb" ? "e.g. 165" : "e.g. 75"}
          placeholderTextColor={palette.textTertiary}
          keyboardType="decimal-pad"
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={fieldAccessibilityLabel({ label: "Weight", unit: weightUnitName(unit), ...(error === undefined ? {} : { error }) })}
          accessibilityHint={hint}
          maxFontSizeMultiplier={typography.body.maxFontSizeMultiplier}
          style={[styles.input, { color: palette.textPrimary }]}
        />
        <Pressable
          onPress={chooseUnit}
          accessibilityRole="button"
          accessibilityLabel={`Weight unit, ${weightUnitName(unit)}`}
          accessibilityHint="Double tap to change"
          hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
          style={({ pressed }) => [styles.unit, { opacity: pressed ? 0.6 : 1 }]}
        >
          <AppText variant="body" color="brand" accessibilityElementsHidden importantForAccessibility="no">
            {unit}
          </AppText>
          <Icon name="chevronDown" size={16} color="brand" />
        </Pressable>
      </View>
      {error === undefined ? null : (
        <AppText variant="footnote" color="statusDanger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      )}
      <AppText variant="footnote" color="textSecondary">
        {hint}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.space4 },
  label: { fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: MIN_TOUCH_TARGET + 4,
    borderRadius: radius.md,
    paddingLeft: spacing.space16,
    paddingRight: spacing.space8,
    gap: spacing.space8,
  },
  input: {
    flex: 1,
    fontSize: typography.body.fontSize,
    paddingVertical: spacing.space12,
  },
  unit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.space4,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.space8,
  },
});
