import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/DatabaseProvider";
import { getActiveGoal } from "../db/getActiveGoal";
import { getAthleteProfile } from "../db/getAthleteProfile";
import { getAttemptDetail } from "../db/getAttemptDetail";
import { getAttemptTrack } from "../db/getAttemptTrack";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import { listAttemptsForSegment } from "../db/listAttemptsForSegment";
import { getActiveSegmentPlan } from "../db/segmentPlans";
import {
  computePlanVsActual,
  type PlanVsActualZone,
  type PlanVsActualSummary,
} from "../pacing/computePlanVsActual";
import { resolveSegmentPlan, type ResolvedSegmentPlan } from "../pacing/resolveSegmentPlan";
import type { SegmentsStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { formatDurationMinutesSeconds, formatRideDate } from "./formatRideStats";
import { formatTimeDelta } from "./formatTimeDelta";
import { PlanVsActualChart } from "./PlanVsActualChart";

type PlanVsActualRoute = RouteProp<SegmentsStackParamList, "PlanVsActual">;
type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

const PLAN_SOURCE_LABELS = { self: "Your plan", "human-coach": "Coach plan", "ai-coach": "AI coach plan" } as const;

interface LoadedComparison {
  segment: SegmentDetail;
  startTimestampMs: number;
  durationMs: number;
  plan: ResolvedSegmentPlan;
  zones: PlanVsActualZone[];
  summary: PlanVsActualSummary;
  hasPowerTrack: boolean;
  reference?: { durationMs: number; date: number };
}

/**
 * How an effort's power compared with the plan, zone by zone: summary, a plain-language read,
 * a chart of actual vs target, and a table with the time gained or lost per zone against your
 * best other attempt. The plan is the one the segment has *now* (an imported plan, else the
 * generated one for the current goal) -- not necessarily the one you rode with, and the screen
 * says so.
 */
export function PlanVsActualScreen() {
  const database = useDatabase();
  const route = useRoute<PlanVsActualRoute>();
  const navigation = useNavigation<Navigation>();
  const [loaded, setLoaded] = useState<LoadedComparison | "missing" | "no-plan" | undefined>(undefined);
  const [noPlanReason, setNoPlanReason] = useState<"no-ftp" | "no-goal" | undefined>(undefined);
  const [segmentIdForLinks, setSegmentIdForLinks] = useState<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      const attempt = getAttemptDetail(database, route.params.attemptId);
      if (attempt === undefined) {
        setLoaded("missing");
        return;
      }
      const segment = getSegmentDetail(database, attempt.segmentId);
      if (segment === undefined) {
        setLoaded("missing");
        return;
      }
      setSegmentIdForLinks(segment.segmentId);

      const profile = getAthleteProfile(database);
      const goal = getActiveGoal(database);
      const activePlan = getActiveSegmentPlan(database, segment.segmentId);
      const plan = resolveSegmentPlan({
        ...(activePlan === undefined ? {} : { activePlan }),
        ...(profile.ftpWatts === undefined ? {} : { ftpWatts: profile.ftpWatts }),
        ...(goal !== undefined && goal.segmentId === segment.segmentId ? { goalDurationMs: goal.targetDurationMs } : {}),
        referencePolyline: segment.referencePolyline,
      });
      if (plan.kind === "none") {
        setNoPlanReason(plan.reason);
        setLoaded("no-plan");
        return;
      }

      const track = getAttemptTrack(database, attempt.rideId, attempt.startPointIndex, attempt.endPointIndex);
      const best = listAttemptsForSegment(database, segment.segmentId)
        .filter((other) => other.attemptId !== attempt.attemptId && (other.decision === "accept" || other.manuallyApproved))
        .reduce<{ attemptId: string; durationMs: number; startTimestampMs: number } | undefined>((fastest, other) => {
          const durationMs = other.endTimestampMs - other.startTimestampMs;
          return fastest === undefined || durationMs < fastest.durationMs
            ? { attemptId: other.attemptId, durationMs, startTimestampMs: other.startTimestampMs }
            : fastest;
        }, undefined);
      const bestDetail = best === undefined ? undefined : getAttemptDetail(database, best.attemptId);
      const referenceTrack =
        bestDetail === undefined
          ? undefined
          : getAttemptTrack(database, bestDetail.rideId, bestDetail.startPointIndex, bestDetail.endPointIndex);

      const segmentLengthMeters = segment.referencePolyline.at(-1)?.distanceMeters ?? 0;
      const { zones, summary } = computePlanVsActual({
        track,
        zones: plan.zones,
        segmentLengthMeters,
        ...(referenceTrack === undefined || referenceTrack.length === 0 ? {} : { reference: referenceTrack }),
      });
      setLoaded({
        segment,
        startTimestampMs: attempt.startTimestampMs,
        durationMs: attempt.endTimestampMs - attempt.startTimestampMs,
        plan,
        zones,
        summary,
        hasPowerTrack: track.some((point) => point.power !== undefined),
        ...(best === undefined ? {} : { reference: { durationMs: best.durationMs, date: best.startTimestampMs } }),
      });
    }, [database, route.params.attemptId]),
  );

  if (loaded === undefined) return <View style={styles.container} />;

  if (loaded === "missing") {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.body}>This effort is no longer available.</Text>
      </View>
    );
  }

  if (loaded === "no-plan") {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.title}>No plan to compare against</Text>
        <Text style={styles.body}>
          {noPlanReason === "no-ftp"
            ? "Set your FTP, then give this segment a goal time (or import a coach plan) and this screen will line your power up against it."
            : "Give this segment a goal time, or import a coach plan, and this screen will line your power up against it."}
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            noPlanReason === "no-ftp"
              ? navigation.navigate("ZonesSettings")
              : segmentIdForLinks !== undefined && navigation.navigate("SegmentDetail", { segmentId: segmentIdForLinks })
          }
        >
          <Text style={styles.buttonLabel}>{noPlanReason === "no-ftp" ? "Set FTP" : "Open the segment"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { summary, zones, plan, reference } = loaded;
  const planLabel =
    plan.kind === "imported"
      ? `${PLAN_SOURCE_LABELS[plan.plan.source]}${plan.plan.authorLabel === undefined ? "" : ` · ${plan.plan.authorLabel}`}`
      : plan.kind === "generated"
        ? `GritMap plan for a ${formatDurationMinutesSeconds(plan.goalDurationMs)} goal at ${Math.round(plan.ftpWatts)} W FTP`
        : "";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{loaded.segment.name}</Text>
      <Text style={styles.body}>
        {formatRideDate(loaded.startTimestampMs)} · {formatDurationMinutesSeconds(loaded.durationMs)}
      </Text>
      <Text style={styles.caption}>
        Compared with: {planLabel}. This is the segment's plan as it is today, which may differ from the plan you rode
        with.
      </Text>

      {!loaded.hasPowerTrack ? (
        <Text style={styles.body}>This effort has no power data, so it can't be compared with the plan.</Text>
      ) : (
        <>
          <View style={styles.tiles}>
            <Tile
              value={summary.averageActualWatts === null ? "—" : `${Math.round(summary.averageActualWatts)} W`}
              label={`Avg power (plan ${Math.round(summary.averageTargetWatts)} W)`}
            />
            <Tile value={`${summary.zonesOnTarget}/${zones.length}`} label="Zones on target" />
            <Tile
              value={summary.totalVsReferenceMs === null ? "—" : formatTimeDelta(summary.totalVsReferenceMs)}
              label={
                reference === undefined
                  ? "vs your best"
                  : `vs best other (${formatDurationMinutesSeconds(reference.durationMs)})`
              }
            />
          </View>

          <View style={styles.card}>
            {summary.insights.map((line, index) => (
              <Text key={index} style={styles.insight}>
                • {line}
              </Text>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Power by zone</Text>
          <PlanVsActualChart zones={zones} />

          <Text style={styles.sectionTitle}>Zone detail</Text>
          <View style={styles.table}>
            <View style={[styles.row, styles.headerRow]}>
              <Text style={[styles.cell, styles.cellZone, styles.headerText]}>#</Text>
              <Text style={[styles.cell, styles.cellRange, styles.headerText]}>Distance</Text>
              <Text style={[styles.cell, styles.cellNumber, styles.headerText]}>Plan</Text>
              <Text style={[styles.cell, styles.cellNumber, styles.headerText]}>Actual</Text>
              <Text style={[styles.cell, styles.cellNumber, styles.headerText]}>Δ W</Text>
              <Text style={[styles.cell, styles.cellNumber, styles.headerText]}>Time</Text>
            </View>
            {zones.map((zone) => (
              <View key={zone.index} style={styles.row}>
                <Text style={[styles.cell, styles.cellZone]}>{zone.index + 1}</Text>
                <Text style={[styles.cell, styles.cellRange]}>
                  {Math.round(zone.startDistanceMeters)}–{Math.round(zone.endDistanceMeters)} m
                </Text>
                <Text style={[styles.cell, styles.cellNumber]}>{zone.targetPowerWatts}</Text>
                <Text style={[styles.cell, styles.cellNumber]}>
                  {zone.actualPowerWatts === null ? "—" : Math.round(zone.actualPowerWatts)}
                </Text>
                <Text style={[styles.cell, styles.cellNumber, deviationStyle(zone)]}>
                  {zone.deviationWatts === null ? "—" : `${zone.deviationWatts > 0 ? "+" : ""}${Math.round(zone.deviationWatts)}`}
                </Text>
                <Text style={[styles.cell, styles.cellNumber]}>
                  {zone.timeVsReferenceMs === null ? "—" : formatTimeDelta(zone.timeVsReferenceMs)}
                </Text>
              </View>
            ))}
          </View>
          {reference !== undefined && (
            <Text style={styles.caption}>
              "Time" is gained (−) or lost (+) in that zone against your best other attempt, from{" "}
              {formatRideDate(reference.date)}.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

function deviationStyle(zone: PlanVsActualZone) {
  if (zone.status === "over") return styles.over;
  if (zone.status === "under") return styles.under;
  return undefined;
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.space20, paddingTop: spacing.space16, paddingBottom: spacing.space32, gap: spacing.space16 },
  emptyState: { flex: 1, backgroundColor: colors.background, padding: spacing.space20, gap: spacing.space16, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  caption: { fontSize: 12, color: colors.textTertiary, lineHeight: 17 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  button: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.space12, alignItems: "center" },
  buttonLabel: { color: colors.textOnBrand, fontSize: 15, fontWeight: "600" },
  tiles: { flexDirection: "row", gap: spacing.space8 },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.space12,
    gap: spacing.space4,
  },
  tileValue: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  tileLabel: { fontSize: 11, color: colors.textSecondary, lineHeight: 15 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.space16,
    gap: spacing.space8,
  },
  insight: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" },
  row: { flexDirection: "row", paddingVertical: spacing.space8, paddingHorizontal: spacing.space8, borderTopWidth: 1, borderTopColor: colors.border },
  headerRow: { backgroundColor: colors.surface, borderTopWidth: 0 },
  headerText: { fontWeight: "700", color: colors.textSecondary },
  cell: { fontSize: 13, color: colors.textPrimary },
  cellZone: { width: 26 },
  cellRange: { flex: 1.6 },
  cellNumber: { flex: 1, textAlign: "right" },
  over: { color: colors.statusWarning, fontWeight: "600" },
  under: { color: colors.statusInfo, fontWeight: "600" },
});
