import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
import type { RideTrackPoint } from "../db/getRideTrack";
import { runMatcherForSegment, type MatchRunSummary } from "../matcher/runMatcher";
import { computeSegmentElevationStats } from "../segments/computeSegmentElevationStats";
import { computeAnchorPowerWatts } from "../pacing/powerDurationAnchor";
import { computeAdaptiveZoneGrades } from "../pacing/computeZoneGrades";
import { buildTargetPowerZones, type PacingZone } from "../pacing/buildTargetPowerZones";
import { parseTargetDurationInput } from "./parseTargetDuration";
import type { SegmentsStackParamList } from "../navigation/types";
import { sendGuidancePackageToKaroo } from "../karoo/sendGuidancePackageToKaroo";
import { colors } from "../theme/colors";
import { Icon } from "../theme/Icon";
import type { IconName } from "../theme/icons";
import { radius, spacing } from "../theme/spacing";
import { RouteMapView } from "./RouteMapView";
import { ElevationSparkline } from "./ElevationSparkline";
import { ElevationProfileChart } from "./ElevationProfileChart";
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

export function SegmentDetailScreen() {
  const database = useDatabase();
  const route = useRoute<SegmentDetailRoute>();
  const navigation = useNavigation<Navigation>();
  const scrollViewRef = useRef<ScrollView>(null);
  const [attemptsSectionY, setAttemptsSectionY] = useState(0);
  const [segment, setSegment] = useState<SegmentDetail | undefined>(undefined);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [athleteProfile, setAthleteProfile] = useState<AthleteProfile>({});
  const [activeGoal, setActiveGoal] = useState<ActiveGoal | undefined>(undefined);
  const [otherGoalSegmentName, setOtherGoalSegmentName] = useState<string | undefined>(undefined);
  const [analyzeEffortSummary, setAnalyzeEffortSummary] = useState<AnalyzeEffortSummary | undefined>(undefined);
  const [goalMinutesInput, setGoalMinutesInput] = useState("");
  const [goalSecondsInput, setGoalSecondsInput] = useState("");
  const [goalSaveStatus, setGoalSaveStatus] = useState<string | undefined>(undefined);
  const [editingGoal, setEditingGoal] = useState(false);
  const [karooAddress, setKarooAddress] = useState("");
  const [pacingSending, setPacingSending] = useState(false);
  const [pacingSendStatus, setPacingSendStatus] = useState<string | undefined>(undefined);
  const [rerunning, setRerunning] = useState(false);
  const [rerunSummary, setRerunSummary] = useState<MatchRunSummary | undefined>(undefined);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedAttemptIds, setSelectedAttemptIds] = useState<string[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={8}>
          <Icon name="more" color="textPrimary" size={22} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const currentAttempts = listAttemptsForSegment(database, route.params.segmentId);
      const currentGoal = getActiveGoal(database);

      setSegment(getSegmentDetail(database, route.params.segmentId));
      setAttempts(currentAttempts);
      setAthleteProfile(getAthleteProfile(database));
      setActiveGoal(currentGoal);
      setGoalMinutesInput("");
      setGoalSecondsInput("");
      setGoalSaveStatus(undefined);
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
    }, [database, route.params.segmentId]),
  );

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
      setGoalSaveStatus("Enter a valid target time");
      return;
    }
    saveActiveGoal(database, { segmentId: segment.segmentId, targetDurationMs, nowMs: Date.now() });
    setActiveGoal({ segmentId: segment.segmentId, targetDurationMs });
    setOtherGoalSegmentName(undefined);
    setGoalMinutesInput("");
    setGoalSecondsInput("");
    setGoalSaveStatus(undefined);
    setEditingGoal(false);
  }

  function handleStartEditingGoal() {
    if (activeGoal !== undefined && segment !== undefined && activeGoal.segmentId === segment.segmentId) {
      setGoalMinutesInput(String(Math.floor(activeGoal.targetDurationMs / 60_000)));
      setGoalSecondsInput(String(Math.round((activeGoal.targetDurationMs % 60_000) / 1_000)));
    }
    setGoalSaveStatus(undefined);
    setEditingGoal(true);
  }

  if (!segment) {
    return <View style={styles.container} />;
  }

  const totalDistanceMeters = segment.referencePolyline.at(-1)?.distanceMeters ?? 0;
  const elevationStats = computeSegmentElevationStats(segment.referencePolyline);
  const validAttempts = attempts.filter((attempt) => attempt.decision === "accept" || attempt.manuallyApproved);
  const mostRecentAttempt = [...attempts].sort((a, b) => b.startTimestampMs - a.startTimestampMs)[0];
  const bestAttempt = bestByDuration(validAttempts);

  async function handleSendPacingPlan() {
    const { ftpWatts, weightKg, maxHeartRateBpm } = athleteProfile;
    if (!segment || ftpWatts === undefined || weightKg === undefined || activeGoal === undefined) return;
    const trimmed = karooAddress.trim();
    if (trimmed.length === 0) {
      setPacingSendStatus("Enter the Karoo's address (shown on its \"Receive from Phone\" screen)");
      return;
    }
    setPacingSending(true);
    setPacingSendStatus("Sending…");
    const result = await sendGuidancePackageToKaroo(
      segment,
      { ftpWatts, weightKg, ...(maxHeartRateBpm === undefined ? {} : { maxHeartRateBpm }) },
      activeGoal.targetDurationMs,
      trimmed,
      generateId(),
      Date.now(),
    );
    setPacingSending(false);
    setPacingSendStatus(
      result.ok
        ? "Sent — check the Karoo screen to confirm it imported"
        : `Send failed${result.statusCode ? ` (HTTP ${result.statusCode})` : ""}${
            result.message ? `: ${result.message}` : ""
          }`,
    );
  }

  // Goal & Pacing Plan: computed here (not deep in JSX) so the resulting zones can also
  // feed the Elevation Profile chart below without computing them twice.
  let pacingPlanBody: ReactNode;
  let pacingZones: PacingZone[] | undefined;
  const goalIsForThisSegment = activeGoal !== undefined && activeGoal.segmentId === segment.segmentId;

  if (athleteProfile.ftpWatts === undefined) {
    pacingPlanBody = (
      <TouchableOpacity onPress={() => navigation.navigate("ZonesSettings")}>
        <Text style={styles.missingLink}>Set your FTP to generate a pacing plan</Text>
      </TouchableOpacity>
    );
  } else if (editingGoal || !goalIsForThisSegment) {
    pacingPlanBody = (
      <>
        {activeGoal !== undefined && !goalIsForThisSegment && (
          <Text style={styles.sendHint}>
            Active goal: {otherGoalSegmentName ?? "another segment"},{" "}
            {formatDurationMinutesSeconds(activeGoal.targetDurationMs)} — save a goal below to switch it to this
            segment.
          </Text>
        )}
        <View style={styles.goalInputRow}>
          <TextInput
            style={styles.goalTimeInput}
            placeholder="min"
            placeholderTextColor={colors.textTertiary}
            value={goalMinutesInput}
            onChangeText={setGoalMinutesInput}
            keyboardType="number-pad"
          />
          <Text style={styles.goalTimeSeparator}>:</Text>
          <TextInput
            style={styles.goalTimeInput}
            placeholder="sec"
            placeholderTextColor={colors.textTertiary}
            value={goalSecondsInput}
            onChangeText={setGoalSecondsInput}
            keyboardType="number-pad"
          />
        </View>
        <TouchableOpacity style={styles.sendButton} onPress={handleSaveGoal}>
          <Text style={styles.sendButtonLabel}>Save goal</Text>
        </TouchableOpacity>
        {goalSaveStatus !== undefined && <Text style={styles.sendStatusText}>{goalSaveStatus}</Text>}
        {goalIsForThisSegment && (
          <TouchableOpacity onPress={() => setEditingGoal(false)}>
            <Text style={styles.missingLink}>Cancel</Text>
          </TouchableOpacity>
        )}
      </>
    );
  } else {
    const ftpWatts = athleteProfile.ftpWatts;
    const anchorPowerWatts = computeAnchorPowerWatts(ftpWatts, activeGoal.targetDurationMs);
    const zoneWindows = computeAdaptiveZoneGrades(segment.referencePolyline);
    pacingZones = buildTargetPowerZones(zoneWindows, anchorPowerWatts, ftpWatts);
    const pctFtp = Math.round((anchorPowerWatts / ftpWatts) * 100);

    pacingPlanBody = (
      <>
        <View style={styles.goalSummaryRow}>
          <Text style={styles.goalSummaryText}>Goal {formatDurationMinutesSeconds(activeGoal.targetDurationMs)}</Text>
          <TouchableOpacity onPress={handleStartEditingGoal}>
            <Text style={styles.missingLink}>Change</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sendHint}>
          ~{Math.round(anchorPowerWatts)}W avg ({pctFtp}% FTP)
        </Text>
        {athleteProfile.weightKg === undefined ? (
          <TouchableOpacity onPress={() => navigation.navigate("ZonesSettings")}>
            <Text style={styles.missingLink}>Set your weight to send this plan to the Karoo</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput
              style={styles.addressInput}
              placeholder="IP or full Karoo URL"
              placeholderTextColor={colors.textTertiary}
              value={karooAddress}
              onChangeText={setKarooAddress}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={[styles.sendButton, pacingSending && styles.sendButtonDisabled]}
              onPress={handleSendPacingPlan}
              disabled={pacingSending}
            >
              <Text style={styles.sendButtonLabel}>{pacingSending ? "Sending…" : "Send pacing plan to Karoo"}</Text>
            </TouchableOpacity>
            {pacingSendStatus !== undefined && <Text style={styles.sendStatusText}>{pacingSendStatus}</Text>}
          </>
        )}
      </>
    );
  }

  return (
    <>
      <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroMap}>
        <RouteMapView points={toRouteMapPoints(segment)} />
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>{segment.name}</Text>
        <ElevationSparkline referencePolyline={segment.referencePolyline} />
      </View>

      <View style={styles.statsRow}>
        <StatTile value={formatDistanceMiles(totalDistanceMeters)} label="Distance" />
        <StatTile value={formatElevationFeet(elevationStats?.elevationGainMeters)} label="Elevation gain" />
        <StatTile value={formatGradePercent(elevationStats?.averageGradePercent)} label="Grade" />
      </View>

      {attempts.length > 0 && (
        <Section title="Your Efforts">
          {mostRecentAttempt !== undefined && (
            <EffortRow
              icon="clock"
              title={formatDurationMinutesSeconds(
                mostRecentAttempt.endTimestampMs - mostRecentAttempt.startTimestampMs,
              )}
              subtitle={`Most recent — ${formatRideDate(mostRecentAttempt.startTimestampMs)}`}
              onPress={() => navigation.navigate("AttemptReview", { attemptId: mostRecentAttempt.attemptId })}
            />
          )}
          {bestAttempt !== undefined && (
            <EffortRow
              icon="medal"
              title={`Personal record — ${formatDurationMinutesSeconds(
                bestAttempt.endTimestampMs - bestAttempt.startTimestampMs,
              )}`}
              subtitle={formatRideDate(bestAttempt.startTimestampMs)}
              onPress={() => navigation.navigate("AttemptReview", { attemptId: bestAttempt.attemptId })}
            />
          )}
          <EffortRow
            icon="list"
            title="Your results"
            subtitle={`${attempts.length} effort${attempts.length === 1 ? "" : "s"}`}
            onPress={() => scrollViewRef.current?.scrollTo({ y: attemptsSectionY, animated: true })}
          />
          {bestAttempt !== undefined && analyzeEffortSummary !== undefined && (
            <EffortRow
              icon="pulse"
              title="Analyze effort"
              subtitle={[
                analyzeEffortSummary.avgSpeedMetersPerSecond !== undefined
                  ? formatSpeedMph(analyzeEffortSummary.avgSpeedMetersPerSecond)
                  : undefined,
                analyzeEffortSummary.avgPowerWatts !== undefined
                  ? `${Math.round(analyzeEffortSummary.avgPowerWatts)} W`
                  : undefined,
                analyzeEffortSummary.avgHeartRateBpm !== undefined
                  ? `${Math.round(analyzeEffortSummary.avgHeartRateBpm)} bpm`
                  : undefined,
              ]
                .filter((part): part is string => part !== undefined)
                .join(" · ")}
              onPress={() => navigation.navigate("AttemptReview", { attemptId: bestAttempt.attemptId })}
            />
          )}
        </Section>
      )}

      <Section title="Goal & Pacing Plan">{pacingPlanBody}</Section>

      {elevationStats !== undefined && (
        <Section title="Elevation profile">
          <ElevationProfileChart referencePolyline={segment.referencePolyline} zones={pacingZones} />
        </Section>
      )}

      <View onLayout={(event) => setAttemptsSectionY(event.nativeEvent.layout.y)}>
        <Section title="Attempts">
          {attempts.length === 0 ? (
            <Text style={styles.attemptsEmptyText}>
              No attempts detected yet. Import more rides that traverse this segment to see them
              here.
            </Text>
          ) : (
            <>
              {attempts.length >= 2 && (
                <TouchableOpacity style={styles.compareToggle} onPress={toggleCompareMode}>
                  <Text style={styles.compareToggleLabel}>
                    {compareMode ? "Cancel" : "Compare two attempts"}
                  </Text>
                </TouchableOpacity>
              )}
              {validAttempts.length >= 3 && (
                <TouchableOpacity
                  style={styles.compareToggle}
                  onPress={() =>
                    navigation.navigate("HistoricalBand", {
                      segmentId: route.params.segmentId,
                      currentAttemptId: validAttempts[0]!.attemptId,
                    })
                  }
                >
                  <Text style={styles.compareToggleLabel}>Compare to history</Text>
                </TouchableOpacity>
              )}
              {compareMode && (
                <Text style={styles.compareHint}>
                  Select two attempts ({selectedAttemptIds.length}/2)
                </Text>
              )}
              {attempts.map((attempt) => (
                <AttemptRow
                  key={attempt.attemptId}
                  attempt={attempt}
                  compareMode={compareMode}
                  selected={selectedAttemptIds.includes(attempt.attemptId)}
                  onPress={() =>
                    compareMode
                      ? toggleAttemptSelected(attempt.attemptId)
                      : navigation.navigate("AttemptReview", { attemptId: attempt.attemptId })
                  }
                />
              ))}
              {compareMode && selectedAttemptIds.length === 2 && (
                <TouchableOpacity style={styles.sendButton} onPress={handleCompareSelected}>
                  <Text style={styles.sendButtonLabel}>Compare Selected</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          <TouchableOpacity
            style={[styles.rerunButton, rerunning && styles.sendButtonDisabled]}
            onPress={handleRerunMatcher}
            disabled={rerunning}
          >
            <Text style={styles.rerunButtonLabel}>{rerunning ? "Rerunning…" : "Rerun matcher"}</Text>
          </TouchableOpacity>
          {rerunSummary !== undefined && (
            <Text style={styles.rerunSummaryText}>
              {rerunSummary.inserted} new · {rerunSummary.updated} updated ·{" "}
              {rerunSummary.duplicate} unchanged · {rerunSummary.removed} removed
            </Text>
          )}
        </Section>
      </View>
      </ScrollView>
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate("SendToKaroo", { segmentId: route.params.segmentId });
              }}
            >
              <Text style={styles.menuItemLabel}>Send to Karoo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate("PublishToRegistry", { segmentId: route.params.segmentId });
              }}
            >
              <Text style={styles.menuItemLabel}>Publish to Registry</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function EffortRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.effortRow} onPress={onPress}>
      <View style={styles.effortRowIcon}>
        <Icon name={icon} color="brand" size={17} />
      </View>
      <View style={styles.attemptRowText}>
        <Text style={styles.attemptRowTitle}>{title}</Text>
        <Text style={styles.attemptRowSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Icon name="chevronRight" color="textSecondary" size={18} />
    </TouchableOpacity>
  );
}

function AttemptRow({
  attempt,
  onPress,
  compareMode,
  selected,
}: {
  attempt: AttemptSummary;
  onPress: () => void;
  compareMode: boolean;
  selected: boolean;
}) {
  const isPositive = attempt.manuallyApproved || attempt.decision === "accept";
  return (
    <TouchableOpacity
      style={[styles.attemptRow, compareMode && selected && styles.attemptRowSelected]}
      onPress={onPress}
    >
      <Icon
        name={compareMode || isPositive ? "checkCircle" : "alertTriangle"}
        color={compareMode ? (selected ? "brand" : "textTertiary") : isPositive ? "statusSuccess" : "statusWarning"}
        size={20}
      />
      <View style={styles.attemptRowText}>
        <Text style={styles.attemptRowTitle}>{formatRideDate(attempt.startTimestampMs)}</Text>
        <Text style={styles.attemptRowSubtitle} numberOfLines={1}>
          {formatDurationHoursMinutes(attempt.endTimestampMs - attempt.startTimestampMs)} ·{" "}
          {Math.round(attempt.confidenceScore * 100)}% confidence
          {attempt.manuallyApproved ? " · Approved" : ""}
        </Text>
      </View>
      <Icon name="chevronRight" color="textSecondary" size={18} />
    </TouchableOpacity>
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

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.space32,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    alignItems: "flex-end",
    paddingTop: 50,
    paddingRight: spacing.space16,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.space8,
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: {
    paddingVertical: spacing.space12,
    paddingHorizontal: spacing.space16,
  },
  menuItemLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  heroMap: {
    height: 260,
    backgroundColor: colors.surface,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.space12,
    paddingHorizontal: spacing.space20,
    paddingTop: spacing.space16,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.space8 + 2,
    marginTop: spacing.space16,
    paddingHorizontal: spacing.space20,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.space16 - 2,
    alignItems: "center",
    gap: spacing.space4 - 2,
  },
  statValue: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  section: {
    marginTop: spacing.space24,
    paddingHorizontal: spacing.space20,
    gap: spacing.space8 + 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  sendHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  addressInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.space16,
    paddingVertical: spacing.space12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  goalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space8,
  },
  goalTimeInput: {
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
  goalTimeSeparator: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  goalSummaryRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  goalSummaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  sendButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonLabel: {
    color: colors.textOnBrand,
    fontSize: 15,
    fontWeight: "600",
  },
  sendStatusText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  missingLink: {
    fontSize: 13,
    color: colors.brand,
  },
  attemptsEmptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  effortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    paddingHorizontal: spacing.space16,
  },
  effortRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  attemptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    paddingHorizontal: spacing.space16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  attemptRowSelected: {
    borderColor: colors.brand,
  },
  compareToggle: {
    alignSelf: "flex-end",
  },
  compareToggleLabel: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "600",
  },
  compareHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  attemptRowText: {
    flex: 1,
    gap: spacing.space4 - 2,
  },
  attemptRowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  attemptRowSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  rerunButton: {
    backgroundColor: colors.brandSubtle,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    alignItems: "center",
  },
  rerunButtonLabel: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: "600",
  },
  rerunSummaryText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
