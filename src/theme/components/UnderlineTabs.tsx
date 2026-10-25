import { Pressable, StyleSheet, View } from "react-native";
import { MIN_TOUCH_TARGET } from "../layout";
import { spacing } from "../spacing";
import { useColors } from "../useColors";
import { AppText } from "./AppText";

export type UnderlineTab<Key extends string> = { key: Key; label: string };

type Props<Key extends string> = {
  tabs: readonly UnderlineTab<Key>[];
  selected: Key;
  onSelect: (key: Key) => void;
};

/** Text tabs with an underline under the open one: the Plan / Efforts / Course switch on a segment. */
export function UnderlineTabs<Key extends string>({ tabs, selected, onSelect }: Props<Key>) {
  const palette = useColors();
  return (
    <View accessibilityRole="tablist" style={[styles.row, { borderBottomColor: palette.border }]}>
      {tabs.map((tab) => {
        const active = tab.key === selected;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => onSelect(tab.key)}
            style={[styles.tab, { borderBottomColor: active ? palette.ctaText : "transparent" }]}
          >
            <AppText variant="subheadlineEmphasized" color={active ? "ctaText" : "textSecondary"}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: MIN_TOUCH_TARGET, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, paddingHorizontal: spacing.space8 },
});
