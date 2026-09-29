import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { compareAttempts, type ComparisonSample, type SegmentAttempt } from "../comparison/compareAttempts";
import { useDatabase } from "../db/DatabaseProvider";
import { getAthleteProfile, type AthleteProfile } from "../db/getAthleteProfile";
import { getAttemptDetail, type AttemptDetail } from "../db/getAttemptDetail";
import { getAttemptTrack } from "../db/getAttemptTrack";
import type { SegmentsStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { computeZoneBreakdown, type ZoneBreakdown } from "../zones/computeZoneBreakdown";
import { ChannelChart, type ChannelSeriesPoint } from "./ChannelChart";
import { formatRideDate } from "./formatRideStats";

type ComparisonRoute = RouteProp<SegmentsStackParamList, "AttemptComparison">;
type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

export function AttemptComparisonScreen() {
  const database = useDatabase();
  const route = useRoute<ComparisonRoute>();
  const navigation = useNavigation<Navigation>();
  const [primary, setPrimary] = useState<AttemptDetail | undefined>(undefined);
  const [comparison, setComparison] = useState<AttemptDetail | undefined>(undefined);
  const [samples, setSamples] = useState<ComparisonSample[]>([]);
  const [athleteProfile, setAthleteProfileState] = useState<AthleteProfile>({});

  useFocusEffect(
    useCallback(() => {
      setAthleteProfileState(getAthleteProfile(database));
    }, [database]),
  );

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
  const zoneBreakdown = computeZoneBreakdown(samples, athleteProfile);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{formatRideDate(primary.startTimestampMs)}</Text>
      <Text style={styles.subtitle}>vs {formatRideDate(comparison.startTimestampMs)}</Text>

      <ZoneSection
        title="Power zones"
        breakdown={zoneBreakdown.primary.power}
        comparisonBreakdown={zoneBreakdown.comparison.power}
        onSetThreshold={() => navigation.navigate("ZonesSettings")}
        missingHint="Set your FTP to see power zones"
      />
      <ZoneSection
        title="Heart-rate zones"
        breakdown={zoneBreakdown.primary.heartRate}
        comparisonBreakdown={zoneBreakdown.comparison.heartRate}
        onSetThreshold={() => navigation.navigate("ZonesSettings")}
        missingHint="Set your max heart rate to see HR zones"
      />

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

const ZONE_COLORS = ["#93C5FD", "#5EEAD4", "#86EFAC", "#FDE68A", "#FDBA74", "#FCA5A5", "#F87171"];

function ZoneSection({
  title,
  breakdown,
  comparisonBreakdown,
  onSetThreshold,
  missingHint,
}: {
  title: string;
  breakdown: { zone: number; percent: number }[] | undefined;
  comparisonBreakdown: { zone: number; percent: number }[] | undefined;
  onSetThreshold: () => void;
  missingHint: string;
}) {
  if (breakdown === undefined) {
    return (
      <View style={styles.section}>
        <Text style={styles.zoneTitle}>{title}</Text>
        <TouchableOpacity onPress={onSetThreshold}>
          <Text style={styles.zoneMissingLink}>{missingHint}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.zoneTitle}>{title}</Text>
      <ZoneRow label="This attempt" breakdown={breakdown} />
      <ZoneRow label="Comparison" breakdown={comparisonBreakdown ?? []} />
    </View>
  );
}

function ZoneRow({ label, breakdown }: { label: string; breakdown: { zone: number; percent: number }[] }) {
  if (breakdown.length === 0) {
    return (
      <View style={styles.zoneRow}>
        <Text style={styles.zoneRowLabel}>{label}</Text>
        <Text style={styles.noDataText}>no data</Text>
      </View>
    );
  }
  return (
    <View style={styles.zoneRow}>
      <Text style={styles.zoneRowLabel}>{label}</Text>
      <View style={styles.zoneBar}>
        {breakdown.map(({ zone, percent }) => (
          <View
            key={zone}
            style={{
              flexGrow: percent,
              flexBasis: 0,
              backgroundColor: ZONE_COLORS[(zone - 1) % ZONE_COLORS.length],
            }}
          />
        ))}
      </View>
      <Text style={styles.zoneLegend}>
        {breakdown.map(({ zone, percent }) => `Z${zone} ${Math.round(percent)}%`).join(" · ")}
      </Text>
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
  zoneTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.space8,
  },
  zoneMissingLink: {
    fontSize: 13,
    color: colors.brand,
  },
  zoneRow: {
    gap: spacing.space4,
    marginBottom: spacing.space8,
  },
  zoneRowLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  zoneBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.disabledBackground,
  },
  zoneLegend: {
    fontSize: 11,
    color: colors.textTertiary,
  },
});
