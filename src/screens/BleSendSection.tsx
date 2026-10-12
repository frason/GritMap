import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Crypto from "expo-crypto";
import { useFocusEffect } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getActiveGoal } from "../db/getActiveGoal";
import { getAthleteProfile } from "../db/getAthleteProfile";
import type { SegmentDetail } from "../db/getSegmentDetail";
import { getActiveSegmentPlan } from "../db/segmentPlans";
import { computeFileHash } from "../import/computeFileHash";
import { addStateListener, bleAdvertiserAvailable, startTransfer, stopTransfer } from "../../modules/gritmap-ble-peripheral";
import { describeBleSend, reduceBleEvent, type BleSendState } from "../transfer/bleSendStatus";
import { buildDirectTransfer, bytesToBase64 } from "../transfer/directTransfer";
import { encodeTransferId } from "../transfer/transferId";
import { AppText, Button, Card, Notice } from "../theme/components";

/** The contract's receive window: advertising never lasts longer than this. */
const ADVERTISE_MS = 120_000;

/**
 * "Send over Bluetooth (beta)": offers this segment's plan (and the segment, if the Karoo does not
 * have it) to a Karoo directly over BLE (docs/BLE_DIRECT_TRANSFER_CONTRACT.md). Development only: it is
 * rendered only when the dev flag is on. It stops offering when the screen loses focus or the app
 * leaves the foreground, and it says "Imported" only after the Karoo's receipt.
 */
export function BleSendSection({ segment }: { segment: SegmentDetail }) {
  const database = useDatabase();
  const [state, setState] = useState<BleSendState>({ phase: "idle" });
  const offeringRef = useRef(false);

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

  async function handleStart() {
    if (!bleAdvertiserAvailable) {
      setState({ phase: "unsupported" });
      return;
    }
    setState({ phase: "preparing" });
    const profile = getAthleteProfile(database);
    const goal = getActiveGoal(database);
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
      <AppText variant="headline">Send over Bluetooth (beta)</AppText>
      <AppText variant="subheadline" color="textSecondary">
        Hands the pacing plan, and the segment if your Karoo doesn't have it, straight to your Karoo over Bluetooth. No address, no internet. For development
        testing: the Wi-Fi send above is the one that works today.
      </AppText>
      {status.text.length === 0 ? null : (
        <Notice tone={status.tone} live>
          {status.text}
        </Notice>
      )}
      {status.active && state.phase !== "preparing" ? (
        <Button label="Stop" variant="secondary" onPress={() => { stop(); setState({ phase: "stopped" }); }} />
      ) : (
        <Button label="Start Bluetooth send" variant="secondary" icon="wifi" onPress={handleStart} loading={state.phase === "preparing"} />
      )}
    </Card>
  );
}
