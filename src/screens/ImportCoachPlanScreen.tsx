import { useCallback, useState } from "react";
import { Share } from "react-native";
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
import { AppText, Button, Card, EmptyState, ErrorState, LoadingState, Notice, ScreenScroll, TextField } from "../theme/components";
import { ElevationProfileChart } from "./ElevationProfileChart";
import { PredictedFinish } from "./PredictedFinish";

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
  const [loaded, setLoaded] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [segment, setSegment] = useState<SegmentDetail | undefined>(undefined);
  const [profile, setProfile] = useState<AthleteProfile>({});
  const [goalDurationMs, setGoalDurationMs] = useState<number | undefined>(undefined);
  const [text, setText] = useState("");
  const [result, setResult] = useState<CoachPlanParseResult | undefined>(undefined);
  const [prediction, setPrediction] = useState<PlanFinishPrediction | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [shareError, setShareError] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    try {
      const detail = getSegmentDetail(database, route.params.segmentId);
      setSegment(detail);
      setProfile(getAthleteProfile(database));
      const goal = getActiveGoal(database);
      setGoalDurationMs(goal !== undefined && goal.segmentId === route.params.segmentId ? goal.targetDurationMs : undefined);
      setLoaded(detail === undefined ? "missing" : "ready");
    } catch {
      setLoaded("error");
    }
  }, [database, route.params.segmentId]);

  useFocusEffect(load);

  if (loaded === "loading") {
    return (
      <ScreenScroll>
        <LoadingState label="Loading segment…" />
      </ScreenScroll>
    );
  }
  if (loaded === "error") {
    return <ErrorState message="GritMap couldn't open this segment. Go back and try again." onRetry={load} />;
  }
  if (loaded === "missing" || segment === undefined) {
    return <ErrorState title="This segment is no longer available" message="It may have been removed. Go back to your segments and pick another." />;
  }

  const totalMeters = segment.referencePolyline.at(-1)?.distanceMeters ?? 0;
  const ftpWatts = profile.ftpWatts;

  if (ftpWatts === undefined) {
    return (
      <EmptyState
        icon="speedometer"
        title="Set your FTP first"
        body="A pacing plan is checked against your FTP (no target may be more than 150% of it), so GritMap needs it before it can accept one."
        actions={[{ label: "Set your FTP", onPress: () => navigation.navigate("ZonesSettings") }]}
      />
    );
  }

  async function handleShareRequest() {
    if (segment === undefined || ftpWatts === undefined) return;
    setShareError(undefined);
    try {
      await Share.share({
        message: buildCoachPlanRequest({
          segmentName: segment.name,
          segmentFingerprint: segment.fingerprint,
          referencePolyline: segment.referencePolyline,
          ftpWatts,
          ...(goalDurationMs === undefined ? {} : { targetDurationMs: goalDurationMs }),
        }),
      });
    } catch (error) {
      setShareError(`GritMap couldn't open the share sheet. ${error instanceof Error ? error.message : ""}`.trim());
    }
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
      setSaveError(`GritMap couldn't save this plan. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <ScreenScroll>
      <AppText variant="title2" accessibilityRole="header">
        Import a pacing plan
      </AppText>
      <AppText variant="body" color="textSecondary">
        Use a plan written by you, a coach, or an AI assistant instead of GritMap's own. It is checked against this segment
        and your {Math.round(ftpWatts)} W FTP with the same rules the Karoo applies, so a plan that passes here will import
        there.
      </AppText>

      <Card>
        <AppText variant="headline">1. Ask for a plan</AppText>
        <AppText variant="subheadline" color="textSecondary">
          Sends this segment's distance, how steep each part is, and the rules, plus a template to edit
          {goalDurationMs === undefined ? "" : " pre-filled with GritMap's own plan for your goal"}, to a coach or an AI chat.
        </AppText>
        <Button label="Share request" variant="secondary" icon="people" onPress={handleShareRequest} />
        {shareError === undefined ? null : <Notice tone="error" live>{shareError}</Notice>}
      </Card>

      <Card>
        <AppText variant="headline">2. Paste the plan</AppText>
        <TextField
          label="Plan"
          value={text}
          onChangeText={(value) => {
            setText(value);
            setResult(undefined);
            setPrediction(undefined);
          }}
          placeholder='{ "packageType": "gritmap-coach-plan", … }'
          hint="Paste exactly what the coach or AI sent back."
          multiline
        />
        <Button label="Check plan" onPress={handleCheck} disabled={text.trim().length === 0} />
      </Card>

      {result !== undefined && !result.ok && (
        <Card>
          <Notice tone="error" live>
            This plan can't be used yet.
          </Notice>
          {result.errors.map((error, index) => (
            <AppText key={index} variant="subheadline">
              • {error}
            </AppText>
          ))}
          <AppText variant="footnote" color="textSecondary">
            Fix these in the plan (or ask the coach to) and check again.
          </AppText>
        </Card>
      )}

      {result !== undefined && result.ok && (
        <Card>
          <Notice tone="success" live>
            Plan looks good. Nothing is saved until you tap Use this plan.
          </Notice>
          <PlanSummary
            result={result}
            ftpWatts={ftpWatts}
            prediction={prediction}
            goalDurationMs={goalDurationMs}
            weightMissing={profile.weightKg === undefined}
            onSetWeight={() => navigation.navigate("ZonesSettings")}
          />
          {result.warnings.map((warning, index) => (
            <AppText key={index} variant="footnote" color="textSecondary">
              • {warning}
            </AppText>
          ))}
          <ElevationProfileChart referencePolyline={segment.referencePolyline} zones={result.plan.zones} />
          {saveError === undefined ? null : <Notice tone="error" live>{saveError}</Notice>}
          <Button label="Use this plan" onPress={handleUsePlan} />
        </Card>
      )}
    </ScreenScroll>
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
  return (
    <>
      <AppText variant="subheadline" style={{ fontWeight: "600" }}>
        {SOURCE_LABELS[plan.source]}
        {plan.authorLabel === undefined ? "" : ` · ${plan.authorLabel}`}
      </AppText>
      <AppText variant="subheadline">
        {summary.zoneCount} sections · avg {summary.averagePowerWatts} W ({summary.percentOfFtp}% of your FTP) ·{" "}
        {summary.minPowerWatts}–{summary.maxPowerWatts} W
      </AppText>
      {prediction === undefined ? null : (
        <PredictedFinish
          prediction={prediction}
          {...(goalDurationMs === undefined ? {} : { goalDurationMs })}
          {...(plan.targetFinishTimeSeconds === undefined ? {} : { coachTargetSeconds: plan.targetFinishTimeSeconds })}
          {...(plan.targetFinishTimeSeconds === undefined ? { targetNote: "This is the target time the Karoo will be given for this plan." } : {})}
        />
      )}
      {prediction === undefined && weightMissing ? (
        <Button label="Set your weight to see a predicted finish time" variant="tertiary" fullWidth={false} onPress={onSetWeight} />
      ) : null}
      {plan.notes === undefined ? null : (
        <AppText variant="subheadline" color="textSecondary">
          {plan.notes}
        </AppText>
      )}
    </>
  );
}
