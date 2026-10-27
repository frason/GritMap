import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useDatabase } from "../db/DatabaseProvider";
import { getActiveGoal, listSegmentGoals, type ActiveGoal } from "../db/getActiveGoal";
import { setActiveGoal } from "../db/setActiveGoal";
import { listSegments, type SegmentSummary } from "../db/listSegments";
import { listAttemptsForSegment, type AttemptSummary } from "../db/listAttemptsForSegment";
import { listRides, type RideSummary } from "../db/listRides";
import { getAthleteProfile } from "../db/getAthleteProfile";
import { SetupChecklist } from "../onboarding/SetupChecklist";
import { setupSteps, shouldShowSetupChecklist, type SetupProgress, type SetupStepKey } from "../onboarding/setupSteps";
import { loadRideHighlights } from "../plans/loadRideHighlights";
import { loadRideSegmentLines } from "../plans/loadRideSegmentLines";
import type { PreviewPoint } from "../plans/segmentListView";
import { loadSegmentCards, type SegmentCardData } from "../plans/loadSegmentCards";
import type { RideSegmentHighlight } from "../plans/karooMarks";
import { RideMapCard } from "../plans/RideMapCard";
import { SegmentCard } from "../plans/SegmentCard";
import type { RootTabParamList } from "../navigation/types";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { formatDurationMinutesSeconds } from "./formatRideStats";
import { AppText, Button, Card, EmptyState, ListRow, Notice, ScreenScroll, Section, TextField } from "../theme/components";
import { parseTargetDurationInput } from "./parseTargetDuration";

type Navigation = BottomTabNavigationProp<RootTabParamList>;

export function HomeScreen() {
  const database = useDatabase();
  const navigation = useNavigation<Navigation>();
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [goal, setGoal] = useState<ActiveGoal | undefined>(undefined);
  const [otherGoals, setOtherGoals] = useState<ActiveGoal[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [lastRide, setLastRide] = useState<RideSummary | undefined>(undefined);
  const [lastRideHighlights, setLastRideHighlights] = useState<RideSegmentHighlight[]>([]);
  const [lastRideLines, setLastRideLines] = useState<PreviewPoint[][]>([]);
  const [sentCards, setSentCards] = useState<SegmentCardData[]>([]);
  const [setup, setSetup] = useState<SetupProgress>({ hasFtp: true, hasSegment: true, hasRide: true, hasSent: true });
  const [editingGoal, setEditingGoal] = useState(false);

  const refresh = useCallback(() => {
    const currentSegments = listSegments(database);
    const currentGoal = getActiveGoal(database);
    setSegments(currentSegments);
    setGoal(currentGoal);
    setOtherGoals(listSegmentGoals(database).filter((other) => other.segmentId !== currentGoal?.segmentId));
    setAttempts(currentGoal === undefined ? [] : listAttemptsForSegment(database, currentGoal.segmentId));
    const newest = listRides(database)[0];
    const cards = loadSegmentCards(database);
    setLastRide(newest);
    setSetup({
      hasFtp: getAthleteProfile(database).ftpWatts !== undefined,
      hasSegment: currentSegments.length > 0,
      hasRide: newest !== undefined,
      hasSent: cards.some((card) => card.sent),
    });
    setSentCards(cards.filter((card) => card.sent));
    const sentSegmentIds = new Set(cards.filter((card) => card.sent).map((card) => card.summary.segmentId));
    setLastRideLines(newest === undefined || newest.segmentCount === 0 ? [] : loadRideSegmentLines(database, newest.rideId));
    setLastRideHighlights(newest === undefined ? [] : loadRideHighlights(database, newest.rideId, sentSegmentIds));
  }, [database]);

  useFocusEffect(refresh);

  function handleSetupAction(key: SetupStepKey) {
    if (key === "ftp") navigation.navigate("SegmentsTab", { screen: "ZonesSettings", initial: false });
    else if (key === "segment") navigation.navigate("SegmentsTab", { screen: "RegistryBrowse", initial: false });
    else if (key === "ride") navigation.navigate("RidesTab", { screen: "Import", initial: false });
    else navigation.navigate("SegmentsTab", { screen: "KarooSetup", initial: false });
  }

  function handleSaveGoal(segmentId: string, targetDurationMs: number) {
    setActiveGoal(database, { segmentId, targetDurationMs, nowMs: Date.now() });
    setEditingGoal(false);
    refresh();
  }

  if (shouldShowSetupChecklist(setup)) {
    return (
      <HomeFrame>
        <SetupChecklist steps={setupSteps(setup)} onAction={handleSetupAction} />
      </HomeFrame>
    );
  }

  if (goal === undefined || editingGoal) {
    return (
      <HomeFrame>
        <GoalSetupForm
          segments={segments}
          initialSegmentId={goal?.segmentId}
          initialTargetDurationMs={goal?.targetDurationMs}
          onSave={handleSaveGoal}
          onCancel={goal === undefined ? undefined : () => setEditingGoal(false)}
        />
      </HomeFrame>
    );
  }

  const goalSegment = segments.find((segment) => segment.segmentId === goal.segmentId);
  const validAttempts = attempts.filter(
    (attempt) => attempt.decision === "accept" || attempt.manuallyApproved,
  );
  const bestAttempt = validAttempts.reduce<AttemptSummary | undefined>((best, attempt) => {
    const duration = attempt.endTimestampMs - attempt.startTimestampMs;
    const bestDuration = best === undefined ? Infinity : best.endTimestampMs - best.startTimestampMs;
    return duration < bestDuration ? attempt : best;
  }, undefined);
  const secondBestAttempt = validAttempts
    .filter((attempt) => attempt.attemptId !== bestAttempt?.attemptId)
    .reduce<AttemptSummary | undefined>((best, attempt) => {
      const duration = attempt.endTimestampMs - attempt.startTimestampMs;
      const bestDuration = best === undefined ? Infinity : best.endTimestampMs - best.startTimestampMs;
      return duration < bestDuration ? attempt : best;
    }, undefined);

  function handleCompareCta() {
    if (bestAttempt === undefined) {
      navigation.navigate("SegmentsTab", { screen: "SegmentDetail", initial: false, params: { segmentId: goal!.segmentId } });
      return;
    }
    if (secondBestAttempt === undefined) {
      navigation.navigate("SegmentsTab", {
        screen: "AttemptReview",
        initial: false,
        params: { attemptId: bestAttempt.attemptId },
      });
      return;
    }
    navigation.navigate("SegmentsTab", {
      screen: "AttemptComparison",
      initial: false,
      params: { primaryAttemptId: bestAttempt.attemptId, comparisonAttemptId: secondBestAttempt.attemptId },
    });
  }

  const bestDurationMs = bestAttempt === undefined ? undefined : bestAttempt.endTimestampMs - bestAttempt.startTimestampMs;
  const gapMs = bestDurationMs === undefined ? undefined : bestDurationMs - goal.targetDurationMs;

  return (
    <HomeFrame>
      <ScreenScroll>
        {lastRide === undefined ? null : (
          <RideMapCard
            ride={lastRide}
            highlights={lastRideHighlights}
            segmentLines={lastRideLines}
            onPress={() => navigation.navigate("RidesTab", { screen: "RideDetail", initial: false, params: { rideId: lastRide.rideId } })}
          />
        )}
        {sentCards.length === 0 ? null : (
          <Section title="Sent from this phone" description="Segments you have sent to a Karoo. The check shows this phone has sent it.">
            {sentCards.map((card) => (
              <SegmentCard
                key={card.summary.segmentId}
                data={card}
                compact
                onPress={() => navigation.navigate("SegmentsTab", { screen: "SegmentPage", initial: false, params: { segmentId: card.summary.segmentId } })}
              />
            ))}
          </Section>
        )}
        <View style={styles.goalHeader}>
          <View style={styles.goalHeaderText}>
            <AppText variant="title2" accessibilityRole="header">
              {goalSegment?.name ?? "Goal"}
            </AppText>
            <AppText variant="subheadline" color="textSecondary">
              Target {formatDurationMinutesSeconds(goal.targetDurationMs)}
            </AppText>
          </View>
          <Button
            label="Change"
            variant="tertiary"
            fullWidth={false}
            accessibilityHint="Choose a different goal segment or time"
            onPress={() => setEditingGoal(true)}
          />
        </View>

        <Card>
          {bestDurationMs === undefined || gapMs === undefined ? (
            <AppText variant="subheadline" color="textSecondary" align="center">
              No confirmed efforts yet. Import rides that go over this segment to see how you are doing against your goal.
            </AppText>
          ) : (
            <View style={styles.status} accessible accessibilityLabel={`Best time ${formatDurationMinutesSeconds(bestDurationMs)}, ${gapMs <= 0 ? `${formatDurationMinutesSeconds(-gapMs)} under target` : `${formatDurationMinutesSeconds(gapMs)} over target`}`}>
              <AppText variant="largeTitle" align="center" importantForAccessibility="no">
                {formatDurationMinutesSeconds(bestDurationMs)}
              </AppText>
              <AppText variant="subheadline" color="textSecondary" align="center" importantForAccessibility="no">
                {gapMs <= 0
                  ? `${formatDurationMinutesSeconds(-gapMs)} under target`
                  : `${formatDurationMinutesSeconds(gapMs)} over target`}
              </AppText>
            </View>
          )}
          <Button
            label={
              secondBestAttempt !== undefined
                ? "Compare best attempts"
                : bestAttempt !== undefined
                  ? "Review best attempt"
                  : "View segment"
            }
            onPress={handleCompareCta}
          />
        </Card>
        {otherGoals.length === 0 ? null : (
          <Section title="Other goals" description="Segments where you have also set a goal. Your Karoo shows one goal at a time for now. Tap one to open it.">
            {otherGoals.map((other) => (
              <ListRow
                key={other.segmentId}
                icon="flag"
                title={segments.find((segment) => segment.segmentId === other.segmentId)?.name ?? "Segment"}
                subtitle={`Target ${formatDurationMinutesSeconds(other.targetDurationMs)}`}
                onPress={() => navigation.navigate("SegmentsTab", { screen: "SegmentPage", initial: false, params: { segmentId: other.segmentId } })}
                accessibilityHint="Opens this segment"
              />
            ))}
          </Section>
        )}
      </ScreenScroll>
    </HomeFrame>
  );
}

/**
 * Home's header (title and icon bar) is drawn by the tab navigator and already clears the status bar
 * and Dynamic Island, so this frame adds no top inset of its own.
 */
function HomeFrame({ children }: { children: ReactNode }) {
  const palette = useColors();
  return (
    <SafeAreaView edges={[]} style={[styles.frame, { backgroundColor: palette.background }]}>
      {children}
    </SafeAreaView>
  );
}

function GoalSetupForm({
  segments,
  initialSegmentId,
  initialTargetDurationMs,
  onSave,
  onCancel,
}: {
  segments: SegmentSummary[];
  initialSegmentId: string | undefined;
  initialTargetDurationMs: number | undefined;
  onSave: (segmentId: string, targetDurationMs: number) => void;
  onCancel: (() => void) | undefined;
}) {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | undefined>(initialSegmentId);
  const initialMinutes = initialTargetDurationMs === undefined ? "" : String(Math.floor(initialTargetDurationMs / 60_000));
  const initialSeconds =
    initialTargetDurationMs === undefined ? "" : String(Math.round((initialTargetDurationMs % 60_000) / 1_000));
  const [minutesInput, setMinutesInput] = useState(initialMinutes);
  const [secondsInput, setSecondsInput] = useState(initialSeconds);
  const [error, setError] = useState<string | undefined>(undefined);

  function handleSave() {
    if (selectedSegmentId === undefined) {
      setError("Choose the segment you want to chase.");
      return;
    }
    const targetDurationMs = parseTargetDurationInput(minutesInput, secondsInput);
    if (targetDurationMs === undefined) {
      setError("Enter a target time, for example 40 minutes and 0 seconds.");
      return;
    }
    onSave(selectedSegmentId, targetDurationMs);
  }

  return (
    <ScreenScroll>
      <Section title="Choose your goal segment" description="This is the segment Home tracks for you.">
        <View>
          {segments.map((segment) => (
            <ListRow
              key={segment.segmentId}
              icon="flag"
              iconColor={selectedSegmentId === segment.segmentId ? "brand" : "textTertiary"}
              selected={selectedSegmentId === segment.segmentId}
              title={segment.name}
              showChevron={false}
              onPress={() => setSelectedSegmentId(segment.segmentId)}
            />
          ))}
        </View>
      </Section>

      <Section title="Target time">
        <View style={styles.targetTimeRow}>
          <View style={styles.targetTimeField}>
            <TextField label="Minutes" value={minutesInput} onChangeText={setMinutesInput} keyboardType="number-pad" placeholder="40" />
          </View>
          <View style={styles.targetTimeField}>
            <TextField label="Seconds" value={secondsInput} onChangeText={setSecondsInput} keyboardType="number-pad" placeholder="00" />
          </View>
        </View>
      </Section>

      {error === undefined ? null : <Notice tone="error" live>{error}</Notice>}
      <Button label="Save goal" onPress={handleSave} />
      {onCancel === undefined ? null : <Button label="Cancel" variant="tertiary" onPress={onCancel} />}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  goalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.space8 },
  goalHeaderText: { flex: 1, gap: spacing.space4 },
  status: { gap: spacing.space4 },
  targetTimeRow: { flexDirection: "row", gap: spacing.space12 },
  targetTimeField: { flex: 1 },
});
