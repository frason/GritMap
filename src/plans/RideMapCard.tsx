import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import type { RideSummary } from "../db/listRides";
import { AppText, Card, Chip } from "../theme/components";
import { Icon } from "../theme/Icon";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { formatDistanceMiles, formatDurationHoursMinutes, formatDurationMinutesSeconds, formatElevationFeet, formatRideDate, rideTitle } from "../screens/formatRideStats";
import { RidePreviewThumbnail } from "../screens/RidePreviewThumbnail";
import type { RideSegmentHighlight } from "./karooMarks";
import type { PreviewPoint } from "./segmentListView";

const MAP_HEIGHT = 168;

/**
 * A ride as a route-line rectangle (no map tiles) with the segment efforts drawn over the line, then a caption: the
 * ride's name (or "Sat morning ride"), its date, distance, time, climbing and segment count. Below it, the segments
 * sent to a Karoo that this ride went over, with a personal best called out.
 */
export function RideMapCard({ ride, highlights, segmentLines = [], onPress }: { ride: RideSummary; highlights: readonly RideSegmentHighlight[]; segmentLines?: readonly (readonly PreviewPoint[])[]; onPress: () => void }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const title = rideTitle(ride);
  const segmentsLabel = ride.segmentCount === 0 ? undefined : `${ride.segmentCount} ${ride.segmentCount === 1 ? "segment" : "segments"}`;
  const caption = [
    ride.startTimestampMs === undefined ? undefined : formatRideDate(ride.startTimestampMs),
    `${formatDistanceMiles(ride.totalDistanceMeters)} · ${formatDurationHoursMinutes(ride.durationMs)}`,
    ride.totalAscentMeters === undefined ? undefined : `${formatElevationFeet(ride.totalAscentMeters)} climbing`,
    segmentsLabel,
  ]
    .filter((part): part is string => part !== undefined)
    .join(" · ");
  const pr = highlights.some((h) => h.personalBest);
  const label = [title, caption, ...highlights.map((h) => `${h.name} ${formatDurationMinutesSeconds(h.durationMs)}${h.personalBest ? ", personal best" : ""}`)].join(". ");
  return (
    <Card onPress={onPress} accessibilityLabel={label} accessibilityHint="Opens this ride" style={styles.card}>
      <View style={[styles.map, { backgroundColor: colors.surfaceRaised }]} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        {ride.previewPolyline !== undefined && ride.previewPolyline.length >= 2 && width > 0 ? (
          <RidePreviewThumbnail points={ride.previewPolyline} width={width} height={MAP_HEIGHT} strokeWidth={2.5} highlights={segmentLines} />
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
