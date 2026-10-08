import { Pressable, StyleSheet, View } from "react-native";
import { MIN_TOUCH_TARGET } from "../layout";
import { radius, spacing } from "../spacing";
import { useColors } from "../useColors";
import { AppText } from "./AppText";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** What VoiceOver says; defaults to the label. Use it to spell out abbreviations ("Pounds" for "lb"). */
  accessibilityLabel?: string;
}

type Props<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for VoiceOver ("Weight unit"). */
  accessibilityLabel: string;
};

/** Pick exactly one of a few short options. Each is at least 44 pt tall and announced as a radio button. */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const palette = useColors();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            style={[
              styles.option,
              {
                backgroundColor: selected ? palette.brandFill : palette.surface,
                borderColor: selected ? palette.brandFill : palette.borderStrong,
              },
            ]}
          >
            <AppText variant="headline" style={{ color: selected ? palette.textOnBrand : palette.textPrimary }}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.space8 },
  option: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
