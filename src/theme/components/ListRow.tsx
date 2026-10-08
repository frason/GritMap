import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "../Icon";
import type { IconName } from "../icons";
import { MIN_TOUCH_TARGET } from "../layout";
import { spacing } from "../spacing";
import { useColors } from "../useColors";
import { AppText } from "./AppText";
import { rowAccessibilityLabel } from "./accessibility";

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** A short value on the right, such as "Not set". */
  value?: string;
  /** Makes the row a button; a chevron is shown unless `showChevron` is false. */
  onPress?: () => void;
  showChevron?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

/** A tappable (or static) row: icon, title and subtitle, optional value, chevron. At least 44 pt tall. */
export function ListRow({ title, subtitle, icon, value, onPress, showChevron = true, accessibilityHint, testID }: Props) {
  const palette = useColors();
  const content = (
    <View style={styles.row}>
      {icon === undefined ? null : <Icon name={icon} size={22} color="brand" />}
      <View style={styles.text}>
        <AppText variant="body">{title}</AppText>
        {subtitle === undefined ? null : (
          <AppText variant="subheadline" color="textSecondary">
            {subtitle}
          </AppText>
        )}
      </View>
      {value === undefined ? null : (
        <AppText variant="body" color="textSecondary">
          {value}
        </AppText>
      )}
      {onPress !== undefined && showChevron ? <Icon name="chevronRight" size={18} color="textTertiary" /> : null}
    </View>
  );

  if (onPress === undefined) {
    return (
      <View testID={testID} accessible accessibilityLabel={rowAccessibilityLabel([title, subtitle, value])} style={[styles.container, { borderColor: palette.border }]}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rowAccessibilityLabel([title, subtitle, value])}
      {...(accessibilityHint === undefined ? {} : { accessibilityHint })}
      style={({ pressed }) => [styles.container, { borderColor: palette.border, opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    paddingVertical: spacing.space12,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space12,
  },
  text: {
    flex: 1,
    gap: spacing.space2,
  },
});
