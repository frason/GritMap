import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useDatabase } from "../db/DatabaseProvider";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import { listAttemptsForSegment, type AttemptSummary } from "../db/listAttemptsForSegment";
import { getAttemptDetail } from "../db/getAttemptDetail";
import { getAttemptTrack } from "../db/getAttemptTrack";
import { getAthleteProfile, type AthleteProfile } from "../db/getAthleteProfile";
import { getActiveGoal, type ActiveGoal } from "../db/getActiveGoal";
import { setActiveGoal as saveActiveGoal } from "../db/setActiveGoal";
import {
  deactivateSegmentPlan,
  getActiveSegmentPlan,
  isSegmentPlanOutdated,
  markSegmentPlanSent,
  type SavedSegmentPlan,
} from "../db/segmentPlans";
import type { RideTrackPoint } from "../db/getRideTrack";
import { runMatcherForSegment, type MatchRunSummary } from "../matcher/runMatcher";
import { computeSegmentElevationStats } from "../segments/computeSegmentElevationStats";
import { computeAnchorPowerWatts } from "../pacing/powerDurationAnchor";
import { computeAdaptiveZoneGrades } from "../pacing/computeZoneGrades";
import { buildTargetPowerZones } from "../pacing/buildTargetPowerZones";
import { summarizeCoachPlan } from "../pacing/coachPlan";
import { loadCalibrationAttempts } from "../pacing/loadCalibrationAttempts";
import { predictPlanFinish, type PlanFinishPrediction } from "../pacing/predictPlanFinish";
import { PredictedFinish } from "./PredictedFinish";
import { parseTargetDurationInput } from "./parseTargetDuration";
import type { RootTabParamList, SegmentsStackParamList } from "../navigation/types";
import { sendGuidancePackageToKaroo } from "../karoo/sendGuidancePackageToKaroo";
import { describeSendResult } from "../karoo/describeSendResult";
import { KAROO_ADDRESS_EXAMPLE, KAROO_RECEIVE_SCREEN, PHONE_SEND_BUTTON } from "../onboarding/onboardingCopy";
import { recordPlanSend } from "../db/planSends";
import { getSavedKarooAddress, saveKarooAddress } from "../karoo/savedKarooAddress";
import type { IconName } from "../theme/icons";
import { MIN_TOUCH_TARGET, SCREEN_PADDING } from "../theme/layout";
import { radius, spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { RouteMapView } from "./RouteMapView";
import { ElevationSparkline } from "./ElevationSparkline";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  AppText,
  Button,
  Card,
  ErrorState,
  HeaderButton,
  ListRow,
  LoadingState,
  Notice,
  ScreenScroll,
  Section,
  StatRow,
  StatTile,
  TextField,
} from "../theme/components";
import { ElevationProfileChart, type ChartPlanZone } from "./ElevationProfileChart";
import {
  formatDistanceMiles,
  formatDurationHoursMinutes,
  formatDurationMinutesSeconds,
  formatElevationFeet,
  formatGradePercent,
  formatRideDate,
  formatSpeedMph,
} from "./formatRideStats";

type SegmentDetailRoute = RouteProp<SegmentsStackParamList, "SegmentDetail">;
type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

const generateId = () => Crypto.randomUUID();

const PLAN_SOURCE_LABELS = { self: "Your plan", "human-coach": "Coach plan", "ai-coach": "AI coach plan" } as const;

interface AnalyzeEffortSummary {
  avgPowerWatts?: number;
  avgHeartRateBpm?: number;
  avgSpeedMetersPerSecond?: number;
}

function bestByDuration(attempts: readonly AttemptSummary[]): AttemptSummary | undefined {
  return attempts.reduce<AttemptSummary | undefined>((best, attempt) => {
    const duration = attempt.endTimestampMs - attempt.startTimestampMs;
    const bestDuration = best === undefined ? Infinity : best.endTimestampMs - best.startTimestampMs;
    return duration < bestDuration ? attempt : best;
  }, undefined);
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

type LoadState = "loading" | "ready" | "missing" | "error";
type SendStatus = { text: string; ok: boolean };

export function SegmentDetailScreen() {
  const database = useDatabase();
  const route = useRoute<SegmentDetailRoute>();
  const navigation = useNavigation<Navigation>();
  const scrollViewRef = useRef<ScrollView>(null);
  const [attemptsSectionY, setAttemptsSectionY] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [segment, setSegment] = useState<SegmentDetail | undefined>(undefined);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [athleteProfile, setAthleteProfile] = useState<AthleteProfile>({});
  const [activeGoal, setActiveGoal] = useState<ActiveGoal | undefined>(undefined);
  const [activePlan, setActivePlan] = useState<SavedSegmentPlan | undefined>(undefined);
  const [planPrediction, setPlanPrediction] = useState<PlanFinishPrediction | undefined>(undefined);
  const [otherGoalSegmentName, setOtherGoalSegmentName] = useState<string | undefined>(undefined);
  const [analyzeEffortSummary, setAnalyzeEffortSummary] = useState<AnalyzeEffortSummary | undefined>(undefined);
  const [goalMinutesInput, setGoalMinutesInput] = useState("");
  const [goalSecondsInput, setGoalSecondsInput] = useState("");
  const [goalSaveError, setGoalSaveError] = useState<string | undefined>(undefined);
  const [editingGoal, setEditingGoal] = useState(false);
  const [karooAddress, setKarooAddress] = useState("");
  const [pacingSending, setPacingSending] = useState(false);
  const [pacingSendStatus, setPacingSendStatus] = useState<SendStatus | undefined>(undefined);
  const [rerunning, setRerunning] = useState(false);
  const [rerunSummary, setRerunSummary] = useState<MatchRunSummary | undefined>(undefined);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedAttemptIds, setSelectedAttemptIds] = useState<string[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <HeaderButton icon="more" accessibilityLabel="More actions for this segment" onPress={() => setMenuVisible(true)} />,
    });
  }, [navigation]);

  const load = useCallback(() => {
    try {
      const currentAttempts = listAttemptsForSegment(database, route.params.segmentId);
      const currentGoal = getActiveGoal(database);
      const currentSegment = getSegmentDetail(database, route.params.segmentId);
      if (currentSegment === undefined) {
        setSegment(undefined);
        setLoadState("missing");
        return;
      }

      setSegment(currentSegment);
      setAttempts(currentAttempts);
      const currentProfile = getAthleteProfile(database);
      setAthleteProfile(currentProfile);
      setKarooAddress((current) => (current === "" ? (getSavedKarooAddress(database) ?? "") : current));
      setActiveGoal(currentGoal);
      const currentPlan = getActiveSegmentPlan(database, route.params.segmentId);
      setActivePlan(currentPlan);
      setPlanPrediction(
        currentPlan !== undefined && currentProfile.weightKg !== undefined
          ? predictPlanFinish({
              zones: currentPlan.zones,
              referencePolyline: currentSegment.referencePolyline,
              riderWeightKg: currentProfile.weightKg,
              attempts: loadCalibrationAttempts(database, route.params.segmentId),
            })
          : undefined,
      );
      setGoalMinutesInput("");
      setGoalSecondsInput("");
      setGoalSaveError(undefined);
      setOtherGoalSegmentName(
        currentGoal !== undefined && currentGoal.segmentId !== route.params.segmentId
          ? getSegmentDetail(database, currentGoal.segmentId)?.name
          : undefined,
      );

      const currentValidAttempts = currentAttempts.filter(
        (attempt) => attempt.decision === "accept" || attempt.manuallyApproved,
      );
      const currentBestAttempt = bestByDuration(currentValidAttempts);
      if (currentBestAttempt === undefined) {
        setAnalyzeEffortSummary(undefined);
      } else {
        const detail = getAttemptDetail(database, currentBestAttempt.attemptId);
        if (detail === undefined) {
          setAnalyzeEffortSummary(undefined);
        } else {
          const track = getAttemptTrack(database, detail.rideId, detail.startPointIndex, detail.endPointIndex);
          const powers = track.map((point) => point.power).filter((value): value is number => value !== undefined);
          const heartRates = track
            .map((point) => point.heartRate)
            .filter((value): value is number => value !== undefined);
          const durationSeconds = (currentBestAttempt.endTimestampMs - currentBestAttempt.startTimestampMs) / 1_000;
          const totalDistanceMeters = track.length > 0 ? track[track.length - 1]!.distanceMeters : undefined;
          setAnalyzeEffortSummary({
            ...(powers.length > 0 ? { avgPowerWatts: average(powers) } : {}),
            ...(heartRates.length > 0 ? { avgHeartRateBpm: average(heartRates) } : {}),
            ...(totalDistanceMeters !== undefined && durationSeconds > 0
              ? { avgSpeedMetersPerSecond: totalDistanceMeters / durationSeconds }
              : {}),
          });
        }
      }
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [database, route.params.segmentId]);

  useFocusEffect(load);

  function handleRerunMatcher() {
    setRerunning(true);
    setRerunSummary(runMatcherForSegment(database, generateId, route.params.segmentId, Date.now()));
    setAttempts(listAttemptsForSegment(database, route.params.segmentId));
    setRerunning(false);
  }

  function toggleCompareMode() {
    setCompareMode((wasOn) => !wasOn);
    setSelectedAttemptIds([]);
  }

  function toggleAttemptSelected(attemptId: string) {
    setSelectedAttemptIds((current) => {
      if (current.includes(attemptId)) {
        return current.filter((id) => id !== attemptId);
      }
      // Cap at two -- MVP.md's comparison screen always compares exactly two attempts.
      return current.length >= 2 ? current : [...current, attemptId];
    });
  }

  function handleCompareSelected() {
    const [primaryAttemptId, comparisonAttemptId] = selectedAttemptIds;
    if (primaryAttemptId === undefined || comparisonAttemptId === undefined) return;
    setCompareMode(false);
    setSelectedAttemptIds([]);
    navigation.navigate("AttemptComparison", { primaryAttemptId, comparisonAttemptId });
  }

  function handleSaveGoal() {
    if (!segment) return;
    const targetDurationMs = parseTargetDurationInput(goalMinutesInput, goalSecondsInput);
    if (targetDurationMs === undefined) {
      setGoalSaveError("Enter a target time, for example 40 minutes and 0 seconds.");
      return;
    }
    saveActiveGoal(database, { segmentId: segment.segmentId, targetDurationMs, nowMs: Date.now() });
    setActiveGoal({ segmentId: segment.segmentId, targetDurationMs });
    setOtherGoalSegmentName(undefined);
    setGoalMinutesInput("");
    setGoalSecondsInput("");
    setGoalSaveError(undefined);
    setEditingGoal(false);
  }

  function handleStartEditingGoal() {
    if (activeGoal !== undefined && segment !== undefined && activeGoal.segmentId === segment.segmentId) {
      setGoalMinutesInput(String(Math.floor(activeGoal.targetDurationMs / 60_000)));
      setGoalSecondsInput(String(Math.round((activeGoal.targetDurationMs % 60_000) / 1_000)));
    }
    setGoalSaveError(undefined);
    setEditingGoal(true);
  }

  if (loadState === "loading") {
    return (
      <ScreenScroll>
        <LoadingState label="Loading segment…" />
      </ScreenScroll>
    );
  }
  if (loadState === "error") {
    return <ErrorState message="GritMap couldn't open this segment. Go back and try again." onRetry={load} />;
  }
  if (loadState === "missing" || !segment) {
    return <ErrorState title="This segment is no longer available" message="It may have been removed. Go back to your segments and pick another." />;
  }

  const totalDistanceMeters = segment.referencePolyline.at(-1)?.distanceMeters ?? 0;
  const elevationStats = computeSegmentElevationStats(segment.referencePolyline);
  const validAttempts = attempts.filter((attempt) => attempt.decision === "accept" || attempt.manuallyApproved);
  const mostRecentAttempt = [...attempts].sort((a, b) => b.startTimestampMs - a.startTimestampMs)[0];
  const bestAttempt = bestByDuration(validAttempts);
  const mostRecentValidAttempt = [...validAttempts].sort((a, b) => b.startTimestampMs - a.startTimestampMs)[0];

  function handleUseGeneratedPlan() {
    if (!segment) return;
    deactivateSegmentPlan(database, segment.segmentId);
    setActivePlan(undefined);
    setPacingSendStatus(undefined);
  }

  async function handleSendPacingPlan() {
    const { ftpWatts, weightKg, maxHeartRateBpm } = athleteProfile;
    if (!segment || ftpWatts === undefined || weightKg === undefined) return;
    if (activePlan === undefined && activeGoal === undefined) return;
    const trimmed = karooAddress.trim();
    if (trimmed.length === 0) {
      setPacingSendStatus({ text: `Type the address your Karoo shows on its ${KAROO_RECEIVE_SCREEN} screen.`, ok: false });
      return;
    }
    setPacingSending(true);
    setPacingSendStatus(undefined);
    const packageId = generateId();
    const sentAtMs = Date.now();
    const result = await sendGuidancePackageToKaroo(
      segment,
      { ftpWatts, weightKg, ...(maxHeartRateBpm === undefined ? {} : { maxHeartRateBpm }) },
      activePlan === undefined ? activeGoal?.targetDurationMs : undefined,
      trimmed,
      packageId,
      sentAtMs,
      // A coach plan with no target time of its own gets the predicted finish, so the Karoo's
      // "Goal" and its pacer have a time to work to instead of "Fastest sustainable".
      activePlan !== undefined && activePlan.targetFinishSeconds === undefined && planPrediction !== undefined
        ? { ...activePlan, targetFinishSeconds: Math.round(planPrediction.durationMs / 1_000) }
        : activePlan,
    );
    setPacingSending(false);
    // Keep what the Karoo was handed, so a later ride is judged against this plan and not against
    // whatever the segment's plan has become by then.
    if (result.ok && result.baselinePlan !== undefined) {
      recordPlanSend(database, {
        id: generateId(),
        segmentId: segment.segmentId,
        sentAtMs,
        packageId,
        plan: result.baselinePlan,
      });
    }
    if (result.ok && activePlan !== undefined) {
      markSegmentPlanSent(database, activePlan.id, Date.now());
      setActivePlan(getActiveSegmentPlan(database, activePlan.segmentId));
    }
    if (result.ok) setKarooAddress(saveKarooAddress(database, trimmed, Date.now()));
    setPacingSendStatus({ text: describeSendResult(result, trimmed), ok: result.ok });
  }

  const goToProfile = () => navigation.navigate("ZonesSettings");
  const sendBlock = (disabled: boolean) => (
    <KarooSendBlock
      hasWeight={athleteProfile.weightKg !== undefined}
      address={karooAddress}
      onAddressChange={setKarooAddress}
      sending={pacingSending}
      disabled={disabled}
      status={pacingSendStatus}
      onSend={handleSendPacingPlan}
      onSetWeight={goToProfile}
    />
  );

  // Goal & Pacing Plan: computed here (not deep in JSX) so the resulting zones can also
  // feed the Elevation Profile chart below without computing them twice.
  let pacingPlanBody: ReactNode;
  let pacingZones: readonly ChartPlanZone[] | undefined;
  const goalIsForThisSegment = activeGoal !== undefined && activeGoal.segmentId === segment.segmentId;

  if (athleteProfile.ftpWatts === undefined) {
    pacingPlanBody = (
      <Card>
        <AppText variant="subheadline" color="textSecondary">
          GritMap builds a pacing plan from your FTP (the power you can hold for about an hour) and the time you want to ride this segment in.
        </AppText>
        <Button label="Set your FTP to get a pacing plan" onPress={goToProfile} />
      </Card>
    );
  } else if (activePlan !== undefined) {
    pacingZones = activePlan.zones;
    const summary = summarizeCoachPlan(activePlan.zones, activePlan.ftpWatts);
    const outdated = isSegmentPlanOutdated(activePlan, athleteProfile.ftpWatts);
    pacingPlanBody = (
      <Card>
        <View style={styles.summaryRow}>
          <AppText variant="headline" style={styles.summaryTitle}>
            {PLAN_SOURCE_LABELS[activePlan.source]}
            {activePlan.authorLabel === undefined ? "" : ` · ${activePlan.authorLabel}`}
          </AppText>
          <Button
            label="Replace"
            variant="tertiary"
            fullWidth={false}
            accessibilityHint="Import a different plan for this segment"
            onPress={() => navigation.navigate("ImportCoachPlan", { segmentId: segment.segmentId })}
          />
        </View>
        <AppText variant="subheadline" color="textSecondary">
          {summary.zoneCount} sections · about {summary.averagePowerWatts} W on average ({summary.percentOfFtp}% of your FTP)
          {activePlan.targetFinishSeconds === undefined
            ? ""
            : ` · target ${formatDurationMinutesSeconds(activePlan.targetFinishSeconds * 1_000)}`}
        </AppText>
        {activePlan.notes === undefined ? null : (
          <AppText variant="subheadline" color="textSecondary">
            {activePlan.notes}
          </AppText>
        )}
        {planPrediction !== undefined ? (
          <PredictedFinish
            prediction={planPrediction}
            {...(goalIsForThisSegment && activeGoal !== undefined ? { goalDurationMs: activeGoal.targetDurationMs } : {})}
            {...(activePlan.targetFinishSeconds === undefined
              ? { targetNote: "Sent to the Karoo as this plan's target time." }
              : { coachTargetSeconds: activePlan.targetFinishSeconds })}
          />
        ) : athleteProfile.weightKg === undefined ? (
          <Button label="Set your weight to see a predicted finish time" variant="tertiary" fullWidth={false} onPress={goToProfile} />
        ) : null}
        {outdated ? (
          <Notice tone="warning">
            {`Written for an FTP of ${activePlan.ftpWatts} W; yours is now ${Math.round(athleteProfile.ftpWatts)} W. Import an updated plan, or switch back to GritMap's own plan, before sending.`}
          </Notice>
        ) : null}
        {sendBlock(outdated)}
        {activePlan.lastSentAtMs === undefined ? null : (
          <AppText variant="footnote" color="textSecondary">
            Last sent {formatRideDate(activePlan.lastSentAtMs)}
          </AppText>
        )}
        <Button label="Use GritMap's own plan instead" variant="tertiary" fullWidth={false} onPress={handleUseGeneratedPlan} />
      </Card>
    );
  } else if (editingGoal || !goalIsForThisSegment) {
    pacingPlanBody = (
      <Card>
        <AppText variant="subheadline" color="textSecondary">
          Tell GritMap how fast you want to ride this segment and it builds a power plan for each section of it.
        </AppText>
        {activeGoal !== undefined && !goalIsForThisSegment ? (
          <Notice tone="info">
            {`Your current goal is on ${otherGoalSegmentName ?? "another segment"}: ${formatDurationMinutesSeconds(activeGoal.targetDurationMs)}. Saving a goal here switches it to this segment.`}
          </Notice>
        ) : null}
        <View style={styles.goalInputRow}>
          <View style={styles.goalInput}>
            <TextField label="Minutes" value={goalMinutesInput} onChangeText={setGoalMinutesInput} keyboardType="number-pad" placeholder="40" />
          </View>
          <View style={styles.goalInput}>
            <TextField label="Seconds" value={goalSecondsInput} onChangeText={setGoalSecondsInput} keyboardType="number-pad" placeholder="00" />
          </View>
        </View>
        {goalSaveError === undefined ? null : <Notice tone="error" live>{goalSaveError}</Notice>}
        <Button label="Save goal" onPress={handleSaveGoal} />
        {goalIsForThisSegment ? <Button label="Cancel" variant="tertiary" fullWidth={false} onPress={() => setEditingGoal(false)} /> : null}
      </Card>
    );
  } else {
    const ftpWatts = athleteProfile.ftpWatts;
    const anchorPowerWatts = computeAnchorPowerWatts(ftpWatts, activeGoal.targetDurationMs);
    const zoneWindows = computeAdaptiveZoneGrades(segment.referencePolyline);
    pacingZones = buildTargetPowerZones(zoneWindows, anchorPowerWatts, ftpWatts);
    const pctFtp = Math.round((anchorPowerWatts / ftpWatts) * 100);

    pacingPlanBody = (
      <Card>
        <View style={styles.summaryRow}>
          <AppText variant="headline" style={styles.summaryTitle}>
            Goal {formatDurationMinutesSeconds(activeGoal.targetDurationMs)}
          </AppText>
          <Button label="Change" variant="tertiary" fullWidth={false} accessibilityHint="Edit your goal time" onPress={handleStartEditingGoal} />
        </View>
        <AppText variant="subheadline" color="textSecondary">
          GritMap's plan: about {Math.round(anchorPowerWatts)} W on average ({pctFtp}% of your FTP), adjusted for each section's gradient.
        </AppText>
        {sendBlock(false)}
      </Card>
    );
  }

  return (
    <>
      <ScreenScroll padded={false} scrollRef={scrollViewRef}>
        <View style={styles.heroMap} accessible accessibilityLabel="Map of this segment's route">
          <RouteMapView points={toRouteMapPoints(segment)} />
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <AppText variant="title2" accessibilityRole="header" style={styles.title}>
              {segment.name}
            </AppText>
            <ElevationSparkline referencePolyline={segment.referencePolyline} />
          </View>

          <StatRow>
            <StatTile value={formatDistanceMiles(totalDistanceMeters)} label="Distance" />
            <StatTile value={formatElevationFeet(elevationStats?.elevationGainMeters)} label="Elevation gain" />
            <StatTile value={formatGradePercent(elevationStats?.averageGradePercent)} label="Average grade" />
          </StatRow>

          <Section title="Your efforts">
            {attempts.length === 0 ? (
              <Card>
                <AppText variant="headline">No efforts yet</AppText>
                <AppText variant="subheadline" color="textSecondary">
                  Ride this segment, then import the ride file (Rides tab, then Import). Your time, how you did against your plan, and your progress on it show up here.
                </AppText>
                <Button
                  label="Import a ride"
                  icon="download"
                  variant="secondary"
                  onPress={() => navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate("RidesTab", { screen: "Import" })}
                />
              </Card>
            ) : (
              <View>
                {mostRecentAttempt !== undefined && (
                  <ListRow
                    icon="clock"
                    title={formatDurationMinutesSeconds(mostRecentAttempt.endTimestampMs - mostRecentAttempt.startTimestampMs)}
                    subtitle={`Most recent — ${formatRideDate(mostRecentAttempt.startTimestampMs)}`}
                    onPress={() => navigation.navigate("AttemptReview", { attemptId: mostRecentAttempt.attemptId })}
                  />
                )}
                {bestAttempt !== undefined && (
                  <ListRow
                    icon="medal"
                    title={`Personal record — ${formatDurationMinutesSeconds(bestAttempt.endTimestampMs - bestAttempt.startTimestampMs)}`}
                    subtitle={formatRideDate(bestAttempt.startTimestampMs)}
                    onPress={() => navigation.navigate("AttemptReview", { attemptId: bestAttempt.attemptId })}
                  />
                )}
                {mostRecentValidAttempt !== undefined && (
                  <ListRow
                    icon="flag"
                    title="Plan vs actual"
                    subtitle="Your most recent effort against your plan"
                    onPress={() => navigation.navigate("PlanVsActual", { attemptId: mostRecentValidAttempt.attemptId })}
                  />
                )}
                <ListRow
                  icon="list"
                  title="All your efforts"
                  subtitle={`${attempts.length} effort${attempts.length === 1 ? "" : "s"}`}
                  onPress={() => scrollViewRef.current?.scrollTo({ y: attemptsSectionY, animated: true })}
                  accessibilityHint="Scrolls down to the list of efforts"
                />
                {bestAttempt !== undefined && analyzeEffortSummary !== undefined && (
                  <ListRow
                    icon="pulse"
                    title="Analyze effort"
                    subtitle={[
                      analyzeEffortSummary.avgSpeedMetersPerSecond !== undefined
                        ? formatSpeedMph(analyzeEffortSummary.avgSpeedMetersPerSecond)
                        : undefined,
                      analyzeEffortSummary.avgPowerWatts !== undefined ? `${Math.round(analyzeEffortSummary.avgPowerWatts)} W` : undefined,
                      analyzeEffortSummary.avgHeartRateBpm !== undefined ? `${Math.round(analyzeEffortSummary.avgHeartRateBpm)} bpm` : undefined,
                    ]
                      .filter((part): part is string => part !== undefined)
                      .join(" · ")}
                    onPress={() => navigation.navigate("AttemptReview", { attemptId: bestAttempt.attemptId })}
                  />
                )}
              </View>
            )}
          </Section>

          <Section title="Goal and pacing plan">{pacingPlanBody}</Section>

          {elevationStats !== undefined && (
            <Section
              title="Elevation profile"
              {...(pacingZones === undefined ? {} : { description: "Your pacing plan laid over the climb, one column per section." })}
            >
              <ElevationProfileChart referencePolyline={segment.referencePolyline} zones={pacingZones} />
            </Section>
          )}

          <View onLayout={(event) => setAttemptsSectionY(event.nativeEvent.layout.y)}>
            <Section title="All your efforts">
              {attempts.length === 0 ? (
                <AppText variant="subheadline" color="textSecondary">
                  No efforts found yet. Import rides that go over this segment and they will appear here.
                </AppText>
              ) : (
                <>
                  {attempts.length >= 2 && (
                    <Button
                      label={compareMode ? "Cancel comparing" : "Compare two attempts"}
                      variant="secondary"
                      onPress={toggleCompareMode}
                    />
                  )}
                  {validAttempts.length >= 3 && (
                    <Button
                      label="See progress over time"
                      variant="secondary"
                      icon="pulse"
                      onPress={() =>
                        navigation.navigate("HistoricalBand", {
                          segmentId: route.params.segmentId,
                          currentAttemptId: validAttempts[0]!.attemptId,
                        })
                      }
                    />
                  )}
                  {compareMode && (
                    <AppText variant="subheadline" color="textSecondary" accessibilityLiveRegion="polite">
                      Select two attempts ({selectedAttemptIds.length}/2)
                    </AppText>
                  )}
                  <View>
                    {attempts.map((attempt) => {
                      const isPositive = attempt.manuallyApproved || attempt.decision === "accept";
                      const selected = selectedAttemptIds.includes(attempt.attemptId);
                      return (
                        <ListRow
                          key={attempt.attemptId}
                          icon={compareMode || isPositive ? "checkCircle" : "alertTriangle"}
                          iconColor={compareMode ? (selected ? "brand" : "textTertiary") : isPositive ? "statusSuccess" : "statusWarning"}
                          {...(compareMode ? { selected } : {})}
                          title={formatRideDate(attempt.startTimestampMs)}
                          subtitle={`${formatDurationHoursMinutes(attempt.endTimestampMs - attempt.startTimestampMs)} · ${Math.round(attempt.confidenceScore * 100)}% match${
                            attempt.manuallyApproved ? " · Approved" : isPositive ? "" : " · Needs your review"
                          }`}
                          onPress={() =>
                            compareMode
                              ? toggleAttemptSelected(attempt.attemptId)
                              : navigation.navigate("AttemptReview", { attemptId: attempt.attemptId })
                          }
                        />
                      );
                    })}
                  </View>
                  {compareMode && selectedAttemptIds.length === 2 && <Button label="Compare selected" onPress={handleCompareSelected} />}
                </>
              )}
              <Button label="Check my rides again" variant="secondary" icon="refresh" loading={rerunning} onPress={handleRerunMatcher} />
              {rerunSummary === undefined ? null : (
                <Notice tone="info" live>
                  {`Checked your rides: ${rerunSummary.inserted} new, ${rerunSummary.updated} updated, ${rerunSummary.duplicate} unchanged, ${rerunSummary.removed} removed.`}
                </Notice>
              )}
            </Section>
          </View>
        </View>
      </ScreenScroll>
      <ActionMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={[
          { label: "Send to Karoo", icon: "wifi", onPress: () => navigation.navigate("SendToKaroo", { segmentId: route.params.segmentId }) },
          { label: "Share to Open Segments", icon: "people", onPress: () => navigation.navigate("PublishToRegistry", { segmentId: route.params.segmentId }) },
          { label: "Import coach plan", icon: "download", onPress: () => navigation.navigate("ImportCoachPlan", { segmentId: route.params.segmentId }) },
        ]}
      />
    </>
  );
}

/** The address field, send button and result shared by the generated-plan and imported-plan states. */
function KarooSendBlock({
  hasWeight,
  address,
  onAddressChange,
  sending,
  disabled,
  status,
  onSend,
  onSetWeight,
}: {
  hasWeight: boolean;
  address: string;
  onAddressChange: (value: string) => void;
  sending: boolean;
  disabled: boolean;
  status: SendStatus | undefined;
  onSend: () => void;
  onSetWeight: () => void;
}) {
  if (!hasWeight) {
    return <Button label="Set your weight to send this plan to the Karoo" variant="tertiary" fullWidth={false} onPress={onSetWeight} />;
  }
  return (
    <>
      <AppText variant="footnote" color="textSecondary">
        On your Karoo, open GritMap and tap {KAROO_RECEIVE_SCREEN}; it shows the address to type here. Both devices need to be on the same Wi-Fi.
      </AppText>
      <TextField
        label="Karoo address"
        value={address}
        onChangeText={onAddressChange}
        placeholder={`e.g. ${KAROO_ADDRESS_EXAMPLE}`}
        keyboardType="url"
      />
      <Button label={PHONE_SEND_BUTTON} onPress={onSend} loading={sending} disabled={disabled} />
      {status === undefined ? null : (
        <Notice tone={status.ok ? "success" : "error"} live>
          {status.text}
        </Notice>
      )}
    </>
  );
}

interface ActionMenuItem {
  label: string;
  icon: IconName;
  onPress: () => void;
}

/** The segment's overflow menu: a card under the header button, with 44 pt rows and a tap-away backdrop. */
function ActionMenu({ visible, onClose, items }: { visible: boolean; onClose: () => void; items: readonly ActionMenuItem[] }) {
  const palette = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.menuBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      >
        <View
          accessibilityViewIsModal
          style={[styles.menuCard, { backgroundColor: palette.surface, borderColor: palette.border, marginTop: insets.top + MIN_TOUCH_TARGET }]}
        >
          {items.map((item) => (
            <ListRow
              key={item.label}
              title={item.label}
              icon={item.icon}
              showChevron={false}
              onPress={() => {
                onClose();
                item.onPress();
              }}
            />
          ))}
        </View>
      </Pressable>
    </Modal>
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

const styles = StyleSheet.create({
  heroMap: { height: 260 },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing.space16, gap: spacing.space24 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.space12 },
  title: { flex: 1 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.space8 },
  summaryTitle: { flex: 1 },
  goalInputRow: { flexDirection: "row", gap: spacing.space12 },
  goalInput: { flex: 1 },
  menuBackdrop: { flex: 1, alignItems: "flex-end", paddingRight: spacing.space16 },
  menuCard: { width: 300, maxWidth: "100%", borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.space16 },
});
