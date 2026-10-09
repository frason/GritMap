import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/DatabaseProvider";
import { getAttemptDetail, type AttemptDetail } from "../db/getAttemptDetail";
import { getRideTrack, type RideTrackPoint } from "../db/getRideTrack";
import { getSegmentDetail } from "../db/getSegmentDetail";
import { confirmAttempt, rejectAttempt } from "../db/reviewAttempt";
import type { SegmentsStackParamList } from "../navigation/types";
import { AppText, Button, Card, ErrorState, ListRow, LoadingState, Notice, ScreenScroll, Section } from "../theme/components";
import { radius, spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { describeAttemptStatus, describeMatchDetails, describeMatchReason } from "./describeAttemptMatch";
import { formatDurationMinutesSeconds, formatRideDate } from "./formatRideStats";
import { RouteMapView } from "./RouteMapView";

type AttemptReviewRoute = RouteProp<SegmentsStackParamList, "AttemptReview">;
type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

/**
 * One effort on a segment: when it happened, how GritMap matched the ride to the segment (in plain
 * words), and, for an effort GritMap isn't sure about, the decision to count it or remove it.
 */
export function AttemptReviewScreen() {
  const database = useDatabase();
  const route = useRoute<AttemptReviewRoute>();
  const navigation = useNavigation<Navigation>();
  const palette = useColors();
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [attempt, setAttempt] = useState<AttemptDetail | undefined>(undefined);
  const [segmentName, setSegmentName] = useState<string | undefined>(undefined);
  const [track, setTrack] = useState<RideTrackPoint[]>([]);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const load = useCallback(() => {
    try {
      const detail = getAttemptDetail(database, route.params.attemptId);
      setAttempt(detail);
      if (detail === undefined) {
        setState("missing");
        return;
      }
      setSegmentName(getSegmentDetail(database, detail.segmentId)?.name);
      setTrack(getRideTrack(database, detail.rideId));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [database, route.params.attemptId]);

  useFocusEffect(load);

  if (state === "loading") {
    return (
      <ScreenScroll>
        <LoadingState label="Loading effort…" />
      </ScreenScroll>
    );
  }
  if (state === "error") {
    return <ErrorState message="GritMap couldn't open this effort. Go back and try again." onRetry={load} />;
  }
  if (state === "missing" || attempt === undefined) {
    return (
      <ErrorState
        title="This effort is no longer available"
        message="It may already have been reviewed or removed. Go back to the segment to see your efforts."
      />
    );
  }

  const current = attempt;

  function handleConfirm() {
    confirmAttempt(database, current.attemptId);
    navigation.goBack();
  }

  function handleRemove() {
    rejectAttempt(database, current.attemptId);
    navigation.goBack();
  }

  const status = describeAttemptStatus(current.decision, current.manuallyApproved);
  const durationMs = current.endTimestampMs - current.startTimestampMs;
  const details = describeMatchDetails({
    confidenceScore: current.confidenceScore,
    coveragePct: current.coveragePct,
    maxDeviationMeters: current.maxDeviationMeters,
    ...(current.medianDeviationMeters === undefined ? {} : { medianDeviationMeters: current.medianDeviationMeters }),
    maxBackwardMeters: current.maxBackwardMeters,
    gpsGapCount: current.gpsGapCount,
    maxGapMs: current.maxGapMs,
  });

  return (
    <ScreenScroll>
      <View style={styles.heading}>
        <AppText variant="title2" accessibilityRole="header">
          {segmentName ?? "Segment effort"}
        </AppText>
        <AppText variant="subheadline" color="textSecondary">
          {formatRideDate(current.startTimestampMs)} · {formatDurationMinutesSeconds(durationMs)}
        </AppText>
        <AppText variant="footnote" color="textSecondary">
          From {current.rideOriginalFilename}
        </AppText>
      </View>

      <Notice tone={status.tone}>{`${status.label}. ${status.explanation}`}</Notice>

      <View
        style={[styles.map, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        <RouteMapView points={track} highlightRange={{ startPointIndex: current.startPointIndex, endPointIndex: current.endPointIndex }} />
      </View>
      <AppText variant="footnote" color="textSecondary">
        The thick line on the map is this effort.
      </AppText>

      {current.reasons.length > 0 ? (
        <Section title="Why GritMap isn't sure">
          <Card>
            {current.reasons.map((reason) => (
              <AppText key={reason} variant="subheadline">
                • {describeMatchReason(reason)}
              </AppText>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title="How well it matched" description="The numbers GritMap used to decide this ride covered the segment.">
        <View>
          {details.map((detail) => (
            <ListRow key={detail.label} title={detail.label} subtitle={detail.meaning} value={detail.value} />
          ))}
        </View>
        <AppText variant="caption1" color="textSecondary">
          Checked by match analysis version {current.matcherVersion}.
        </AppText>
      </Section>

      <Button
        label="Compare with your pacing plan"
        variant="secondary"
        icon="flag"
        onPress={() => navigation.navigate("PlanVsActual", { attemptId: current.attemptId })}
      />

      <Section title="Count this effort?">
        {confirmingRemove ? (
          <Card>
            <AppText variant="headline">Remove this effort?</AppText>
            <AppText variant="subheadline" color="textSecondary">
              It will no longer count toward your times or charts. If you later check your rides again, GritMap may find it again.
            </AppText>
            <Button label="Yes, remove it" variant="destructive" icon="trash" onPress={handleRemove} />
            <Button label="Keep it for now" variant="secondary" onPress={() => setConfirmingRemove(false)} />
          </Card>
        ) : (
          <>
            {current.manuallyApproved ? null : (
              <Card>
                <AppText variant="subheadline" color="textSecondary">
                  {current.decision === "borderline"
                    ? "Confirm if this ride really did the whole segment. It will count toward your times and charts, and GritMap will keep it even when it checks your rides again."
                    : "GritMap already counts this effort. Confirming it locks it in, so checking your rides again never changes it."}
                </AppText>
                <Button label="Confirm this effort" icon="checkCircle" onPress={handleConfirm} />
              </Card>
            )}
            <Card>
              <AppText variant="subheadline" color="textSecondary">
                Remove it if this ride didn't really do the segment. It stops counting toward your times.
              </AppText>
              <Button label="Remove this effort" variant="destructive" icon="trash" onPress={() => setConfirmingRemove(true)} />
            </Card>
          </>
        )}
      </Section>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.space4 },
  map: { height: 220, borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
});
