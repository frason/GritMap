import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../theme/components";
import { Icon } from "../theme/Icon";
import { MIN_TOUCH_TARGET } from "../theme/layout";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { RidePreviewThumbnail } from "../screens/RidePreviewThumbnail";
import type { PreviewPoint } from "./segmentListView";

const THUMB = 48;

/** A segment found on a ride: a round thumbnail of its course, its name and the ride's time on it. */
export function RideSegmentRow({ title, subtitle, course, onPress }: { title: string; subtitle: string; course: readonly PreviewPoint[]; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityHint="Opens this segment"
      style={[styles.row, { borderColor: colors.border }]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong }]} accessible={false} importantForAccessibility="no-hide-descendants">
        {course.length >= 2 ? <RidePreviewThumbnail points={course} size={THUMB} strokeWidth={2.5} /> : <Icon name="mapPin" size={20} color="textTertiary" />}
      </View>
      <View style={styles.text}>
        <AppText variant="body">{title}</AppText>
        <AppText variant="subheadline" color="textSecondary">
          {subtitle}
        </AppText>
      </View>
      <Icon name="chevronRight" size={18} color="textTertiary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: MIN_TOUCH_TARGET, flexDirection: "row", alignItems: "center", gap: spacing.space12, paddingVertical: spacing.space8, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, overflow: "hidden", borderWidth: 1, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
});
