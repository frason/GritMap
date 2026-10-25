import { useCallback, useLayoutEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/DatabaseProvider";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import { listAttemptsForSegment, type AttemptSummary } from "../db/listAttemptsForSegment";
import { setActiveGoal as saveActiveGoal } from "../db/setActiveGoal";
import { deactivateSegmentPlan } from "../db/segmentPlans";
import type { RideTrackPoint } from "../db/getRideTrack";
import { computeSegmentElevationStats } from "../segments/computeSegmentElevationStats";
import { PHONE_SEND_BUTTON } from "../onboarding/onboardingCopy";
import { buildPlanScreenModel, type PlanScreenModel } from "../plans/planScreenModel";
import { loadPlanInput } from "../plans/loadPlanInput";
import { durationToInputs, validateGoalDraft } from "../plans/goalDraft";
import { PlanTab } from "../plans/PlanTab";
import type { SegmentsStackParamList } from "../navigation/types";
import { MIN_TOUCH_TARGET } from "../theme/layout";
import { spacing } from "../theme/spacing";
import { AppText, Button, Card, ErrorState, ListRow, LoadingState, Notice, ScreenScroll, StatRow, StatTile, TextField, UnderlineTabs } from "../theme/components";
import { ElevationProfileChart } from "./ElevationProfileChart";
import { RouteMapView } from "./RouteMapView";
import { formatDistanceMiles, formatDurationMinutesSeconds, formatElevationFeet, formatGradePercent, formatRideDate } from "./formatRideStats";

type PageRoute = RouteProp<SegmentsStackParamList, "SegmentPage">;
type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;
type TabKey = "plan" | "efforts" | "course";
const TABS = [
  { key: "plan", label: "Plan" },
  { key: "efforts", label: "Efforts" },
  { key: "course", label: "Course" },
] as const;

type Loaded = { segment: SegmentDetail; attempts: AttemptSummary[]; plan: PlanScreenModel };

/**
 * The segment page of the redesign: the map, the segment's numbers, then Plan / Efforts / Course.
 * It reads through the same database functions as the existing segment screen and sends through the
 * same Send to Karoo screen, so nothing about what is saved or sent changes.
 */
export function SegmentPageScreen() {
  const database = useDatabase();
  const route = useRoute<PageRoute>();
  const navigation = useNavigation<Navigation>();
  const [tab, setTab] = useState<TabKey>("plan");
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
  const [editingGoal, setEditingGoal] = useState(false);
  const [draft, setDraft] = useState({ minutes: "", seconds: "", longTermMinutes: "", longTermSeconds: "", removeLongTerm: false });
  const [draftError, setDraftError] = useState<string | undefined>(undefined);
  const segmentId = route.params.segmentId;

  useLayoutEffect(() => {
    navigation.setOptions({ title: "" });
  }, [navigation]);

  const load = useCallback(() => {
    try {
      const segment = getSegmentDetail(database, segmentId);
      if (segment === undefined) {
        setState("missing");
        return;
      }
      setLoaded({ segment, attempts: listAttemptsForSegment(database, segmentId), plan: buildPlanScreenModel(loadPlanInput(database, segment)) });
      setState("ready");
    } catch {
      setState("error");
    }
  }, [database, segmentId]);
  useFocusEffect(load);

  if (state === "loading") {
    return (
      <ScreenScroll>
        <LoadingState label="Loading segment…" />
      </ScreenScroll>
    );
  }
  if (state === "error") return <ErrorState message="GritMap couldn't open this segment. Go back and try again." onRetry={load} />;
  if (state === "missing" || loaded === undefined) {
    return <ErrorState title="This segment is no longer available" message="It may have been removed. Go back to your segments and pick another." />;
  }

  const { segment, attempts, plan } = loaded;
  const totalDistanceMeters = segment.referencePolyline.at(-1)?.distanceMeters ?? 0;
  const stats = computeSegmentElevationStats(segment.referencePolyline);
  // Efforts that count, fastest first: the two best are the default comparison.
  const counted = attempts
    .filter((attempt) => attempt.decision === "accept" || attempt.manuallyApproved)
    .sort((a, b) => a.endTimestampMs - a.startTimestampMs - (b.endTimestampMs - b.startTimestampMs));

  function startEditingGoal() {
    const goalMs = plan.kind === "plan" ? plan.goal?.nextMs : undefined;
    const longTermMs = plan.kind === "plan" ? plan.goal?.longTermMs : undefined;
    const goal = goalMs === undefined ? { minutes: "", seconds: "" } : durationToInputs(goalMs);
    const longTerm = longTermMs === undefined ? { minutes: "", seconds: "" } : durationToInputs(longTermMs);
    setDraft({ ...goal, longTermMinutes: longTerm.minutes, longTermSeconds: longTerm.seconds, removeLongTerm: false });
    setDraftError(undefined);
    setEditingGoal(true);
  }

  function saveGoal() {
    const result = validateGoalDraft(draft);
    if (!result.ok) {
      setDraftError(result.message);
      return;
    }
    saveActiveGoal(database, {
      segmentId: segment.segmentId,
      targetDurationMs: result.targetDurationMs,
      nowMs: Date.now(),
      ...(result.longTermDurationMs === undefined ? {} : { longTermDurationMs: result.longTermDurationMs }),
    });
    setEditingGoal(false);
    load();
  }

  function setGoalMs(durationMs: number) {
    saveActiveGoal(database, { segmentId: segment.segmentId, targetDurationMs: durationMs, nowMs: Date.now() });
    load();
  }

  return (
    <ScreenScroll padded={false}>
      <View style={styles.map} accessible accessibilityLabel="Map of this segment's route">
        <RouteMapView points={toRouteMapPoints(segment)} />
      </View>
      <View style={styles.content}>
        <AppText variant="title2" accessibilityRole="header">
          {segment.name}
        </AppText>
        <StatRow>
          <StatTile value={formatDistanceMiles(totalDistanceMeters)} label="Distance" />
          <StatTile value={formatElevationFeet(stats?.elevationGainMeters)} label="Elevation gain" />
          <StatTile value={formatGradePercent(stats?.averageGradePercent)} label="Average grade" />
        </StatRow>
        <UnderlineTabs tabs={TABS} selected={tab} onSelect={setTab} />

        {tab === "plan" ? (
          editingGoal ? (
            <Card>
              <AppText variant="headline">Your goal time</AppText>
              <View style={styles.inputRow}>
                <View style={styles.input}>
                  <TextField label="Minutes" value={draft.minutes} onChangeText={(minutes) => setDraft({ ...draft, minutes })} keyboardType="number-pad" />
                </View>
                <View style={styles.input}>
                  <TextField label="Seconds" value={draft.seconds} onChangeText={(seconds) => setDraft({ ...draft, seconds })} keyboardType="number-pad" placeholder="00" />
                </View>
              </View>
              <AppText variant="subheadline" color="textSecondary">
                Long-term goal (optional): a faster time to keep working towards. Your plan is built for the goal above.
              </AppText>
              <View style={styles.inputRow}>
                <View style={styles.input}>
                  <TextField label="Long-term minutes" value={draft.longTermMinutes} onChangeText={(longTermMinutes) => setDraft({ ...draft, longTermMinutes, removeLongTerm: false })} keyboardType="number-pad" />
                </View>
                <View style={styles.input}>
                  <TextField label="Long-term seconds" value={draft.longTermSeconds} onChangeText={(longTermSeconds) => setDraft({ ...draft, longTermSeconds, removeLongTerm: false })} keyboardType="number-pad" placeholder="00" />
                </View>
              </View>
              {draftError === undefined ? null : <Notice tone="error" live>{draftError}</Notice>}
              <Button label="Save goal" onPress={saveGoal} />
              <Button label="Cancel" variant="tertiary" fullWidth={false} onPress={() => setEditingGoal(false)} />
            </Card>
          ) : (
            <PlanTab
              model={plan}
              referencePolyline={segment.referencePolyline}
              sendLabel={PHONE_SEND_BUTTON}
              onSend={() => navigation.navigate("SendToKaroo", { segmentId: segment.segmentId })}
              onEditGoal={startEditingGoal}
              onSetGoalToBeatBest={setGoalMs}
              onSetNextGoal={setGoalMs}
              onImportPlan={() => navigation.navigate("ImportCoachPlan", { segmentId: segment.segmentId })}
              onUseGeneratedPlan={() => {
                deactivateSegmentPlan(database, segment.segmentId);
                load();
              }}
              onOpenProfile={() => navigation.navigate("ZonesSettings", { returnAfterSave: true })}
            />
          )
        ) : null}

        {tab === "efforts" ? (
          attempts.length === 0 ? (
            <Card>
              <AppText variant="headline">No efforts yet</AppText>
              <AppText variant="subheadline" color="textSecondary">Ride this segment and import the ride. Your times show up here.</AppText>
            </Card>
          ) : (
            <View>
              {counted.length < 2 ? null : (
                <Button
                  label="Compare your two best efforts"
                  variant="secondary"
                  onPress={() => navigation.navigate("AttemptComparison", { primaryAttemptId: counted[0]!.attemptId, comparisonAttemptId: counted[1]!.attemptId })}
                  accessibilityHint="Shows where you gained or lost time. You can swap either effort there."
                />
              )}
              {[...attempts]
                .sort((a, b) => b.startTimestampMs - a.startTimestampMs)
                .map((attempt) => (
                  <ListRow
                    key={attempt.attemptId}
                    icon="clock"
                    title={formatDurationMinutesSeconds(attempt.endTimestampMs - attempt.startTimestampMs)}
                    subtitle={formatRideDate(attempt.startTimestampMs)}
                    onPress={() => navigation.navigate("AttemptReview", { attemptId: attempt.attemptId })}
                  />
                ))}
            </View>
          )
        ) : null}

        {tab === "course" ? <ElevationProfileChart referencePolyline={segment.referencePolyline} /> : null}
      </View>
    </ScreenScroll>
  );
}

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
  map: { height: 260 },
  content: { padding: spacing.space16, gap: spacing.space16 },
  inputRow: { flexDirection: "row", gap: spacing.space12 },
  input: { flex: 1, minHeight: MIN_TOUCH_TARGET },
});
