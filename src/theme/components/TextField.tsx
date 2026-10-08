import { useState } from "react";
import { StyleSheet, TextInput, View, type KeyboardTypeOptions, type ReturnKeyTypeOptions } from "react-native";
import { MIN_TOUCH_TARGET } from "../layout";
import { radius, spacing } from "../spacing";
import { typography } from "../typography";
import { useColors } from "../useColors";
import { AppText } from "./AppText";
import { fieldAccessibilityLabel } from "./accessibility";

type Props = {
  /** Always visible above the field. A placeholder is only an example, never the label. */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Help shown under the field, for things a stranger would not know ("Where do I find this?"). */
  hint?: string;
  /** Shown in red under the field and read out by VoiceOver. */
  error?: string;
  /** Spoken and shown beside the input, e.g. "watts". */
  unit?: string;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  maxLength?: number;
  /** A tall box for pasting or writing several lines (a plan, notes). */
  multiline?: boolean;
  testID?: string;
};

/** A labelled form field with hint, unit and error states, at least 48 pt tall. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  unit,
  keyboardType,
  returnKeyType,
  onSubmitEditing,
  autoCapitalize = "none",
  autoCorrect = false,
  maxLength,
  multiline = false,
  testID,
}: Props) {
  const palette = useColors();
  const [focused, setFocused] = useState(false);
  const borderColor = error !== undefined ? palette.statusDanger : focused ? palette.brand : palette.borderStrong;

  return (
    <View style={styles.container}>
      <AppText variant="subheadline" style={styles.label}>
        {label}
      </AppText>
      <View style={[styles.inputRow, { backgroundColor: palette.surface, borderColor, borderWidth: focused || error !== undefined ? 2 : 1 }]}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textTertiary}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          maxLength={maxLength}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={fieldAccessibilityLabel({ label, ...(unit === undefined ? {} : { unit }), ...(error === undefined ? {} : { error }) })}
          {...(hint === undefined ? {} : { accessibilityHint: hint })}
          maxFontSizeMultiplier={typography.body.maxFontSizeMultiplier}
          style={[styles.input, multiline ? styles.multiline : null, { color: palette.textPrimary }]}
        />
        {unit === undefined ? null : (
          <AppText variant="body" color="textSecondary" accessibilityElementsHidden importantForAccessibility="no">
            {unit}
          </AppText>
        )}
      </View>
      {error === undefined ? null : (
        <AppText variant="footnote" color="statusDanger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      )}
      {hint === undefined ? null : (
        <AppText variant="footnote" color="textSecondary">
          {hint}
        </AppText>
      )}
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
    paddingHorizontal: spacing.space16,
    gap: spacing.space8,
  },
  input: {
    flex: 1,
    fontSize: typography.body.fontSize,
    paddingVertical: spacing.space12,
  },
  multiline: { minHeight: 140, maxHeight: 280 },
});
