import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Crypto from "expo-crypto";
import { useFocusEffect } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getActiveGoal, type ActiveGoal } from "../db/getActiveGoal";
import { getAthleteProfile, type AthleteProfile } from "../db/getAthleteProfile";
import type { SegmentDetail } from "../db/getSegmentDetail";
import { recordPlanSend } from "../db/planSends";
import { getActiveSegmentPlan, markSegmentPlanSent, type SavedSegmentPlan } from "../db/segmentPlans";
import { describeSendResult } from "../karoo/describeSendResult";
import { getSavedKarooAddress, saveKarooAddress } from "../karoo/savedKarooAddress";
import { sendGuidancePackageToKaroo } from "../karoo/sendGuidancePackageToKaroo";
import { sendSegmentToKaroo } from "../karoo/sendSegmentToKaroo";
import { KAROO_ADDRESS_EXAMPLE, KAROO_WIFI_RECEIVE, WIFI_FALLBACK_STEPS } from "../onboarding/onboardingCopy";
import { loadCalibrationAttempts } from "../pacing/loadCalibrationAttempts";
import { loadPlanHistory } from "../pacing/loadPlanHistory";
import { createWeightAt } from "../db/profileHistory";
import { predictPlanFinish, type PlanFinishPrediction } from "../pacing/predictPlanFinish";
import { AppText, Button, Card, Notice, TextField } from "../theme/components";
import { spacing } from "../theme/spacing";

type SendStatus = { text: string; ok: boolean };

const generateId = () => Crypto.randomUUID();

/**
 * The Wi-Fi route to the Karoo, shown only as the fallback when Bluetooth does not work: the original IP send. It sends the segment
 * with its pacing plan when the rider has a goal or an imported plan and a weight, and the segment alone otherwise. It keeps exactly
 * what the segment page used to do: records the plan that was sent and marks an imported plan as sent.
 */
export function WifiSendSection({ segment }: { segment: SegmentDetail }) {
  const database = useDatabase();
  const [address, setAddress] = useState("");
  const [profile, setProfile] = useState<AthleteProfile>({});
  const [goal, setGoal] = useState<ActiveGoal | undefined>(undefined);
  const [activePlan, setActivePlan] = useState<SavedSegmentPlan | undefined>(undefined);
  const [prediction, setPrediction] = useState<PlanFinishPrediction | undefined>(undefined);
  const [sending, setSending] = useState<"plan" | "segment" | undefined>(undefined);
  const [status, setStatus] = useState<SendStatus | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      const currentProfile = getAthleteProfile(database);
      const currentPlan = getActiveSegmentPlan(database, segment.segmentId);
      setProfile(currentProfile);
      setGoal(getActiveGoal(database));
      setActivePlan(currentPlan);
      setAddress((current) => (current === "" ? (getSavedKarooAddress(database) ?? "") : current));
      setPrediction(
        currentPlan !== undefined && currentProfile.weightKg !== undefined
          ? predictPlanFinish({
              zones: currentPlan.zones,
              referencePolyline: segment.referencePolyline,
              riderWeightKg: currentProfile.weightKg,
              attempts: loadCalibrationAttempts(database, segment.segmentId, 3, createWeightAt(database)),
            })
          : undefined,
      );
    }, [database, segment]),
  );

  const goalForSegment = goal !== undefined && goal.segmentId === segment.segmentId ? goal : undefined;
  const canSendPlan =
    profile.ftpWatts !== undefined && profile.weightKg !== undefined && (activePlan !== undefined || goalForSegment !== undefined);

  function addressOrError(): string | undefined {
    const trimmed = address.trim();
    if (trimmed.length === 0) {
      setStatus({ text: `Type the address your Karoo shows after you tap ${KAROO_WIFI_RECEIVE}.`, ok: false });
      return undefined;
    }
    return trimmed;
  }

  async function handleSendPlan() {
    const { ftpWatts, weightKg, maxHeartRateBpm } = profile;
    if (ftpWatts === undefined || weightKg === undefined) return;
    const trimmed = addressOrError();
    if (trimmed === undefined) return;
    setSending("plan");
    setStatus(undefined);
    const packageId = generateId();
    const sentAtMs = Date.now();
    const result = await sendGuidancePackageToKaroo(
      segment,
      { ftpWatts, weightKg, ...(maxHeartRateBpm === undefined ? {} : { maxHeartRateBpm }) },
      activePlan === undefined ? goalForSegment?.targetDurationMs : undefined,
      trimmed,
      packageId,
      sentAtMs,
      // A coach plan with no target time of its own gets the predicted finish, so the Karoo's pacer has a time to work to.
      activePlan !== undefined && activePlan.targetFinishSeconds === undefined && prediction !== undefined
        ? { ...activePlan, targetFinishSeconds: Math.round(prediction.durationMs / 1_000) }
        : activePlan,
      // GritMap's own plan is made realistic from the rider's past efforts here; an imported plan is sent as written.
      loadPlanHistory(database, segment.segmentId, weightKg),
    );
    setSending(undefined);
    // Keep what the Karoo was handed, so a later ride is judged against this plan and not against whatever the plan has become.
    if (result.ok && result.baselinePlan !== undefined) {
      recordPlanSend(database, { id: generateId(), segmentId: segment.segmentId, sentAtMs, packageId, plan: result.baselinePlan });
    }
    if (result.ok && activePlan !== undefined) {
      markSegmentPlanSent(database, activePlan.id, Date.now());
      setActivePlan(getActiveSegmentPlan(database, activePlan.segmentId));
    }
    if (result.ok) setAddress(saveKarooAddress(database, trimmed, Date.now()));
    setStatus({ text: describeSendResult(result, trimmed), ok: result.ok });
  }

  async function handleSendSegment() {
    const trimmed = addressOrError();
    if (trimmed === undefined) return;
    setSending("segment");
    setStatus(undefined);
    const result = await sendSegmentToKaroo(segment, trimmed);
    setSending(undefined);
    if (result.ok) setAddress(saveKarooAddress(database, trimmed, Date.now()));
    setStatus({ text: describeSendResult(result, trimmed), ok: result.ok });
  }

  return (
    <Card>
      <AppText variant="headline" accessibilityRole="header">
        Send over Wi-Fi
      </AppText>
      {WIFI_FALLBACK_STEPS.map((item, index) => (
        <View key={item.title} style={styles.step} accessible accessibilityLabel={`Step ${index + 1}. ${item.title}. ${item.body}`}>
          <AppText variant="subheadline" color="brand" style={styles.stepNumber}>
            {index + 1}.
          </AppText>
          <View style={styles.stepText}>
            <AppText variant="subheadline" style={styles.stepTitle}>
              {item.title}
            </AppText>
            <AppText variant="footnote" color="textSecondary">
              {item.body}
            </AppText>
          </View>
        </View>
      ))}
      <TextField
        label="Karoo address"
        value={address}
        onChangeText={setAddress}
        placeholder={`e.g. ${KAROO_ADDRESS_EXAMPLE}`}
        hint="The port is optional. GritMap remembers the address after a successful send."
        keyboardType="numbers-and-punctuation"
      />
      {canSendPlan ? (
        <Button label="Send plan to Karoo" onPress={handleSendPlan} loading={sending === "plan"} disabled={sending !== undefined} />
      ) : null}
      <Button
        label="Send segment only"
        variant={canSendPlan ? "secondary" : "primary"}
        onPress={handleSendSegment}
        loading={sending === "segment"}
        disabled={sending !== undefined}
      />
      {canSendPlan ? null : (
        <AppText variant="footnote" color="textSecondary">
          To send a pacing plan too, set your FTP and weight in Your Profile and give this segment a goal time.
        </AppText>
      )}
      {status === undefined ? null : (
        <Notice tone={status.ok ? "success" : "error"} live>
          {status.text}
        </Notice>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: spacing.space8, alignItems: "flex-start" },
  stepNumber: { fontWeight: "600", minWidth: 20 },
  stepText: { flex: 1, gap: spacing.space2 },
  stepTitle: { fontWeight: "600" },
});
