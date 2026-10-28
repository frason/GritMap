import { useCallback, useLayoutEffect, useState } from "react";
import { ActionSheetIOS, Alert, Modal, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/DatabaseProvider";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import { listAttemptsForSegment, type AttemptSummary } from "../db/listAttemptsForSegment";
import { setSegmentGoal as saveActiveGoal } from "../db/setActiveGoal";
import { deactivateSegmentPlan } from "../db/segmentPlans";
import { deleteSegment } from "../db/deleteSegment";
import type { RideTrackPoint } from "../db/getRideTrack";
import { computeSegmentElevationStats } from "../segments/computeSegmentElevationStats";
import { SEGMENT_MENU_ACTIONS, segmentMenuKeyAt, segmentMenuOptions, type SegmentMenuKey } from "../plans/segmentMenu";
import { buildPlanScreenModel, type PlanScreenModel } from "../plans/planScreenModel";
import { loadPlanInput } from "../plans/loadPlanInput";
import { durationToInputs, validateGoalDraft } from "../plans/goalDraft";
import { ResultsChart } from "../plans/ResultsChart";
import { gapToBestLabel, resultsPoints } from "../plans/resultsView";
import { PlanTab } from "../plans/PlanTab";
import type { SegmentsStackParamList } from "../navigation/types";
import { MIN_TOUCH_TARGET } from "../theme/layout";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { AppText, Button, Card, ErrorState, HeaderButton, ListRow, LoadingState, Notice, ScreenScroll, StatRow, StatTile, TextField, UnderlineTabs } from "../theme/components";
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
  const colors = useColors();
  const [tab, setTab] = useState<TabKey>("efforts");
  const [selectedId, setSelectedId] = useState<string | undefined>(route.params.highlightAttemptId);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
  const [editingGoal, setEditingGoal] = useState(false);
  const [draft, setDraft] = useState({ minutes: "", seconds: "", longTermMinutes: "", longTermSeconds: "", removeLongTerm: false });
  const [draftError, setDraftError] = useState<string | undefined>(undefined);
  const segmentId = route.params.segmentId;

  const segmentName = loaded?.segment.name;
  useLayoutEffect(() => {
    navigation.setOptions({
      title: "",
      headerRight: () =>
        segmentName === undefined ? null : (
          <HeaderButton icon="more" accessibilityLabel="More actions" accessibilityHint="Send to your Karoo or delete this segment" onPress={() => openMenu(segmentName)} />
        ),
    });
    // openMenu only uses values that change with segmentName, the database and the navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, segmentName]);

  function openMenu(name: string) {
    const confirmDelete = () =>
      Alert.alert("Delete segment?", `"${name}" and the efforts found on it will be removed. Your rides are not affected.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteSegment(database, segmentId);
            navigation.goBack();
          },
        },
      ]);
    const run = (key: SegmentMenuKey | undefined) => {
      if (key === "send") navigation.navigate("SendToKaroo", { segmentId });
      else if (key === "delete") confirmDelete();
    };
    if (Platform.OS === "ios") {
      const options = segmentMenuOptions();
      ActionSheetIOS.showActionSheetWithOptions({ options, destructiveButtonIndex: 1, cancelButtonIndex: options.length - 1 }, (index) => run(segmentMenuKeyAt(index)));
      return;
    }
    Alert.alert(name, undefined, [
      ...SEGMENT_MENU_ACTIONS.map((action) => ({ text: action.label, ...(action.destructive ? { style: "destructive" as const } : {}), onPress: () => run(action.key) })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

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

  const resultPoints = resultsPoints(counted.map((attempt) => ({ attemptId: attempt.attemptId, startTimestampMs: attempt.startTimestampMs, durationMs: attempt.endTimestampMs - attempt.startTimestampMs })));
  const bestMs = resultPoints.find((point) => point.isBest)?.durationMs;
  // Without a tapped or passed-in effort, the latest counted one is selected.
  const activeId = selectedId ?? resultPoints.at(-1)?.attemptId;

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
          <PlanTab
            model={plan}
            referencePolyline={segment.referencePolyline}
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
        ) : null}

        {tab === "efforts" ? (
          attempts.length === 0 ? (
            <Card>
              <AppText variant="headline">No efforts yet</AppText>
              <AppText variant="subheadline" color="textSecondary">Ride this segment and import the ride. Your times show up here.</AppText>
            </Card>
          ) : (
            <View style={styles.results}>
              <AppText variant="headline" accessibilityRole="header">
                Your results
              </AppText>
              {resultPoints.length === 0 ? null : <ResultsChart points={resultPoints} selectedId={activeId} onSelect={setSelectedId} />}
              {counted.length < 2 ? null : (
                <Button
                  label="Compare your two best efforts"
                  variant="secondary"
                  onPress={() => navigation.navigate("AttemptComparison", { primaryAttemptId: counted[0]!.attemptId, comparisonAttemptId: counted[1]!.attemptId })}
                  accessibilityHint="Shows where you gained or lost time. You can swap either effort there."
                />
              )}
              <View>
                {[...attempts]
                  .sort((a, b) => b.startTimestampMs - a.startTimestampMs)
                  .map((attempt) => {
                    const durationMs = attempt.endTimestampMs - attempt.startTimestampMs;
                    const isCounted = attempt.decision === "accept" || attempt.manuallyApproved;
                    const gap = isCounted ? gapToBestLabel(durationMs, bestMs, formatDurationMinutesSeconds) : "Needs your review";
                    return (
                      <ListRow
                        key={attempt.attemptId}
                        title={formatDurationMinutesSeconds(durationMs)}
                        subtitle={[formatRideDate(attempt.startTimestampMs), gap].filter(Boolean).join(" · ")}
                        {...(attempt.attemptId === activeId ? { selected: true } : {})}
                        onPress={() => (attempt.attemptId === activeId || !isCounted ? navigation.navigate("AttemptReview", { attemptId: attempt.attemptId }) : setSelectedId(attempt.attemptId))}
                        accessibilityHint={attempt.attemptId === activeId || !isCounted ? "Opens this effort" : "Selects this effort"}
                      />
                    );
                  })}
              </View>
            </View>
          )
        ) : null}

        {tab === "course" ? <ElevationProfileChart referencePolyline={segment.referencePolyline} /> : null}
      </View>
      <Modal visible={editingGoal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingGoal(false)}>
        <ScrollView style={{ backgroundColor: colors.surface }} contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.sheetContent}>
            <AppText variant="title2" accessibilityRole="header">Your goal time</AppText>
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
          </View>
        </ScrollView>
      </Modal>
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
  results: { gap: spacing.space12 },
  sheetScroll: { padding: spacing.space16 },
  sheetContent: { gap: spacing.space16 },
  inputRow: { flexDirection: "row", gap: spacing.space12 },
  input: { flex: 1, minHeight: MIN_TOUCH_TARGET },
});
