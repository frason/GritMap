import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import type { RideTrackPoint } from "../db/getRideTrack";
import type { SegmentsStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { RouteMapView } from "./RouteMapView";
import { formatDistanceMiles, formatElevationFeet } from "./formatRideStats";

type SegmentDetailRoute = RouteProp<SegmentsStackParamList, "SegmentDetail">;

export function SegmentDetailScreen() {
  const database = useDatabase();
  const route = useRoute<SegmentDetailRoute>();
  const [segment, setSegment] = useState<SegmentDetail | undefined>(undefined);

  useEffect(() => {
    setSegment(getSegmentDetail(database, route.params.segmentId));
  }, [database, route.params.segmentId]);

  if (!segment) {
    return <View style={styles.container} />;
  }

  const totalDistanceMeters = segment.referencePolyline.at(-1)?.distanceMeters ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{segment.name}</Text>

      <View style={styles.statsRow}>
        <StatTile value={formatDistanceMiles(totalDistanceMeters)} label="Distance" />
        <StatTile value={`${segment.corridorMeters}m`} label="Corridor" />
        <StatTile value={`${Math.round(segment.requiredCoveragePct * 100)}%`} label="Coverage" />
      </View>

      <Section title="Route overview">
        <View style={styles.routeMap}>
          <RouteMapView points={toRouteMapPoints(segment)} />
        </View>
      </Section>

      <Section title="Attempts">
        <Text style={styles.attemptsEmptyText}>
          No attempts detected yet. Import more rides that traverse this segment to see them
          here.
        </Text>
      </Section>
    </ScrollView>
  );
}

/**
 * A segment's resampled reference polyline has no real GPS gaps (it's synthetic, evenly
 * spaced at a fixed distance interval) -- sequential 1-second-apart timestamps trivially
 * satisfy RouteMapView's gap-splitting threshold without ever triggering it.
 */
function toRouteMapPoints(segment: SegmentDetail): RideTrackPoint[] {
  return segment.referencePolyline.map((point, index) => ({
    pointIndex: index,
    timestampMs: index * 1_000,
    lat: point.lat,
    lng: point.lng,
    distanceMeters: point.distanceMeters,
    ...(point.elevationMeters === undefined ? {} : { elevationMeters: point.elevationMeters }),
  }));
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.space20,
    paddingTop: spacing.space16,
    paddingBottom: spacing.space32,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.space8 + 2,
    marginTop: spacing.space20,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.space16 - 2,
    alignItems: "center",
    gap: spacing.space4 - 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  section: {
    marginTop: spacing.space24,
    gap: spacing.space8 + 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  routeMap: {
    height: 220,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  attemptsEmptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
