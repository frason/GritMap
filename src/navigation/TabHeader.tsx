import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SCREEN_PADDING } from "../theme/layout";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { AppText } from "../theme/components/AppText";
import { HeaderIconBar, type HeaderIconBarItem } from "../theme/components/HeaderIconBar";

/**
 * The header of a tab's first page: a large title at the left and a pill of icon buttons at the
 * right. Pushed pages (a ride, a segment) keep the standard iOS back-button header instead.
 */
export function TabHeader({ title, items }: { title: string; items: readonly HeaderIconBarItem[] }) {
  const palette = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.space8, backgroundColor: palette.background }]}>
      <View style={styles.title}>
        <AppText variant="title1" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      <HeaderIconBar items={items} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.space8, paddingHorizontal: SCREEN_PADDING, paddingBottom: spacing.space8 },
  title: { flex: 1 },
});
