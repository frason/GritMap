import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import type { SegmentAttempt } from "../comparison/compareAttempts";
import { computeHistoricalBand, type HistoricalBandSample } from "../comparison/computeHistoricalBand";
import { useDatabase } from "../db/DatabaseProvider";
import { getAttemptDetail } from "../db/getAttemptDetail";
import { getAttemptTrack } from "../db/getAttemptTrack";
import { listAttemptsForSegment } from "../db/listAttemptsForSegment";
import type { SegmentsStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { ChannelChart, type ChannelSeriesPoint } from "./ChannelChart";

type HistoricalBandRoute = RouteProp<SegmentsStackParamList, "HistoricalBand">;

export function HistoricalBandScreen() {
  const database = useDatabase();
  const route = useRoute<HistoricalBandRoute>();
  const [attempts, setAttempts] = useState<SegmentAttempt[] | undefined>(undefined);

  useEffect(() => {
    const summaries = listAttemptsForSegment(database, route.params.segmentId).filter(
      (attempt) => attempt.decision === "accept" || attempt.manuallyApproved,
    );
    const loaded = summaries.flatMap((summary): SegmentAttempt[] => {
      const detail = getAttemptDetail(database, summary.attemptId);
      if (detail === undefined) return [];
      return [
        {
          id: detail.attemptId,
          segmentId: detail.segmentId,
          rideId: detail.rideId,
          startTimestampMs: detail.startTimestampMs,
          endTimestampMs: detail.endTimestampMs,
          points: getAttemptTrack(database, detail.rideId, detail.startPointIndex, detail.endPointIndex),
        },
      ];
    });
    setAttempts(loaded);
  }, [database, route.params.segmentId]);

  if (attempts === undefined) {
    return <View style={styles.container} />;
  }

  if (attempts.length < 3) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>
          Need at least 3 confirmed attempts to show a historical range. You have {attempts.length} so far.
        </Text>
      </View>
    );
  }

  const powerBand = computeHistoricalBand(attempts, route.params.currentAttemptId, "power");
  const heartRateBand = computeHistoricalBand(attempts, route.params.currentAttemptId, "heartRate");
  const elevationBand = computeHistoricalBand(attempts, route.params.currentAttemptId, "elevationMeters");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        The shaded band shows the range across all {attempts.length} confirmed attempts; the bold
        line is this attempt.
      </Text>
      <BandSection title="Power" unit="W" band={powerBand} />
      <BandSection title="Heart rate" unit="bpm" band={heartRateBand} />
      <BandSection title="Elevation" unit="m" band={elevationBand} />
    </ScrollView>
  );
}

function BandSection({ title, unit, band }: { title: string; unit: string; band: HistoricalBandSample[] }) {
  const hasAnyData = band.some((sample) => sample.min !== null || sample.current !== null);
  const series: ChannelSeriesPoint[] = band.map((sample) => ({
    distanceMeters: sample.distanceMeters,
    primary: sample.max,
    comparison: sample.min,
    current: sample.current,
  }));

  return (
    <View style={styles.section}>
      {hasAnyData ? (
        <ChannelChart
          title={title}
          unit={unit}
          series={series}
          primaryLabel="Max"
          comparisonLabel="Min"
          currentLabel="This attempt"
        />
      ) : (
        <Text style={styles.noDataText}>{title}: no data recorded across these attempts.</Text>
      )}
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
    gap: spacing.space20,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.space24,
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.space16,
  },
  noDataText: {
    fontSize: 13,
    color: colors.textTertiary,
  },
});
