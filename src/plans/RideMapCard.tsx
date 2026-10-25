import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import type { RideSummary } from "../db/listRides";
import { AppText, Card, Chip } from "../theme/components";
import { Icon } from "../theme/Icon";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { formatDistanceMiles, formatDurationHoursMinutes, formatDurationMinutesSeconds, formatRideDate } from "../screens/formatRideStats";
import { RidePreviewThumbnail } from "../screens/RidePreviewThumbnail";
import type { RideSegmentHighlight } from "./karooMarks";

const MAP_HEIGHT = 168;

/**
 * A ride as a large map rectangle with a caption strip, and below it the segments you sent to a Karoo that this ride
 * went over, with a personal best called out. (Drawing the segments on the map itself is a later step.)
 */
export function RideMapCard({ ride, highlights, onPress }: { ride: RideSummary; highlights: readonly RideSegmentHighlight[]; onPress: () => void }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const title = ride.startTimestampMs === undefined ? ride.originalFilename : formatRideDate(ride.startTimestampMs);
  const caption = `${formatDistanceMiles(ride.totalDistanceMeters)} · ${formatDurationHoursMinutes(ride.durationMs)}`;
  const pr = highlights.some((h) => h.personalBest);
  const label = [title, caption, ...highlights.map((h) => `${h.name} ${formatDurationMinutesSeconds(h.durationMs)}${h.personalBest ? ", personal best" : ""}`)].join(". ");
  return (
    <Card onPress={onPress} accessibilityLabel={label} accessibilityHint="Opens this ride" style={styles.card}>
      <View style={[styles.map, { backgroundColor: colors.surfaceRaised }]} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        {ride.previewPolyline !== undefined && ride.previewPolyline.length >= 2 && width > 0 ? (
          <RidePreviewThumbnail points={ride.previewPolyline} width={width} height={MAP_HEIGHT} strokeWidth={3} />
        ) : (
          <Icon name="route" color="textTertiary" size={32} />
        )}
      </View>
      <View style={styles.caption}>
        <View style={styles.captionText}>
          <AppText variant="headline">{title}</AppText>
          <AppText variant="footnote" color="textSecondary">{caption}</AppText>
        </View>
        {pr ? <Chip label="Personal best" tone="solid" icon="trophy" /> : null}
      </View>
      {highlights.length === 0 ? null : (
        <View style={styles.highlights}>
          {highlights.map((h) => (
            <Chip key={h.segmentId} label={`${h.name} ${formatDurationMinutesSeconds(h.durationMs)}`} tone={h.personalBest ? "success" : "neutral"} icon={h.personalBest ? "trophy" : "mapPin"} />
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: "hidden", gap: 0 },
  map: { height: MAP_HEIGHT, alignItems: "center", justifyContent: "center" },
  caption: { flexDirection: "row", alignItems: "center", gap: spacing.space8, padding: spacing.space16 },
  captionText: { flex: 1, gap: 2 },
  highlights: { flexDirection: "row", flexWrap: "wrap", gap: spacing.space8, paddingHorizontal: spacing.space16, paddingBottom: spacing.space16 },
});
