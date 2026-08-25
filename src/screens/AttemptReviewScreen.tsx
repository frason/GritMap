import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/DatabaseProvider";
import { getAttemptDetail, type AttemptDetail } from "../db/getAttemptDetail";
import { getRideTrack, type RideTrackPoint } from "../db/getRideTrack";
import { confirmAttempt, rejectAttempt } from "../db/reviewAttempt";
import type { SegmentsStackParamList } from "../navigation/types";
import { colors, type ColorToken } from "../theme/colors";
import { Icon } from "../theme/Icon";
import { radius, spacing } from "../theme/spacing";
import { formatDurationHoursMinutes } from "./formatRideStats";
import { RouteMapView } from "./RouteMapView";

type AttemptReviewRoute = RouteProp<SegmentsStackParamList, "AttemptReview">;
type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

export function AttemptReviewScreen() {
  const database = useDatabase();
  const route = useRoute<AttemptReviewRoute>();
  const navigation = useNavigation<Navigation>();
  const [attempt, setAttempt] = useState<AttemptDetail | undefined>(undefined);
  const [track, setTrack] = useState<RideTrackPoint[]>([]);

  useFocusEffect(
    useCallback(() => {
      const detail = getAttemptDetail(database, route.params.attemptId);
      setAttempt(detail);
      setTrack(detail === undefined ? [] : getRideTrack(database, detail.rideId));
    }, [database, route.params.attemptId]),
  );

  if (attempt === undefined) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>
          This attempt is no longer available — it may have already been reviewed.
        </Text>
      </View>
    );
  }

  function handleConfirm() {
    confirmAttempt(database, attempt!.attemptId);
    navigation.goBack();
  }

  function handleReject() {
    Alert.alert("Reject attempt?", "This removes it from the segment's attempts.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () => {
          rejectAttempt(database, attempt!.attemptId);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{attempt.rideOriginalFilename}</Text>
      <DecisionBadge decision={attempt.decision} manuallyApproved={attempt.manuallyApproved} />

      <View style={styles.mapContainer}>
        <RouteMapView
          points={track}
          highlightRange={{
            startPointIndex: attempt.startPointIndex,
            endPointIndex: attempt.endPointIndex,
          }}
        />
      </View>

      <View style={styles.diagnostics}>
        <DiagnosticRow label="Confidence" value={formatPct(attempt.confidenceScore)} />
        <DiagnosticRow label="Coverage" value={formatPct(attempt.coveragePct)} />
        <DiagnosticRow label="Duration" value={formatDurationHoursMinutes(attempt.endTimestampMs - attempt.startTimestampMs)} />
        <DiagnosticRow label="Max deviation" value={formatMeters(attempt.maxDeviationMeters)} />
        <DiagnosticRow
          label="Median deviation"
          value={attempt.medianDeviationMeters === undefined ? "—" : formatMeters(attempt.medianDeviationMeters)}
        />
        <DiagnosticRow label="Backward movement" value={formatMeters(attempt.maxBackwardMeters)} />
        <DiagnosticRow label="GPS gaps" value={String(attempt.gpsGapCount)} />
        <DiagnosticRow label="Longest gap" value={formatDurationHoursMinutes(attempt.maxGapMs)} />
        <DiagnosticRow label="Matcher version" value={`v${attempt.matcherVersion}`} />
      </View>

      {attempt.reasons.length > 0 && (
        <View style={styles.reasons}>
          <Text style={styles.reasonsTitle}>Reasons for uncertainty</Text>
          {attempt.reasons.map((reason) => (
            <Text key={reason} style={styles.reasonText}>
              • {humanizeReason(reason)}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
          <Icon name="xCircle" color="statusDanger" size={18} />
          <Text style={styles.rejectLabel}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Icon name="checkCircle" color="textOnBrand" size={18} />
          <Text style={styles.confirmLabel}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function DecisionBadge({
  decision,
  manuallyApproved,
}: {
  decision: "accept" | "borderline";
  manuallyApproved: boolean;
}) {
  const label = manuallyApproved ? "Manually approved" : decision === "accept" ? "Accepted" : "Borderline";
  const isPositive = manuallyApproved || decision === "accept";
  const tone: ColorToken = isPositive ? "statusSuccess" : "statusWarning";
  const subtleTone: ColorToken = isPositive ? "statusSuccessSubtle" : "statusWarningSubtle";
  return (
    <View style={[styles.badge, { backgroundColor: colors[subtleTone] }]}>
      <Text style={[styles.badgeText, { color: colors[tone] }]}>{label}</Text>
    </View>
  );
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.diagnosticRow}>
      <Text style={styles.diagnosticLabel}>{label}</Text>
      <Text style={styles.diagnosticValue}>{value}</Text>
    </View>
  );
}

function formatPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function formatMeters(meters: number): string {
  return `${Math.round(meters)}m`;
}

function humanizeReason(reason: string): string {
  return reason.charAt(0).toUpperCase() + reason.slice(1).replace(/-/g, " ");
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
    padding: spacing.space24,
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.md,
    paddingVertical: spacing.space4,
    paddingHorizontal: spacing.space12,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  mapContainer: {
    height: 220,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  diagnostics: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.space16,
  },
  diagnosticRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.space12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  diagnosticLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  diagnosticValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  reasons: {
    backgroundColor: colors.statusWarningSubtle,
    borderRadius: radius.md,
    padding: spacing.space16,
    gap: spacing.space4,
  },
  reasonsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.statusWarning,
    marginBottom: spacing.space4,
  },
  reasonText: {
    fontSize: 13,
    color: colors.statusWarning,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.space12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.space8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.statusDanger,
    paddingVertical: spacing.space12,
  },
  rejectLabel: {
    color: colors.statusDanger,
    fontSize: 15,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.space8,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
  },
  confirmLabel: {
    color: colors.textOnBrand,
    fontSize: 15,
    fontWeight: "600",
  },
});
