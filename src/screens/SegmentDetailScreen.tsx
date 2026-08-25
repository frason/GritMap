import { useCallback, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useDatabase } from "../db/DatabaseProvider";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import { listAttemptsForSegment, type AttemptSummary } from "../db/listAttemptsForSegment";
import type { RideTrackPoint } from "../db/getRideTrack";
import { runMatcherForSegment, type MatchRunSummary } from "../matcher/runMatcher";
import type { SegmentsStackParamList } from "../navigation/types";
import { sendSegmentToKaroo } from "../karoo/sendSegmentToKaroo";
import { colors } from "../theme/colors";
import { Icon } from "../theme/Icon";
import { radius, spacing } from "../theme/spacing";
import { RouteMapView } from "./RouteMapView";
import { formatDistanceMiles, formatDurationHoursMinutes, formatElevationFeet, formatRideDate } from "./formatRideStats";

type SegmentDetailRoute = RouteProp<SegmentsStackParamList, "SegmentDetail">;
type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

const generateId = () => Crypto.randomUUID();

export function SegmentDetailScreen() {
  const database = useDatabase();
  const route = useRoute<SegmentDetailRoute>();
  const navigation = useNavigation<Navigation>();
  const [segment, setSegment] = useState<SegmentDetail | undefined>(undefined);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [karooAddress, setKarooAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | undefined>(undefined);
  const [rerunning, setRerunning] = useState(false);
  const [rerunSummary, setRerunSummary] = useState<MatchRunSummary | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      setSegment(getSegmentDetail(database, route.params.segmentId));
      setAttempts(listAttemptsForSegment(database, route.params.segmentId));
    }, [database, route.params.segmentId]),
  );

  function handleRerunMatcher() {
    setRerunning(true);
    setRerunSummary(runMatcherForSegment(database, generateId, route.params.segmentId, Date.now()));
    setAttempts(listAttemptsForSegment(database, route.params.segmentId));
    setRerunning(false);
  }

  if (!segment) {
    return <View style={styles.container} />;
  }

  const totalDistanceMeters = segment.referencePolyline.at(-1)?.distanceMeters ?? 0;

  async function handleSend() {
    if (!segment) return;
    const trimmed = karooAddress.trim();
    if (trimmed.length === 0) {
      setSendStatus("Enter the Karoo's address (shown on its \"Receive from Phone\" screen)");
      return;
    }
    setSending(true);
    setSendStatus("Sending…");
    const result = await sendSegmentToKaroo(segment, trimmed);
    setSending(false);
    setSendStatus(
      result.ok
        ? "Sent — check the Karoo screen to confirm it imported"
        : `Send failed${result.statusCode ? ` (HTTP ${result.statusCode})` : ""}${
            result.message ? `: ${result.message}` : ""
          }`,
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{segment.name}</Text>

      <View style={styles.statsRow}>
        <StatTile value={formatDistanceMiles(totalDistanceMeters)} label="Distance" />
        <StatTile value={`${segment.corridorMeters}m`} label="Corridor" />
        <StatTile value={`${Math.round(segment.requiredCoveragePct * 100)}%`} label="Coverage" />
      </View>

      <Section title="Route overview">
        <View style={styles.routeMap}>
          <RouteMapView points={toRouteMapPoints(segment)} />
        </View>
      </Section>

      <Section title="Send to Karoo">
        <Text style={styles.sendHint}>
          On the Karoo, tap "Receive from Phone" and type the address it shows below.
        </Text>
        <TextInput
          style={styles.addressInput}
          placeholder="192.168.1.42:8734"
          placeholderTextColor={colors.textTertiary}
          value={karooAddress}
          onChangeText={setKarooAddress}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending}
        >
          <Text style={styles.sendButtonLabel}>{sending ? "Sending…" : "Send to Karoo"}</Text>
        </TouchableOpacity>
        {sendStatus !== undefined && <Text style={styles.sendStatusText}>{sendStatus}</Text>}
      </Section>

      <Section title="Attempts">
        {attempts.length === 0 ? (
          <Text style={styles.attemptsEmptyText}>
            No attempts detected yet. Import more rides that traverse this segment to see them
            here.
          </Text>
        ) : (
          attempts.map((attempt) => (
            <AttemptRow
              key={attempt.attemptId}
              attempt={attempt}
              onPress={() => navigation.navigate("AttemptReview", { attemptId: attempt.attemptId })}
            />
          ))
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
    </ScrollView>
  );
}

function AttemptRow({ attempt, onPress }: { attempt: AttemptSummary; onPress: () => void }) {
  const isPositive = attempt.manuallyApproved || attempt.decision === "accept";
  return (
    <TouchableOpacity style={styles.attemptRow} onPress={onPress}>
      <Icon
        name={isPositive ? "checkCircle" : "alertTriangle"}
        color={isPositive ? "statusSuccess" : "statusWarning"}
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
    paddingHorizontal: spacing.space20,
    paddingTop: spacing.space16,
    paddingBottom: spacing.space32,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.space8 + 2,
    marginTop: spacing.space20,
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
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  section: {
    marginTop: spacing.space24,
    gap: spacing.space8 + 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  routeMap: {
    height: 220,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
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
  attemptsEmptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  attemptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    paddingHorizontal: spacing.space16,
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
