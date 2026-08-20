import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getRideDetail, type RideDetail } from "../db/getRideDetail";
import { getRideTrack, type RideTrackPoint } from "../db/getRideTrack";
import type { RidesStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { RouteMapView } from "./RouteMapView";
import {
  formatDistanceMiles,
  formatDurationHoursMinutes,
  formatElevationFeet,
  formatRideDate,
} from "./formatRideStats";

type DetailRoute = RouteProp<RidesStackParamList, "RideDetail">;

export function RideDetailScreen() {
  const database = useDatabase();
  const route = useRoute<DetailRoute>();
  const [ride, setRide] = useState<RideDetail | undefined>(undefined);
  const [track, setTrack] = useState<RideTrackPoint[]>([]);

  useEffect(() => {
    setRide(getRideDetail(database, route.params.rideId));
    setTrack(getRideTrack(database, route.params.rideId));
  }, [database, route.params.rideId]);

  if (!ride) {
    return <View style={styles.container} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {ride.startTimestampMs !== undefined ? formatRideDate(ride.startTimestampMs) : "Ride"}
      </Text>
      <Text style={styles.subtitle}>Imported from {ride.originalFilename}</Text>

      <View style={styles.statsRow}>
        <StatTile value={formatDistanceMiles(ride.totalDistanceMeters)} label="Distance" />
        <StatTile value={formatDurationHoursMinutes(ride.durationMs)} label="Duration" />
        <StatTile value={formatElevationFeet(ride.totalAscentMeters)} label="Elevation" />
      </View>

      <Section title="Route">
        <View style={styles.routeMap}>
          <RouteMapView points={track} />
        </View>
      </Section>

      <Section title="Detected segments">
        <Text style={styles.segmentsEmptyText}>
          No segments defined yet. Create one from this ride to start tracking traversals.
        </Text>
      </Section>

      <View style={styles.createSegmentSection}>
        <View style={styles.disabledButton}>
          <Text style={styles.disabledButtonLabel}>Create Segment</Text>
        </View>
        <Text style={styles.createSegmentCaption}>
          Coming soon — needs map + precision scrubber
        </Text>
      </View>
    </ScrollView>
  );
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
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.space4 - 2,
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
  segmentsEmptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  createSegmentSection: {
    marginTop: spacing.space24,
    alignItems: "center",
    gap: spacing.space8,
  },
  disabledButton: {
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: colors.disabledBackground,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
  },
  disabledButtonLabel: {
    color: colors.disabledText,
    fontSize: 15,
    fontWeight: "600",
  },
  createSegmentCaption: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});
