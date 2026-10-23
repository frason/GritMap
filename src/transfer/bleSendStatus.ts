import type { BlePeripheralEvent } from "../../modules/gritmap-ble-peripheral/index.ts";

/** The phone-side phases of a Bluetooth send, in the order a good one passes through them. */
export type BleSendState =
  | { phase: "idle" }
  | { phase: "preparing" }
  | { phase: "unavailable"; reason: "noPlan" }
  | { phase: "prepareFailed"; detail: string }
  | { phase: "advertising" }
  | { phase: "connected" }
  | { phase: "sending"; resource: "plan" | "segment" | "rider"; served: number; total: number; planDone: boolean }
  | { phase: "imported"; code: string }
  | { phase: "rejected"; code: string }
  | { phase: "sentUnconfirmed" }
  | { phase: "timedOut" }
  | { phase: "stopped" }
  | { phase: "poweredOff" | "unauthorized" | "unsupported" | "error" };

export interface BleSendStatus {
  text: string;
  tone: "info" | "success" | "warning" | "error";
  /** True while the phone is offering or serving and the screen must stay open. */
  active: boolean;
}

/** Folds a native event into the state. Only a receipt can produce "imported". */
export function reduceBleEvent(state: BleSendState, event: BlePeripheralEvent): BleSendState {
  switch (event.state) {
    case "advertising":
      return { phase: "advertising" };
    case "connected":
      return { phase: "connected" };
    case "progress": {
      const previousPlanDone = state.phase === "sending" ? state.planDone : false;
      const planDone = previousPlanDone || (event.resource === "plan" && event.served >= event.total);
      return { phase: "sending", resource: event.resource, served: event.served, total: event.total, planDone };
    }
    case "receipt":
      return event.status === "imported" ? { phase: "imported", code: event.code } : { phase: "rejected", code: event.code };
    case "sentUnconfirmed":
      return { phase: "sentUnconfirmed" };
    case "timedOut":
      return { phase: "timedOut" };
    case "stopped":
      return { phase: "stopped" };
    case "poweredOff":
    case "unauthorized":
    case "unsupported":
    case "error":
      return { phase: event.state };
  }
}

const REJECTION_WORDS: Record<string, string> = {
  bad_hash: "the data was damaged on the way",
  bad_segment: "it couldn't read the segment",
  bad_plan: "it couldn't read the plan",
  fingerprint_mismatch: "the plan didn't match the segment",
  ftp_mismatch: "the plan was built for a different FTP than the Karoo has",
  too_large: "the transfer was too large",
  storage: "it ran out of space or couldn't save",
  timeout: "it ran out of time",
  cancelled: "it was cancelled on the Karoo",
  unsupported_version: "this Karoo build is too old for Bluetooth transfers",
};

const SEGMENT_LABEL: Record<string, string> = { plan: "the plan", segment: "the segment", rider: "your rider details" };

/**
 * Plain status wording. "Imported on your Karoo" appears only for a receipt with status imported; a
 * transfer whose plan was fully read but never confirmed says "Sent; check your Karoo".
 */
export function describeBleSend(state: BleSendState): BleSendStatus {
  switch (state.phase) {
    case "idle":
      return { text: "", tone: "info", active: false };
    case "preparing":
      return { text: "Preparing the transfer…", tone: "info", active: true };
    case "unavailable":
      return { text: "A Bluetooth send carries a pacing plan. Set your FTP and a goal time for this segment first, then try again, or use Wi-Fi to send just the segment.", tone: "warning", active: false };
    case "prepareFailed":
      return { text: `Couldn't prepare the transfer. ${state.detail}`.trim(), tone: "error", active: false };
    case "advertising":
      return {
        text: "Waiting for your Karoo. On the Karoo, open GritMap, then Inbox, then tap Receive from Phone. Keep this screen open: it stops after 2 minutes.",
        tone: "info",
        active: true,
      };
    case "connected":
      return { text: "Karoo connected. Starting the transfer…", tone: "info", active: true };
    case "sending": {
      const percent = state.total === 0 ? 0 : Math.round((state.served / state.total) * 100);
      return { text: `Sending ${SEGMENT_LABEL[state.resource] ?? "the data"} to your Karoo… ${percent}%`, tone: "info", active: true };
    }
    case "imported":
      return { text: "Imported on your Karoo.", tone: "success", active: false };
    case "rejected":
      return {
        text: `Your Karoo couldn't use this transfer${REJECTION_WORDS[state.code] === undefined ? "" : `: ${REJECTION_WORDS[state.code]}`}. Try again, or use the Wi-Fi send.`,
        tone: "warning",
        active: false,
      };
    case "sentUnconfirmed":
      return { text: "Sent; check your Karoo. It hasn't confirmed the import yet.", tone: "info", active: false };
    case "timedOut":
      return { text: "The transfer didn't finish in time. Try again.", tone: "warning", active: false };
    case "stopped":
      return { text: "Stopped. Bluetooth is no longer being offered.", tone: "info", active: false };
    case "poweredOff":
      return { text: "Bluetooth is turned off. Turn it on in Settings, then try again.", tone: "warning", active: false };
    case "unauthorized":
      return { text: "GritMap doesn't have Bluetooth permission. Allow it in Settings, then try again.", tone: "warning", active: false };
    case "unsupported":
      return { text: "Bluetooth sending isn't available on this device.", tone: "warning", active: false };
    case "error":
      return { text: "Bluetooth couldn't start. Try again.", tone: "error", active: false };
  }
}

/** How long the phone waits with nobody connecting before it suggests the Karoo may be too old for Bluetooth. */
export const OLDER_KAROO_HINT_AFTER_MS = 30_000;

/**
 * True when the phone has been advertising for a while with no Karoo connecting: most often the Karoo's GritMap is an older
 * version without the Bluetooth receiver (the phone cannot read the Karoo's version), or Receive from Phone is not open.
 */
export function shouldHintOlderKaroo(state: BleSendState, waitedMs: number): boolean {
  return state.phase === "advertising" && waitedMs >= OLDER_KAROO_HINT_AFTER_MS;
}

/** Phases after which the rider should be offered the Wi-Fi route (anything that is not a clean success or a fresh start). */
export function offersWifiFallback(state: BleSendState): boolean {
  return state.phase !== "idle" && state.phase !== "preparing" && state.phase !== "imported" && state.phase !== "connected" && state.phase !== "sending";
}
