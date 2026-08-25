import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { compareAttempts, type ComparisonSample, type SegmentAttempt } from "../comparison/compareAttempts";
import { useDatabase } from "../db/DatabaseProvider";
import { getAttemptDetail, type AttemptDetail } from "../db/getAttemptDetail";
import { getAttemptTrack } from "../db/getAttemptTrack";
import type { SegmentsStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { ChannelChart, type ChannelSeriesPoint } from "./ChannelChart";
import { formatRideDate } from "./formatRideStats";

type ComparisonRoute = RouteProp<SegmentsStackParamList, "AttemptComparison">;

export function AttemptComparisonScreen() {
  const database = useDatabase();
  const route = useRoute<ComparisonRoute>();
  const [primary, setPrimary] = useState<AttemptDetail | undefined>(undefined);
  const [comparison, setComparison] = useState<AttemptDetail | undefined>(undefined);
  const [samples, setSamples] = useState<ComparisonSample[]>([]);

  useEffect(() => {
    const primaryDetail = getAttemptDetail(database, route.params.primaryAttemptId);
    const comparisonDetail = getAttemptDetail(database, route.params.comparisonAttemptId);
    setPrimary(primaryDetail);
    setComparison(comparisonDetail);

    if (primaryDetail === undefined || comparisonDetail === undefined) {
      setSamples([]);
      return;
    }
    setSamples(
      compareAttempts(
        toSegmentAttempt(database, primaryDetail),
        toSegmentAttempt(database, comparisonDetail),
      ),
    );
  }, [database, route.params.primaryAttemptId, route.params.comparisonAttemptId]);

  if (primary === undefined || comparison === undefined) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>One of these attempts is no longer available.</Text>
      </View>
    );
  }

  if (samples.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>
          These attempts don't overlap enough distance to compare.
        </Text>
      </View>
    );
  }

  const timeGapSeries: ChannelSeriesPoint[] = samples.map((sample) => ({
    distanceMeters: sample.distanceMeters,
    primary: 0,
    comparison: sample.timeGapMs === null ? null : sample.timeGapMs / 1_000,
  }));
  const powerSeries: ChannelSeriesPoint[] = samples.map((sample) => ({
    distanceMeters: sample.distanceMeters,
    primary: sample.primaryPower,
    comparison: sample.comparisonPower,
  }));
  const heartRateSeries: ChannelSeriesPoint[] = samples.map((sample) => ({
    distanceMeters: sample.distanceMeters,
    primary: sample.primaryHeartRate,
    comparison: sample.comparisonHeartRate,
  }));
  const elevationSeries: ChannelSeriesPoint[] = samples.map((sample) => ({
    distanceMeters: sample.distanceMeters,
    primary: sample.primaryElevation,
    comparison: sample.comparisonElevation,
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{formatRideDate(primary.startTimestampMs)}</Text>
      <Text style={styles.subtitle}>vs {formatRideDate(comparison.startTimestampMs)}</Text>

      <ChannelSection title="Time gap (positive = behind)" unit="sec" series={timeGapSeries} />
      <ChannelSection title="Power" unit="W" series={powerSeries} />
      <ChannelSection title="Heart rate" unit="bpm" series={heartRateSeries} />
      <ChannelSection title="Elevation" unit="m" series={elevationSeries} />
    </ScrollView>
  );
}

function ChannelSection({
  title,
  unit,
  series,
}: {
  title: string;
  unit: string;
  series: ChannelSeriesPoint[];
}) {
  const hasAnyData = series.some((point) => point.primary !== null || point.comparison !== null);
  return (
    <View style={styles.section}>
      {hasAnyData ? (
        <ChannelChart title={title} unit={unit} series={series} />
      ) : (
        <Text style={styles.noDataText}>{title}: no data recorded for either attempt.</Text>
      )}
    </View>
  );
}

function toSegmentAttempt(
  database: ReturnType<typeof useDatabase>,
  detail: AttemptDetail,
): SegmentAttempt {
  return {
    id: detail.attemptId,
    segmentId: detail.segmentId,
    rideId: detail.rideId,
    startTimestampMs: detail.startTimestampMs,
    endTimestampMs: detail.endTimestampMs,
    points: getAttemptTrack(database, detail.rideId, detail.startPointIndex, detail.endPointIndex),
  };
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
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -spacing.space12,
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
