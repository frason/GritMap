import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/DatabaseProvider";
import { getActiveGoal } from "../db/getActiveGoal";
import { getAthleteProfile } from "../db/getAthleteProfile";
import { getAttemptDetail } from "../db/getAttemptDetail";
import { getAttemptTrack } from "../db/getAttemptTrack";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import { listAttemptsForSegment } from "../db/listAttemptsForSegment";
import { getPlanSentBefore } from "../db/planSends";
import { getActiveSegmentPlan } from "../db/segmentPlans";
import {
  computePlanVsActual,
  type PlanVsActualZone,
  type PlanVsActualSummary,
} from "../pacing/computePlanVsActual";
import { resolvePlanForEffort, type PlanForEffort } from "../pacing/resolveSegmentPlan";
import type { SegmentsStackParamList } from "../navigation/types";
import type { ColorToken } from "../theme/colors";
import { AppText, Card, EmptyState, ErrorState, LoadingState, Notice, ScreenScroll, Section, StatRow, StatTile } from "../theme/components";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { formatDurationMinutesSeconds, formatRideDate } from "./formatRideStats";
import { describeTargetOutcome } from "./describePlanPrediction";
import { formatTimeDelta } from "./formatTimeDelta";
import { PlanVsActualChart } from "./PlanVsActualChart";

type PlanVsActualRoute = RouteProp<SegmentsStackParamList, "PlanVsActual">;
type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

const PLAN_SOURCE_LABELS = { self: "Your plan", "human-coach": "Coach plan", "ai-coach": "AI coach plan" } as const;

interface LoadedComparison {
  segment: SegmentDetail;
  startTimestampMs: number;
  durationMs: number;
  plan: PlanForEffort;
  targetOutcome?: string;
  zones: PlanVsActualZone[];
  summary: PlanVsActualSummary;
  hasPowerTrack: boolean;
  reference?: { durationMs: number; date: number };
}

type LoadState = LoadedComparison | "missing" | "no-plan" | "error" | undefined;

/**
 * How an effort's power compared with the plan, zone by zone: summary, a plain-language read,
 * a chart of actual vs target, and a list with the time gained or lost per zone against your
 * best other attempt. The plan is the one your Karoo was holding for that ride when GritMap
 * recorded the send; otherwise the segment's plan as it is today -- and the screen says which.
 */
export function PlanVsActualScreen() {
  const database = useDatabase();
  const route = useRoute<PlanVsActualRoute>();
  const navigation = useNavigation<Navigation>();
  const [loaded, setLoaded] = useState<LoadState>(undefined);
  const [noPlanReason, setNoPlanReason] = useState<"no-ftp" | "no-goal" | undefined>(undefined);
  const [segmentIdForLinks, setSegmentIdForLinks] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    try {
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
      const sentPlan = getPlanSentBefore(database, segment.segmentId, attempt.startTimestampMs);
      const plan = resolvePlanForEffort({
        ...(sentPlan === undefined ? {} : { sentPlan }),
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
        ...(plan.kind === "sent" && plan.sent.targetFinishSeconds !== undefined
          ? { targetOutcome: describeTargetOutcome(plan.sent.targetFinishSeconds, attempt.endTimestampMs - attempt.startTimestampMs) }
          : {}),
        ...(best === undefined ? {} : { reference: { durationMs: best.durationMs, date: best.startTimestampMs } }),
      });
    } catch {
      setLoaded("error");
    }
  }, [database, route.params.attemptId]);

  useFocusEffect(load);

  if (loaded === undefined) {
    return (
      <ScreenScroll>
        <LoadingState label="Comparing your ride with the plan…" />
      </ScreenScroll>
    );
  }

  if (loaded === "error") {
    return (
      <ErrorState
        title="Couldn't compare this effort"
        message="GritMap couldn't read this ride to compare it with the plan. Go back and try again."
        onRetry={load}
      />
    );
  }

  if (loaded === "missing") {
    return (
      <ErrorState
        title="This effort is no longer available"
        message="It may have been removed when the segment or ride changed. Go back to the segment and pick another effort."
      />
    );
  }

  if (loaded === "no-plan") {
    const needsFtp = noPlanReason === "no-ftp";
    return (
      <EmptyState
        icon="flag"
        title="No plan to compare against"
        body={
          needsFtp
            ? "Set your FTP, then give this segment a goal time (or import a coach plan) and this screen will line your power up against it."
            : "Give this segment a goal time, or import a coach plan, and this screen will line your power up against it."
        }
        actions={[
          {
            label: needsFtp ? "Set your FTP" : "Open the segment",
            onPress: () =>
              needsFtp
                ? navigation.navigate("ZonesSettings")
                : segmentIdForLinks !== undefined && navigation.navigate("SegmentDetail", { segmentId: segmentIdForLinks }),
          },
        ]}
      />
    );
  }

  const { summary, zones, plan, reference } = loaded;
  const planLabel =
    plan.kind === "sent"
      ? `the plan sent to your Karoo on ${formatRideDate(plan.sent.sentAtMs)} (${describeSentPlanSource(plan.sent.generatorType, plan.sent.generatorModelVersion)})`
      : plan.kind === "imported"
        ? `${PLAN_SOURCE_LABELS[plan.plan.source]}${plan.plan.authorLabel === undefined ? "" : ` · ${plan.plan.authorLabel}`}`
        : plan.kind === "generated"
          ? `GritMap plan for a ${formatDurationMinutesSeconds(plan.goalDurationMs)} goal at ${Math.round(plan.ftpWatts)} W FTP`
          : "";

  return (
    <ScreenScroll>
      <View style={styles.heading}>
        <AppText variant="title2" accessibilityRole="header">
          {loaded.segment.name}
        </AppText>
        <AppText variant="subheadline" color="textSecondary">
          {formatRideDate(loaded.startTimestampMs)} · {formatDurationMinutesSeconds(loaded.durationMs)}
        </AppText>
      </View>
      <AppText variant="footnote" color="textSecondary">
        Compared with: {planLabel}.{" "}
        {plan.kind === "sent"
          ? "That is the plan your Karoo was holding for this ride."
          : "No send to a Karoo was recorded before this ride, so this is the segment's plan as it is today, which may differ from the plan you rode with."}
      </AppText>

      {!loaded.hasPowerTrack ? (
        <Notice tone="info">This effort has no power data, so it can't be compared with the plan.</Notice>
      ) : (
        <>
          <StatRow>
            <StatTile
              value={summary.averageActualWatts === null ? "—" : `${Math.round(summary.averageActualWatts)} W`}
              label={`Avg power (plan ${Math.round(summary.averageTargetWatts)} W)`}
            />
            <StatTile value={`${summary.zonesOnTarget}/${zones.length}`} label="Sections on target" />
            <StatTile
              value={summary.totalVsReferenceMs === null ? "—" : formatTimeDelta(summary.totalVsReferenceMs)}
              label={
                reference === undefined
                  ? "vs your best"
                  : `vs best other (${formatDurationMinutesSeconds(reference.durationMs)})`
              }
            />
          </StatRow>

          <Card>
            {loaded.targetOutcome === undefined ? null : <AppText variant="subheadline">• {loaded.targetOutcome}</AppText>}
            {summary.insights.map((line, index) => (
              <AppText key={index} variant="subheadline">
                • {line}
              </AppText>
            ))}
          </Card>

          <Section title="Power by section" description="Each bar is one section of the segment: the power you rode, against the plan's target.">
            <PlanVsActualChart zones={zones} />
          </Section>

          <Section title="Section detail">
            <View>
              {zones.map((zone) => (
                <ZoneRow key={zone.index} zone={zone} />
              ))}
            </View>
            {reference === undefined ? null : (
              <AppText variant="footnote" color="textSecondary">
                "Time" is gained (−) or lost (+) in that section against your best other attempt, from{" "}
                {formatRideDate(reference.date)}.
              </AppText>
            )}
          </Section>
        </>
      )}
    </ScreenScroll>
  );
}

function describeSentPlanSource(generatorType: string, modelVersion: string): string {
  if (generatorType === "phone-ai") return "GritMap generated plan";
  if (modelVersion === "human-coach") return "coach plan";
  if (modelVersion === "ai-coach") return "AI coach plan";
  if (modelVersion === "self") return "your own plan";
  return "imported plan";
}

const STATUS_PRESENTATION: Record<PlanVsActualZone["status"], { label: string; color: ColorToken }> = {
  over: { label: "Over plan", color: "statusWarning" },
  under: { label: "Under plan", color: "statusInfo" },
  on: { label: "On target", color: "statusSuccess" },
  nodata: { label: "No power data", color: "textSecondary" },
};

function ZoneRow({ zone }: { zone: PlanVsActualZone }) {
  const palette = useColors();
  const status = STATUS_PRESENTATION[zone.status];
  const range = `${Math.round(zone.startDistanceMeters)}–${Math.round(zone.endDistanceMeters)} m`;
  const actual = zone.actualPowerWatts === null ? "no power" : `${Math.round(zone.actualPowerWatts)} W`;
  const deviation =
    zone.deviationWatts === null ? undefined : `${zone.deviationWatts > 0 ? "+" : ""}${Math.round(zone.deviationWatts)} W`;
  const time = zone.timeVsReferenceMs === null ? undefined : formatTimeDelta(zone.timeVsReferenceMs);
  const details = [`Plan ${zone.targetPowerWatts} W`, `Actual ${actual}`, ...(time === undefined ? [] : [`Time ${time}`])].join(" · ");
  return (
    <View
      accessible
      accessibilityLabel={`Section ${zone.index + 1}, ${range}. ${status.label}${deviation === undefined ? "" : `, ${deviation}`}. ${details}`}
      style={[styles.zoneRow, { borderBottomColor: palette.border }]}
    >
      <View style={styles.zoneRowTop}>
        <AppText variant="subheadline" style={styles.zoneTitle}>
          {zone.index + 1} · {range}
        </AppText>
        <AppText variant="subheadline" color={status.color} style={styles.zoneStatus}>
          {status.label}
          {deviation === undefined ? "" : ` ${deviation}`}
        </AppText>
      </View>
      <AppText variant="footnote" color="textSecondary">
        {details}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.space4 },
  zoneRow: { paddingVertical: spacing.space12, gap: spacing.space2, borderBottomWidth: 1 },
  zoneRowTop: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.space8 },
  zoneTitle: { fontWeight: "600" },
  zoneStatus: { fontWeight: "600" },
});
