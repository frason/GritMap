import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useDatabase } from "../db/DatabaseProvider";
import { getActiveGoal, type ActiveGoal } from "../db/getActiveGoal";
import { setActiveGoal } from "../db/setActiveGoal";
import { listSegments, type SegmentSummary } from "../db/listSegments";
import { listAttemptsForSegment, type AttemptSummary } from "../db/listAttemptsForSegment";
import { listRides, type RideSummary } from "../db/listRides";
import type { RootTabParamList } from "../navigation/types";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import {
  formatDistanceMiles,
  formatDurationHoursMinutes,
  formatDurationMinutesSeconds,
  formatRideDate,
} from "./formatRideStats";
import { AppText, Button, Card, EmptyState, ListRow, Notice, ScreenScroll, Section, TextField } from "../theme/components";
import { parseTargetDurationInput } from "./parseTargetDuration";

type Navigation = BottomTabNavigationProp<RootTabParamList>;

export function HomeScreen() {
  const database = useDatabase();
  const navigation = useNavigation<Navigation>();
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [goal, setGoal] = useState<ActiveGoal | undefined>(undefined);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [recentRides, setRecentRides] = useState<RideSummary[]>([]);
  const [editingGoal, setEditingGoal] = useState(false);

  const refresh = useCallback(() => {
    const currentSegments = listSegments(database);
    const currentGoal = getActiveGoal(database);
    setSegments(currentSegments);
    setGoal(currentGoal);
    setAttempts(currentGoal === undefined ? [] : listAttemptsForSegment(database, currentGoal.segmentId));
    setRecentRides(listRides(database).slice(0, 5));
  }, [database]);

  useFocusEffect(refresh);

  function handleSaveGoal(segmentId: string, targetDurationMs: number) {
    setActiveGoal(database, { segmentId, targetDurationMs, nowMs: Date.now() });
    setEditingGoal(false);
    refresh();
  }

  if (segments.length === 0) {
    return (
      <HomeFrame>
        <EmptyState
          icon="flag"
          title="Pick a segment to chase"
          body="Add a segment, set a goal time, and GritMap builds you a pacing plan. Your progress toward the goal shows up here."
          actions={[
            {
              label: "Browse Open Segments",
              onPress: () => navigation.navigate("SegmentsTab", { screen: "RegistryBrowse", initial: false }),
              icon: "search",
            },
            {
              label: "Import a ride",
              onPress: () => navigation.navigate("RidesTab", { screen: "Import", initial: false }),
              variant: "secondary",
              icon: "download",
            },
          ]}
        />
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

        <Section title="Recent rides">
          {recentRides.length === 0 ? (
            <AppText variant="subheadline" color="textSecondary">
              No rides imported yet.
            </AppText>
          ) : (
            <View>
              {recentRides.map((ride) => (
                <ListRow
                  key={ride.rideId}
                  title={ride.startTimestampMs === undefined ? ride.originalFilename : formatRideDate(ride.startTimestampMs)}
                  subtitle={`${formatDistanceMiles(ride.totalDistanceMeters)} · ${formatDurationHoursMinutes(ride.durationMs)}`}
                  onPress={() => navigation.navigate("RidesTab", { screen: "RideDetail", initial: false, params: { rideId: ride.rideId } })}
                />
              ))}
            </View>
          )}
        </Section>
      </ScreenScroll>
    </HomeFrame>
  );
}

/**
 * Home has no navigation bar (the tab navigator hides it), so nothing else keeps its content out
 * from under the status bar and Dynamic Island: this frame applies the top safe-area inset.
 */
function HomeFrame({ children }: { children: ReactNode }) {
  const palette = useColors();
  return (
    <SafeAreaView edges={["top"]} style={[styles.frame, { backgroundColor: palette.background }]}>
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
