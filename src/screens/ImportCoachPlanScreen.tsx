import { useCallback, useState } from "react";
import { ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useDatabase } from "../db/DatabaseProvider";
import { getActiveGoal } from "../db/getActiveGoal";
import { getAthleteProfile, type AthleteProfile } from "../db/getAthleteProfile";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import { saveSegmentPlan } from "../db/segmentPlans";
import { buildCoachPlanRequest } from "../pacing/buildCoachPlanRequest";
import { loadCalibrationAttempts } from "../pacing/loadCalibrationAttempts";
import { predictPlanFinish, type PlanFinishPrediction } from "../pacing/predictPlanFinish";
import { parseCoachPlan, summarizeCoachPlan, type CoachPlanParseResult } from "../pacing/coachPlan";
import type { SegmentsStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { describePlanPrediction } from "./describePlanPrediction";
import { ElevationProfileChart } from "./ElevationProfileChart";

type ImportCoachPlanRoute = RouteProp<SegmentsStackParamList, "ImportCoachPlan">;
type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

const SOURCE_LABELS = { self: "Written by you", "human-coach": "Human coach", "ai-coach": "AI coach" } as const;

/**
 * Brings pacing guidance written by the rider, a human coach, or an AI coach into the app.
 * Whatever its origin, the plan is pasted as one structured document (coachPlan.ts), checked
 * against this segment and the rider's FTP by the same rules the Karoo enforces, previewed,
 * and only then saved as the segment's active plan. Nothing is sent to the Karoo from here.
 */
export function ImportCoachPlanScreen() {
  const database = useDatabase();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<ImportCoachPlanRoute>();
  const [segment, setSegment] = useState<SegmentDetail | undefined>(undefined);
  const [profile, setProfile] = useState<AthleteProfile>({});
  const [goalDurationMs, setGoalDurationMs] = useState<number | undefined>(undefined);
  const [text, setText] = useState("");
  const [result, setResult] = useState<CoachPlanParseResult | undefined>(undefined);
  const [prediction, setPrediction] = useState<PlanFinishPrediction | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      setSegment(getSegmentDetail(database, route.params.segmentId));
      setProfile(getAthleteProfile(database));
      const goal = getActiveGoal(database);
      setGoalDurationMs(goal !== undefined && goal.segmentId === route.params.segmentId ? goal.targetDurationMs : undefined);
    }, [database, route.params.segmentId]),
  );

  if (segment === undefined) return <View style={styles.container} />;

  const totalMeters = segment.referencePolyline.at(-1)?.distanceMeters ?? 0;
  const ftpWatts = profile.ftpWatts;

  if (ftpWatts === undefined) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Import a pacing plan</Text>
          <Text style={styles.body}>
            Plans are checked against your FTP (no target may exceed 150% of it), so set your FTP first.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("ZonesSettings")}>
            <Text style={styles.primaryButtonLabel}>Set FTP</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  async function handleShareRequest() {
    if (segment === undefined || ftpWatts === undefined) return;
    await Share.share({
      message: buildCoachPlanRequest({
        segmentName: segment.name,
        segmentFingerprint: segment.fingerprint,
        referencePolyline: segment.referencePolyline,
        ftpWatts,
        ...(goalDurationMs === undefined ? {} : { targetDurationMs: goalDurationMs }),
      }),
    });
  }

  function handleCheck() {
    if (segment === undefined || ftpWatts === undefined) return;
    setSaveError(undefined);
    const parsed = parseCoachPlan(text, {
      segmentFingerprint: segment.fingerprint,
      segmentLengthMeters: totalMeters,
      ftpWatts,
    });
    setResult(parsed);
    setPrediction(
      parsed.ok && profile.weightKg !== undefined
        ? predictPlanFinish({
            zones: parsed.plan.zones,
            referencePolyline: segment.referencePolyline,
            riderWeightKg: profile.weightKg,
            attempts: loadCalibrationAttempts(database, segment.segmentId),
          })
        : undefined,
    );
  }

  function handleUsePlan() {
    if (segment === undefined || ftpWatts === undefined || result === undefined || !result.ok) return;
    try {
      saveSegmentPlan(database, {
        id: Crypto.randomUUID(),
        segmentId: segment.segmentId,
        plan: result.plan,
        profileVersion: profile.profileVersion ?? 1,
        ftpWatts,
        nowMs: Date.now(),
      });
      navigation.goBack();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Import a pacing plan</Text>
      <Text style={styles.body}>
        Use a plan written by you, a coach, or an AI assistant instead of GritMap's generated one. It is checked against
        this segment and your {Math.round(ftpWatts)} W FTP with the same rules the Karoo applies, so a plan that passes
        here will import there.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Ask for a plan</Text>
        <Text style={styles.body}>
          Sends this segment's distance, grade profile and the rules, plus a template to edit
          {goalDurationMs === undefined ? "" : " pre-filled with GritMap's own plan for your goal"}, to a coach or AI
          chat.
        </Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleShareRequest}>
          <Text style={styles.secondaryButtonLabel}>Share request</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Paste the plan</Text>
        <TextInput
          style={styles.pasteInput}
          multiline
          placeholder='{ "packageType": "gritmap-coach-plan", … }'
          placeholderTextColor={colors.textTertiary}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setResult(undefined);
            setPrediction(undefined);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
        />
        <TouchableOpacity
          style={[styles.primaryButton, text.trim().length === 0 && styles.buttonDisabled]}
          onPress={handleCheck}
          disabled={text.trim().length === 0}
        >
          <Text style={styles.primaryButtonLabel}>Check plan</Text>
        </TouchableOpacity>
      </View>

      {result !== undefined && !result.ok && (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>This plan can't be used yet</Text>
          {result.errors.map((error, index) => (
            <Text key={index} style={styles.errorLine}>
              • {error}
            </Text>
          ))}
          <Text style={styles.body}>Fix these in the plan (or ask the coach to) and check again.</Text>
        </View>
      )}

      {result !== undefined && result.ok && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Plan looks good</Text>
          <PlanSummary
            result={result}
            ftpWatts={ftpWatts}
            prediction={prediction}
            goalDurationMs={goalDurationMs}
            weightMissing={profile.weightKg === undefined}
            onSetWeight={() => navigation.navigate("ZonesSettings")}
          />
          {result.warnings.map((warning, index) => (
            <Text key={index} style={styles.warningLine}>
              • {warning}
            </Text>
          ))}
          <ElevationProfileChart referencePolyline={segment.referencePolyline} zones={result.plan.zones} />
          {saveError !== undefined && <Text style={styles.errorLine}>{saveError}</Text>}
          <TouchableOpacity style={styles.primaryButton} onPress={handleUsePlan}>
            <Text style={styles.primaryButtonLabel}>Use this plan</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function PlanSummary({
  result,
  ftpWatts,
  prediction,
  goalDurationMs,
  weightMissing,
  onSetWeight,
}: {
  result: Extract<CoachPlanParseResult, { ok: true }>;
  ftpWatts: number;
  prediction: PlanFinishPrediction | undefined;
  goalDurationMs: number | undefined;
  weightMissing: boolean;
  onSetWeight: () => void;
}) {
  const { plan } = result;
  const summary = summarizeCoachPlan(plan.zones, ftpWatts);
  const lines =
    prediction === undefined
      ? undefined
      : describePlanPrediction({
          prediction,
          ...(goalDurationMs === undefined ? {} : { goalDurationMs }),
          ...(plan.targetFinishTimeSeconds === undefined ? {} : { coachTargetSeconds: plan.targetFinishTimeSeconds }),
        });
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryLine}>
        {SOURCE_LABELS[plan.source]}
        {plan.authorLabel === undefined ? "" : ` · ${plan.authorLabel}`}
      </Text>
      <Text style={styles.summaryLine}>
        {summary.zoneCount} zones · avg {summary.averagePowerWatts} W ({summary.percentOfFtp}% FTP) · {summary.minPowerWatts}–
        {summary.maxPowerWatts} W
      </Text>
      {lines !== undefined && (
        <View style={styles.prediction}>
          <Text style={styles.predictionHeadline}>{lines.headline}</Text>
          <Text style={styles.body}>{lines.basis}</Text>
          {lines.goal !== undefined && <Text style={styles.summaryLine}>{lines.goal}</Text>}
          {lines.coachTarget !== undefined && <Text style={styles.body}>{lines.coachTarget}</Text>}
          {plan.targetFinishTimeSeconds === undefined && (
            <Text style={styles.body}>This is the target time the Karoo will be given for this plan.</Text>
          )}
        </View>
      )}
      {prediction === undefined && weightMissing && (
        <TouchableOpacity onPress={onSetWeight}>
          <Text style={styles.link}>Set your weight to see a predicted finish time</Text>
        </TouchableOpacity>
      )}
      {plan.notes !== undefined && <Text style={styles.body}>{plan.notes}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.space20, paddingTop: spacing.space16, paddingBottom: spacing.space32, gap: spacing.space16 },
  title: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.space16,
    gap: spacing.space12,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  pasteInput: {
    minHeight: 140,
    maxHeight: 280,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.space12,
    fontSize: 13,
    color: colors.textPrimary,
  },
  primaryButton: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.space12, alignItems: "center" },
  primaryButtonLabel: { color: colors.textOnBrand, fontSize: 15, fontWeight: "600" },
  secondaryButton: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, paddingVertical: spacing.space12, alignItems: "center" },
  secondaryButtonLabel: { color: colors.brand, fontSize: 15, fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
  errorTitle: { fontSize: 16, fontWeight: "700", color: colors.statusWarning },
  errorLine: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  warningLine: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  summary: { gap: spacing.space4 },
  summaryLine: { fontSize: 14, color: colors.textPrimary },
  prediction: { gap: spacing.space4, paddingTop: spacing.space4 },
  predictionHeadline: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  link: { fontSize: 14, fontWeight: "600", color: colors.brand },
});
