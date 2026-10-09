import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { compareAttempts, type ComparisonSample, type SegmentAttempt } from "../comparison/compareAttempts";
import { useDatabase } from "../db/DatabaseProvider";
import { getAthleteProfile, type AthleteProfile } from "../db/getAthleteProfile";
import { getAttemptDetail, type AttemptDetail } from "../db/getAttemptDetail";
import { getAttemptTrack } from "../db/getAttemptTrack";
import { listAttemptsForSegment, type AttemptSummary } from "../db/listAttemptsForSegment";
import type { SegmentsStackParamList } from "../navigation/types";
import { AppText, Button, Card, ErrorState, ListRow, LoadingState, Notice, ScreenScroll, Section } from "../theme/components";
import { SCREEN_PADDING } from "../theme/layout";
import { radius, spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { computeZoneBreakdown } from "../zones/computeZoneBreakdown";
import { ChannelChart, type ChannelSeriesPoint } from "./ChannelChart";
import { averageOf, describeChannelAverages, describeOverallGap } from "./describeComparison";
import { formatDurationMinutesSeconds, formatRideDate } from "./formatRideStats";

type ComparisonRoute = RouteProp<SegmentsStackParamList, "AttemptComparison">;
type Navigation = NativeStackNavigationProp<SegmentsStackParamList, "AttemptComparison">;

type Which = "primary" | "comparison";

/**
 * Two efforts on the same segment, side by side: who finished ahead, how much time each had in each
 * training zone, and power, heart rate, elevation and the running time gap along the segment. Both
 * efforts are named at the top and either can be swapped for another effort on the segment.
 */
export function AttemptComparisonScreen() {
  const database = useDatabase();
  const route = useRoute<ComparisonRoute>();
  const navigation = useNavigation<Navigation>();
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [primary, setPrimary] = useState<AttemptDetail | undefined>(undefined);
  const [comparison, setComparison] = useState<AttemptDetail | undefined>(undefined);
  const [samples, setSamples] = useState<ComparisonSample[]>([]);
  const [athleteProfile, setAthleteProfileState] = useState<AthleteProfile>({});
  const [choices, setChoices] = useState<AttemptSummary[]>([]);
  const [picking, setPicking] = useState<Which | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      setAthleteProfileState(getAthleteProfile(database));
    }, [database]),
  );

  const load = useCallback(() => {
    setState("loading");
    try {
      const primaryDetail = getAttemptDetail(database, route.params.primaryAttemptId);
      const comparisonDetail = getAttemptDetail(database, route.params.comparisonAttemptId);
      setPrimary(primaryDetail);
      setComparison(comparisonDetail);
      if (primaryDetail === undefined || comparisonDetail === undefined) {
        setSamples([]);
        setState("missing");
        return;
      }
      setChoices(
        listAttemptsForSegment(database, primaryDetail.segmentId).filter((attempt) => attempt.decision === "accept" || attempt.manuallyApproved),
      );
      setSamples(compareAttempts(toSegmentAttempt(database, primaryDetail), toSegmentAttempt(database, comparisonDetail)));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [database, route.params.primaryAttemptId, route.params.comparisonAttemptId]);

  useEffect(load, [load]);

  if (state === "loading") {
    return (
      <ScreenScroll>
        <LoadingState label="Comparing your efforts…" />
      </ScreenScroll>
    );
  }
  if (state === "error") {
    return <ErrorState title="Couldn't compare these efforts" message="GritMap couldn't read the rides for these efforts. Go back and try again." onRetry={load} />;
  }
  if (state === "missing" || primary === undefined || comparison === undefined) {
    return <ErrorState title="One of these efforts is no longer available" message="It may have been removed. Go back to the segment and choose two efforts again." />;
  }

  const primaryDurationMs = primary.endTimestampMs - primary.startTimestampMs;
  const comparisonDurationMs = comparison.endTimestampMs - comparison.startTimestampMs;

  function choose(which: Which, attemptId: string) {
    setPicking(undefined);
    navigation.setParams(
      which === "primary"
        ? { primaryAttemptId: attemptId, comparisonAttemptId: route.params.comparisonAttemptId }
        : { primaryAttemptId: route.params.primaryAttemptId, comparisonAttemptId: attemptId },
    );
  }

  const header = (
    <>
      <Card>
        <ListRow
          icon="clock"
          title="This effort"
          subtitle={`${formatRideDate(primary.startTimestampMs)} · ${formatDurationMinutesSeconds(primaryDurationMs)}`}
          onPress={() => setPicking("primary")}
          accessibilityHint="Choose a different effort"
        />
        <ListRow
          icon="clock"
          iconColor="textSecondary"
          title="Compared with"
          subtitle={`${formatRideDate(comparison.startTimestampMs)} · ${formatDurationMinutesSeconds(comparisonDurationMs)}`}
          onPress={() => setPicking("comparison")}
          accessibilityHint="Choose a different effort"
        />
      </Card>
      <AttemptPicker
        visible={picking !== undefined}
        title={picking === "primary" ? "Choose this effort" : "Choose the effort to compare with"}
        attempts={choices}
        selectedId={picking === "primary" ? primary.attemptId : comparison.attemptId}
        otherId={picking === "primary" ? comparison.attemptId : primary.attemptId}
        onChoose={(attemptId) => picking !== undefined && choose(picking, attemptId)}
        onClose={() => setPicking(undefined)}
      />
    </>
  );

  if (samples.length === 0) {
    return (
      <ScreenScroll>
        {header}
        <Notice tone="info">These two efforts don't overlap enough to compare. Choose a different effort above.</Notice>
      </ScreenScroll>
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
  const overall = describeOverallGap(primaryDurationMs, comparisonDurationMs);

  return (
    <ScreenScroll>
      {header}
      <AppText variant="headline" accessibilityLiveRegion="polite">
        {overall}
      </AppText>

      <Section title="Time in each zone" description="How the effort was spread across your training zones. Longer coloured bars mean more time there.">
        <ZoneCard
          title="Power zones"
          breakdown={zoneBreakdown.primary.power}
          comparisonBreakdown={zoneBreakdown.comparison.power}
          missingHint="Set your FTP to see power zones"
          onSetThreshold={() => navigation.navigate("ZonesSettings")}
        />
        <ZoneCard
          title="Heart-rate zones"
          breakdown={zoneBreakdown.primary.heartRate}
          comparisonBreakdown={zoneBreakdown.comparison.heartRate}
          missingHint="Set your max heart rate to see heart-rate zones"
          onSetThreshold={() => navigation.navigate("ZonesSettings")}
        />
      </Section>

      <Section
        title="Ahead or behind"
        description="How far ahead or behind the other effort you were at each point along the segment. Above the zero line you were behind; below it you were ahead. A break in a line means there was no data at that point."
      >
        <Card>
          <ChannelSection
            title="Time gap"
            unit="sec"
            series={timeGapSeries}
            primaryLabel="Level"
            comparisonLabel="Your gap"
            noData="There isn't enough data to work out the gap."
            summary={overall}
          />
        </Card>
      </Section>

      <Section title="Along the segment" description="This effort against the other, from the start of the segment to the finish. A break in a line means that effort had no data there.">
        <Card>
          <ChannelSection
            title="Power"
            unit="W"
            series={powerSeries}
            primaryLabel="This effort"
            comparisonLabel="Other effort"
            noData="No power was recorded in either effort."
            summary={describeChannelAverages({ name: "Power", unit: "W", primary: averageOf(powerSeries.map((p) => p.primary)), comparison: averageOf(powerSeries.map((p) => p.comparison)) })}
          />
        </Card>
        <Card>
          <ChannelSection
            title="Heart rate"
            unit="bpm"
            series={heartRateSeries}
            primaryLabel="This effort"
            comparisonLabel="Other effort"
            noData="No heart rate was recorded in either effort."
            summary={describeChannelAverages({ name: "Heart rate", unit: "bpm", primary: averageOf(heartRateSeries.map((p) => p.primary)), comparison: averageOf(heartRateSeries.map((p) => p.comparison)) })}
          />
        </Card>
        <Card>
          <ChannelSection
            title="Elevation"
            unit="m"
            series={elevationSeries}
            primaryLabel="This effort"
            comparisonLabel="Other effort"
            noData="No elevation was recorded in either effort."
          />
        </Card>
      </Section>
    </ScreenScroll>
  );
}

function ChannelSection({
  title,
  unit,
  series,
  primaryLabel,
  comparisonLabel,
  noData,
  summary,
}: {
  title: string;
  unit: string;
  series: ChannelSeriesPoint[];
  primaryLabel: string;
  comparisonLabel: string;
  noData: string;
  summary?: string | undefined;
}) {
  const hasAnyData = series.some((point) => point.primary !== null || point.comparison !== null);
  if (!hasAnyData) {
    return (
      <>
        <AppText variant="subheadline" style={styles.cardTitle}>
          {title}
        </AppText>
        <AppText variant="subheadline" color="textSecondary">
          {noData}
        </AppText>
      </>
    );
  }
  return (
    <ChannelChart
      title={title}
      unit={unit}
      series={series}
      primaryLabel={primaryLabel}
      comparisonLabel={comparisonLabel}
      {...(summary === undefined ? {} : { summary })}
    />
  );
}

type Breakdown = { zone: number; percent: number }[];

function ZoneCard({
  title,
  breakdown,
  comparisonBreakdown,
  missingHint,
  onSetThreshold,
}: {
  title: string;
  breakdown: Breakdown | undefined;
  comparisonBreakdown: Breakdown | undefined;
  missingHint: string;
  onSetThreshold: () => void;
}) {
  return (
    <Card>
      <AppText variant="subheadline" style={styles.cardTitle}>
        {title}
      </AppText>
      {breakdown === undefined ? (
        <Button label={missingHint} variant="tertiary" fullWidth={false} onPress={onSetThreshold} />
      ) : (
        <>
          <ZoneRow label="This effort" breakdown={breakdown} />
          <ZoneRow label="Other effort" breakdown={comparisonBreakdown ?? []} />
        </>
      )}
    </Card>
  );
}

function ZoneRow({ label, breakdown }: { label: string; breakdown: Breakdown }) {
  const palette = useColors();
  if (breakdown.length === 0) {
    return (
      <View style={styles.zoneRow}>
        <AppText variant="footnote" color="textSecondary">
          {label}
        </AppText>
        <AppText variant="footnote" color="textSecondary">
          no data
        </AppText>
      </View>
    );
  }
  const legend = breakdown.map(({ zone, percent }) => `Z${zone} ${Math.round(percent)}%`).join(" · ");
  return (
    <View style={styles.zoneRow} accessible accessibilityLabel={`${label}: ${legend}`}>
      <AppText variant="footnote" color="textSecondary">
        {label}
      </AppText>
      <View style={[styles.zoneBar, { backgroundColor: palette.disabledBackground }]}>
        {/* Zones are ordered, so one hue getting stronger with the zone number reads as effort rising. */}
        {breakdown.map(({ zone, percent }) => (
          <View key={zone} style={{ flexGrow: percent, flexBasis: 0, backgroundColor: palette.brandFill, opacity: 0.2 + 0.8 * (Math.min(zone, 7) / 7) }} />
        ))}
      </View>
      <AppText variant="caption1" color="textSecondary">
        {legend}
      </AppText>
    </View>
  );
}

/** A sheet listing the segment's confirmed efforts to swap one of the two being compared. */
function AttemptPicker({
  visible,
  title,
  attempts,
  selectedId,
  otherId,
  onChoose,
  onClose,
}: {
  visible: boolean;
  title: string;
  attempts: readonly AttemptSummary[];
  selectedId: string;
  otherId: string;
  onChoose: (attemptId: string) => void;
  onClose: () => void;
}) {
  const palette = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable
          style={[styles.scrim, { backgroundColor: palette.textPrimary }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close without changing"
        />
        <View style={[styles.sheet, { backgroundColor: palette.surface, borderColor: palette.border }]} accessibilityViewIsModal>
          <AppText variant="title3" accessibilityRole="header">
            {title}
          </AppText>
          <ScrollView style={styles.sheetList}>
            {attempts.map((attempt) => {
              const isOther = attempt.attemptId === otherId;
              return (
                <ListRow
                  key={attempt.attemptId}
                  icon="clock"
                  iconColor={attempt.attemptId === selectedId ? "brand" : "textTertiary"}
                  selected={attempt.attemptId === selectedId}
                  title={formatRideDate(attempt.startTimestampMs)}
                  subtitle={
                    isOther
                      ? `${formatDurationMinutesSeconds(attempt.endTimestampMs - attempt.startTimestampMs)} · already chosen as the other effort`
                      : formatDurationMinutesSeconds(attempt.endTimestampMs - attempt.startTimestampMs)
                  }
                  showChevron={false}
                  {...(isOther ? {} : { onPress: () => onChoose(attempt.attemptId) })}
                />
              );
            })}
          </ScrollView>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function toSegmentAttempt(database: ReturnType<typeof useDatabase>, detail: AttemptDetail): SegmentAttempt {
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
  cardTitle: { fontWeight: "600" },
  zoneRow: { gap: spacing.space4 },
  zoneBar: { flexDirection: "row", height: 12, borderRadius: radius.sm, overflow: "hidden" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 },
  sheet: {
    maxHeight: "75%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    padding: SCREEN_PADDING,
    gap: spacing.space12,
  },
  sheetList: { flexGrow: 0 },
});
