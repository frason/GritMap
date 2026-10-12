import { requireOptionalNativeModule } from "expo-modules-core";

/** What the native peripheral reports. Events never include the transfer's bytes. */
export type BlePeripheralEvent =
  | { state: "advertising" }
  | { state: "connected" }
  | { state: "progress"; resource: "plan" | "segment" | "rider"; served: number; total: number }
  | { state: "receipt"; status: "imported" | "rejected"; code: string }
  | { state: "sentUnconfirmed" }
  | { state: "timedOut" }
  | { state: "stopped" }
  | { state: "poweredOff" | "unauthorized" | "unsupported" | "error" };

interface NativeBlePeripheral {
  startTransfer(manifest: string, planBase64: string, segmentBase64: string | null, riderBase64: string | null, advertiseMs: number): void;
  stopTransfer(): void;
  addListener(eventName: "onStateChange", listener: (event: BlePeripheralEvent) => void): { remove(): void };
}

/** Null on web, Android and any build that does not link the module. */
const native = requireOptionalNativeModule<NativeBlePeripheral>("GritMapBlePeripheral");

export const bleAdvertiserAvailable = native !== null;

/**
 * Offers one transfer over BLE (docs/BLE_DIRECT_TRANSFER_CONTRACT.md): advertise only the service UUID for at most
 * `advertiseMs`, serve the manifest, the requested chunks, and accept the receipt. `segmentBase64` / `riderBase64` are
 * null when not offered. Never log the arguments.
 */
export function startTransfer(input: {
  manifest: string;
  planBase64: string;
  segmentBase64: string | null;
  riderBase64: string | null;
  advertiseMs: number;
}): void {
  if (native === null) throw new Error("Bluetooth sending is not available in this build");
  native.startTransfer(input.manifest, input.planBase64, input.segmentBase64, input.riderBase64, input.advertiseMs);
}

export function stopTransfer(): void {
  native?.stopTransfer();
}

export function addStateListener(listener: (event: BlePeripheralEvent) => void): { remove(): void } {
  if (native === null) return { remove() {} };
  return native.addListener("onStateChange", listener);
}
