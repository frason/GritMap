import { useCallback, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useDatabase } from "../db/DatabaseProvider";
import { getRideDetail, type RideDetail } from "../db/getRideDetail";
import { getRideTrack, type RideTrackPoint } from "../db/getRideTrack";
import { listAttemptsForRide, type RideAttemptSummary } from "../db/listAttemptsForRide";
import type { RidesStackParamList, RootTabParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { Icon } from "../theme/Icon";
import { radius, spacing } from "../theme/spacing";
import { RouteMapView } from "./RouteMapView";
import {
  formatDistanceMiles,
  formatDurationHoursMinutes,
  formatElevationFeet,
  formatRideDate,
} from "./formatRideStats";

type DetailRoute = RouteProp<RidesStackParamList, "RideDetail">;
type DetailNavigation = NativeStackNavigationProp<RidesStackParamList, "RideDetail">;

export function RideDetailScreen() {
  const database = useDatabase();
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<DetailNavigation>();
  const [ride, setRide] = useState<RideDetail | undefined>(undefined);
  const [track, setTrack] = useState<RideTrackPoint[]>([]);
  const [attempts, setAttempts] = useState<RideAttemptSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRide(getRideDetail(database, route.params.rideId));
      setTrack(getRideTrack(database, route.params.rideId));
      setAttempts(listAttemptsForRide(database, route.params.rideId));
    }, [database, route.params.rideId]),
  );

  function openAttemptReview(attemptId: string) {
    navigation
      .getParent<BottomTabNavigationProp<RootTabParamList>>()
      ?.navigate("SegmentsTab", { screen: "AttemptReview", params: { attemptId } });
  }

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
        {attempts.length === 0 ? (
          <Text style={styles.segmentsEmptyText}>
            No traversals detected yet. Define a segment (from this ride or another) that
            overlaps this route to see them here.
          </Text>
        ) : (
          attempts.map((attempt) => (
            <AttemptRow
              key={attempt.attemptId}
              attempt={attempt}
              onPress={() => openAttemptReview(attempt.attemptId)}
            />
          ))
        )}
      </Section>

      <View style={styles.createSegmentSection}>
        {track.length >= 2 ? (
          <TouchableOpacity
            style={styles.createSegmentButton}
            onPress={() => navigation.navigate("DefineSegment", { rideId: route.params.rideId })}
          >
            <Text style={styles.createSegmentButtonLabel}>Create Segment</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.disabledButton}>
              <Text style={styles.disabledButtonLabel}>Create Segment</Text>
            </View>
            <Text style={styles.createSegmentCaption}>Not enough GPS data on this ride</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function AttemptRow({
  attempt,
  onPress,
}: {
  attempt: RideAttemptSummary;
  onPress: () => void;
}) {
  const isPositive = attempt.manuallyApproved || attempt.decision === "accept";
  return (
    <TouchableOpacity style={styles.attemptRow} onPress={onPress}>
      <Icon
        name={isPositive ? "checkCircle" : "alertTriangle"}
        color={isPositive ? "statusSuccess" : "statusWarning"}
        size={20}
      />
      <View style={styles.attemptRowText}>
        <Text style={styles.attemptRowTitle}>{attempt.segmentName}</Text>
        <Text style={styles.attemptRowSubtitle} numberOfLines={1}>
          {formatDurationHoursMinutes(attempt.endTimestampMs - attempt.startTimestampMs)} ·{" "}
          {Math.round(attempt.confidenceScore * 100)}% confidence
          {attempt.manuallyApproved ? " · Approved" : ""}
        </Text>
      </View>
      <Icon name="chevronRight" color="textSecondary" size={18} />
    </TouchableOpacity>
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
  attemptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    paddingHorizontal: spacing.space16,
    marginBottom: spacing.space8,
  },
  attemptRowText: {
    flex: 1,
    gap: spacing.space4 - 2,
  },
  attemptRowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  attemptRowSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  createSegmentSection: {
    marginTop: spacing.space24,
    alignItems: "center",
    gap: spacing.space8,
  },
  createSegmentButton: {
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
  },
  createSegmentButtonLabel: {
    color: colors.textOnBrand,
    fontSize: 15,
    fontWeight: "600",
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
