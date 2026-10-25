import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "../Icon";
import type { IconName } from "../icons";
import { MIN_TOUCH_TARGET } from "../layout";
import { radius } from "../spacing";
import { useColors } from "../useColors";

export interface HeaderIconBarItem {
  icon: IconName;
  /** What VoiceOver says; required because these buttons have no visible text. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  testID?: string;
}

/**
 * The pill of icon buttons at the right of a tab's header (Home: add and settings; Rides: import and
 * filter; Segments: search and add). Each button is a 44 x 44 pt target; dividers sit between them.
 */
export function HeaderIconBar({ items }: { items: readonly HeaderIconBarItem[] }) {
  const palette = useColors();
  return (
    <View style={[styles.bar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {items.map((item, index) => (
        <Fragment key={item.accessibilityLabel}>
          {index === 0 ? null : <View style={[styles.divider, { backgroundColor: palette.border }]} />}
          <Pressable
            testID={item.testID}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={item.accessibilityLabel}
            {...(item.accessibilityHint === undefined ? {} : { accessibilityHint: item.accessibilityHint })}
            style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name={item.icon} size={22} color="textPrimary" />
          </Pressable>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", borderRadius: radius.pill, borderWidth: 1, overflow: "hidden" },
  item: { minWidth: MIN_TOUCH_TARGET + 2, minHeight: MIN_TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
  divider: { width: 1, height: 22 },
});
