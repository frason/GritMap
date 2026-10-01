import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useDatabase } from "../db/DatabaseProvider";
import { getActiveGoal, type ActiveGoal } from "../db/getActiveGoal";
import { setActiveGoal } from "../db/setActiveGoal";
import { listSegments, type SegmentSummary } from "../db/listSegments";
import { listAttemptsForSegment, type AttemptSummary } from "../db/listAttemptsForSegment";
import { listRides, type RideSummary } from "../db/listRides";
import type { RootTabParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { Icon } from "../theme/Icon";
import { radius, spacing } from "../theme/spacing";
import {
  formatDistanceMiles,
  formatDurationHoursMinutes,
  formatDurationMinutesSeconds,
  formatRideDate,
} from "./formatRideStats";
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
      <View style={styles.emptyState}>
        <Icon name="flag" color="textTertiary" size={40} />
        <Text style={styles.emptyTitle}>
          Import a ride and define your first segment to set a goal.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("RidesTab", { screen: "Import" })}
        >
          <Text style={styles.primaryButtonLabel}>Import a ride</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (goal === undefined || editingGoal) {
    return (
      <GoalSetupForm
        segments={segments}
        initialSegmentId={goal?.segmentId}
        initialTargetDurationMs={goal?.targetDurationMs}
        onSave={handleSaveGoal}
        onCancel={goal === undefined ? undefined : () => setEditingGoal(false)}
      />
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
      navigation.navigate("SegmentsTab", { screen: "SegmentDetail", params: { segmentId: goal!.segmentId } });
      return;
    }
    if (secondBestAttempt === undefined) {
      navigation.navigate("SegmentsTab", {
        screen: "AttemptReview",
        params: { attemptId: bestAttempt.attemptId },
      });
      return;
    }
    navigation.navigate("SegmentsTab", {
      screen: "AttemptComparison",
      params: { primaryAttemptId: bestAttempt.attemptId, comparisonAttemptId: secondBestAttempt.attemptId },
    });
  }

  const bestDurationMs = bestAttempt === undefined ? undefined : bestAttempt.endTimestampMs - bestAttempt.startTimestampMs;
  const gapMs = bestDurationMs === undefined ? undefined : bestDurationMs - goal.targetDurationMs;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.goalHeader}>
        <View style={styles.goalHeaderText}>
          <Text style={styles.goalTitle}>{goalSegment?.name ?? "Goal"}</Text>
          <Text style={styles.goalTarget}>Target {formatDurationMinutesSeconds(goal.targetDurationMs)}</Text>
        </View>
        <TouchableOpacity onPress={() => setEditingGoal(true)}>
          <Text style={styles.changeGoalLink}>Change</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusCard}>
        {bestDurationMs === undefined || gapMs === undefined ? (
          <Text style={styles.statusHint}>
            No confirmed attempts yet. Import more rides that traverse this segment to see your status.
          </Text>
        ) : (
          <>
            <Text style={styles.statusBest}>{formatDurationMinutesSeconds(bestDurationMs)}</Text>
            <Text style={styles.statusGap}>
              {gapMs <= 0
                ? `${formatDurationMinutesSeconds(-gapMs)} under target`
                : `${formatDurationMinutesSeconds(gapMs)} over target`}
            </Text>
          </>
        )}
        <TouchableOpacity style={styles.primaryButton} onPress={handleCompareCta}>
          <Text style={styles.primaryButtonLabel}>
            {secondBestAttempt !== undefined
              ? "Compare best attempts"
              : bestAttempt !== undefined
                ? "Review best attempt"
                : "View segment"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent rides</Text>
        {recentRides.length === 0 ? (
          <Text style={styles.statusHint}>No rides imported yet.</Text>
        ) : (
          recentRides.map((ride) => (
            <TouchableOpacity
              key={ride.rideId}
              style={styles.rideRow}
              onPress={() => navigation.navigate("RidesTab", { screen: "RideDetail", params: { rideId: ride.rideId } })}
            >
              <View style={styles.rideRowText}>
                <Text style={styles.rideRowTitle}>
                  {ride.startTimestampMs === undefined ? ride.originalFilename : formatRideDate(ride.startTimestampMs)}
                </Text>
                <Text style={styles.rideRowSubtitle}>
                  {formatDistanceMiles(ride.totalDistanceMeters)} · {formatDurationHoursMinutes(ride.durationMs)}
                </Text>
              </View>
              <Icon name="chevronRight" color="textSecondary" size={18} />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
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
      setError("Choose a segment");
      return;
    }
    const targetDurationMs = parseTargetDurationInput(minutesInput, secondsInput);
    if (targetDurationMs === undefined) {
      setError("Enter a valid target time");
      return;
    }
    onSave(selectedSegmentId, targetDurationMs);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Choose your goal segment</Text>
      {segments.map((segment) => (
        <TouchableOpacity
          key={segment.segmentId}
          style={[styles.segmentOption, selectedSegmentId === segment.segmentId && styles.segmentOptionSelected]}
          onPress={() => setSelectedSegmentId(segment.segmentId)}
        >
          <Icon
            name="flag"
            color={selectedSegmentId === segment.segmentId ? "brand" : "textTertiary"}
            size={20}
          />
          <Text style={styles.segmentOptionLabel}>{segment.name}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.label}>Target time</Text>
      <View style={styles.targetTimeRow}>
        <TextInput
          style={styles.targetTimeInput}
          placeholder="min"
          placeholderTextColor={colors.textTertiary}
          value={minutesInput}
          onChangeText={setMinutesInput}
          keyboardType="number-pad"
        />
        <Text style={styles.targetTimeSeparator}>:</Text>
        <TextInput
          style={styles.targetTimeInput}
          placeholder="sec"
          placeholderTextColor={colors.textTertiary}
          value={secondsInput}
          onChangeText={setSecondsInput}
          keyboardType="number-pad"
        />
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
        <Text style={styles.primaryButtonLabel}>Save goal</Text>
      </TouchableOpacity>
      {error !== undefined && <Text style={styles.errorText}>{error}</Text>}
      {onCancel !== undefined && (
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.changeGoalLink}>Cancel</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
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
    gap: spacing.space16,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.space16,
    paddingHorizontal: spacing.space24,
    backgroundColor: colors.background,
  },
  emptyTitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  goalHeaderText: {
    gap: spacing.space4,
  },
  goalTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  goalTarget: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  changeGoalLink: {
    fontSize: 13,
    color: colors.brand,
    fontWeight: "600",
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.space20,
    alignItems: "center",
    gap: spacing.space8,
  },
  statusBest: {
    fontSize: 36,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statusGap: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusHint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    paddingHorizontal: spacing.space24,
    alignItems: "center",
    marginTop: spacing.space8,
  },
  primaryButtonLabel: {
    color: colors.textOnBrand,
    fontSize: 15,
    fontWeight: "600",
  },
  section: {
    gap: spacing.space8 + 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  rideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    paddingHorizontal: spacing.space16,
  },
  rideRowText: {
    flex: 1,
    gap: spacing.space4 - 2,
  },
  rideRowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  rideRowSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  segmentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.space16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentOptionSelected: {
    borderColor: colors.brand,
  },
  segmentOptionLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  targetTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space8,
  },
  targetTimeInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.space16,
    paddingVertical: spacing.space12,
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: "center",
  },
  targetTimeSeparator: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 13,
    color: colors.statusDanger,
    textAlign: "center",
  },
});
