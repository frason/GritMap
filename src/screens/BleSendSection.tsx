import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Crypto from "expo-crypto";
import { useFocusEffect } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getSegmentGoal } from "../db/getActiveGoal";
import { getAthleteProfile } from "../db/getAthleteProfile";
import type { SegmentDetail } from "../db/getSegmentDetail";
import { recordPlanSend, type SentBaselinePlan } from "../db/planSends";
import { getActiveSegmentPlan, markSegmentPlanSent } from "../db/segmentPlans";
import { loadPlanHistory } from "../pacing/loadPlanHistory";
import { computeFileHash } from "../import/computeFileHash";
import { addStateListener, bleAdvertiserAvailable, startTransfer, stopTransfer } from "../../modules/gritmap-ble-peripheral";
import { describeBleSend, offersWifiFallback, reduceBleEvent, shouldHintOlderKaroo, OLDER_KAROO_HINT_AFTER_MS, type BleSendState } from "../transfer/bleSendStatus";
import { OLDER_KAROO_HINT } from "../onboarding/onboardingCopy";
import { buildDirectTransfer, bytesToBase64 } from "../transfer/directTransfer";
import { encodeTransferId } from "../transfer/transferId";
import { AppText, Button, Card, Notice } from "../theme/components";

/** The contract's receive window: advertising never lasts longer than this. */
const ADVERTISE_MS = 120_000;

/**
 * "Send over Bluetooth": offers this segment's plan (and the segment, if the Karoo does not
 * have it) to a Karoo directly over BLE (docs/BLE_DIRECT_TRANSFER_CONTRACT.md). It stops offering when
 * the screen loses focus or the app leaves the foreground, and it says "Imported" only after the Karoo's receipt.
 * After 30 seconds with no Karoo connecting it says the Karoo may be too old, and whenever Bluetooth is not
 * going well it offers `onUseWifi` (the Wi-Fi route) as the way out.
 */
export function BleSendSection({ segment, onUseWifi, wifiOpen }: { segment: SegmentDetail; onUseWifi: () => void; wifiOpen: boolean }) {
  const database = useDatabase();
  const [state, setState] = useState<BleSendState>({ phase: "idle" });
  const offeringRef = useRef(false);
  // What the current offer carries, kept so a Karoo receipt ("imported") can record the plan the Karoo really got.
  const pendingRef = useRef<{ packageId: string; plan: SentBaselinePlan; importedPlanId: string | undefined; sentAtMs: number } | undefined>(undefined);

  const stop = useCallback(() => {
    if (offeringRef.current) stopTransfer();
    offeringRef.current = false;
  }, []);

  useEffect(() => {
    const subscription = addStateListener((event) => {
      if (event.state !== "advertising" && event.state !== "connected" && event.state !== "progress") offeringRef.current = false;
      setState((current) => reduceBleEvent(current, event));
    });
    const appState = AppState.addEventListener("change", (next) => {
      if (next !== "active") stop();
    });
    return () => {
      subscription.remove();
      appState.remove();
      stop();
    };
  }, [stop]);

  useFocusEffect(useCallback(() => () => stop(), [stop]));

  // Only a receipt from the Karoo counts as a send: then keep the plan it was handed (so a later ride is judged against it) and
  // mark an imported coach plan as sent, exactly as the Wi-Fi send does.
  useEffect(() => {
    if (state.phase !== "imported" || pendingRef.current === undefined) return;
    const pending = pendingRef.current;
    pendingRef.current = undefined;
    try {
      recordPlanSend(database, { id: Crypto.randomUUID(), segmentId: segment.segmentId, sentAtMs: pending.sentAtMs, packageId: pending.packageId, plan: pending.plan });
      if (pending.importedPlanId !== undefined) markSegmentPlanSent(database, pending.importedPlanId, Date.now());
    } catch {
      // The transfer itself succeeded; failing to keep a record must not turn it into an error for the rider.
    }
  }, [state.phase, database, segment.segmentId]);

  // How long the phone has been waiting for a Karoo to connect (restarts each time it starts advertising).
  const [waitedMs, setWaitedMs] = useState(0);
  useEffect(() => {
    if (state.phase !== "advertising") {
      setWaitedMs(0);
      return undefined;
    }
    const timer = setTimeout(() => setWaitedMs(OLDER_KAROO_HINT_AFTER_MS), OLDER_KAROO_HINT_AFTER_MS);
    return () => clearTimeout(timer);
  }, [state.phase]);

  async function handleStart() {
    if (!bleAdvertiserAvailable) {
      setState({ phase: "unsupported" });
      return;
    }
    setState({ phase: "preparing" });
    const profile = getAthleteProfile(database);
    const goal = getSegmentGoal(database, segment.segmentId);
    const activePlan = getActiveSegmentPlan(database, segment.segmentId);
    const goalMs = goal !== undefined && goal.segmentId === segment.segmentId ? goal.targetDurationMs : undefined;
    if (profile.ftpWatts === undefined || (activePlan === undefined && goalMs === undefined)) {
      setState({ phase: "unavailable", reason: "noPlan" });
      return;
    }
    const built = await buildDirectTransfer({
      segment,
      rider: { ftpWatts: profile.ftpWatts, weightKg: profile.weightKg, maxHeartRateBpm: profile.maxHeartRateBpm },
      targetDurationMs: activePlan === undefined ? goalMs : undefined,
      importedPlan: activePlan,
      planHistory: loadPlanHistory(database, segment.segmentId, profile.weightKg),
      nowMs: Date.now(),
      // 128 random bits from the platform CSPRNG (SecRandomCopyBytes through expo-crypto).
      transferId: encodeTransferId(Crypto.getRandomBytes(16)),
      sha256Hex: (bytes) => computeFileHash(new Uint8Array(bytes)),
    });
    if (!built.ok) {
      setState({ phase: "prepareFailed", detail: built.message });
      return;
    }
    const { transfer } = built;
    pendingRef.current = {
      packageId: transfer.manifest.transferId,
      plan: transfer.baselinePacingPlan as SentBaselinePlan,
      importedPlanId: activePlan?.id,
      sentAtMs: Date.now(),
    };
    try {
      startTransfer({
        manifest: transfer.manifestJson,
        planBase64: bytesToBase64(transfer.planBytes),
        segmentBase64: bytesToBase64(transfer.segmentBytes),
        riderBase64: transfer.riderBytes === undefined ? null : bytesToBase64(transfer.riderBytes),
        advertiseMs: ADVERTISE_MS,
      });
      offeringRef.current = true;
    } catch {
      setState({ phase: "error" });
    }
  }

  const status = describeBleSend(state);

  return (
    <Card>
      <AppText variant="headline">Send over Bluetooth</AppText>
      <AppText variant="subheadline" color="textSecondary">
        Sends the pacing plan, and the segment if your Karoo doesn't have it, straight from your phone to your Karoo. No address or Wi-Fi needed.
      </AppText>
      {status.text.length === 0 ? null : (
        <Notice tone={status.tone} live>
          {status.text}
        </Notice>
      )}
      {shouldHintOlderKaroo(state, waitedMs) ? <Notice tone="info" live>{OLDER_KAROO_HINT}</Notice> : null}
      {status.active && state.phase !== "preparing" ? (
        <Button label="Stop" variant="secondary" onPress={() => { stop(); setState({ phase: "stopped" }); }} />
      ) : (
        <Button label="Start Bluetooth send" icon="bluetooth" onPress={handleStart} loading={state.phase === "preparing"} />
      )}
      {offersWifiFallback(state) && !wifiOpen ? <Button label="Bluetooth not working? Use Wi-Fi" variant="tertiary" fullWidth={false} onPress={onUseWifi} /> : null}
    </Card>
  );
}
