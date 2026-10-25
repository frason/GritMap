import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "../Icon";
import type { IconName } from "../icons";
import { radius, spacing } from "../spacing";
import { useColors } from "../useColors";
import { AppText } from "./AppText";
import { chipAccessibilityLabel, resolveChipColors, type ChipTone } from "./chipStyle";

type Props = {
  label: string;
  tone?: ChipTone;
  icon?: IconName;
  /** For a filter chip: true draws it solid, false draws it in `tone`. Leave undefined for a plain label. */
  selected?: boolean;
  /** Makes the chip a button (a filter or an action). It keeps a 44 pt touch area around the small chip. */
  onPress?: () => void;
  accessibilityHint?: string;
  testID?: string;
};

/** A small label for a state, a result, a filter or a plan intensity. See chipStyle.ts for what each tone means. */
export function Chip({ label, tone = "neutral", icon, selected, onPress, accessibilityHint, testID }: Props) {
  const palette = useColors();
  const colors = resolveChipColors(palette, selected === true ? "solid" : tone);
  const body = (
    <View style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
      {icon === undefined ? null : <Icon name={icon} size={14} color="textPrimary" />}
      <AppText variant="footnoteEmphasized" style={{ color: colors.text }}>
        {label}
      </AppText>
    </View>
  );

  if (onPress === undefined) {
    return (
      <View testID={testID} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={{ top: 9, bottom: 9, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={chipAccessibilityLabel(label, selected)}
      accessibilityState={{ selected: selected === true }}
      {...(accessibilityHint === undefined ? {} : { accessibilityHint })}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.space4,
    paddingVertical: spacing.space4,
    paddingHorizontal: spacing.space10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
