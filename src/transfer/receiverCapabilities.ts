/** Optional receiver handshake. Absence, errors or malformed data always mean baseline-only. */
export interface ReceiverCapabilities {
  v: 1; transferV: 2; versionCode: number; features: string[];
  maxManifestBytes: number; maxRecordBytes: number;
}
export const RECEIVER_CAPABILITIES_UUID = "9aa66e90-1c9e-46e1-9e52-45fd6a40847a";
export function parseReceiverCapabilities(input: unknown): ReceiverCapabilities | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  const o = input as Record<string, unknown>;
  const keys = ["v", "transferV", "versionCode", "features", "maxManifestBytes", "maxRecordBytes"];
  if (Object.keys(o).length !== keys.length || !keys.every(k => k in o)) return undefined;
  if (JSON.stringify(o).length > 512 || o.v !== 1 || o.transferV !== 2 ||
      !Number.isSafeInteger(o.versionCode) || (o.versionCode as number) <= 0 ||
      !Array.isArray(o.features) || o.features.length > 16 ||
      new Set(o.features).size !== o.features.length ||
      !o.features.every(x => typeof x === "string" && /^[A-Za-z0-9]{1,40}$/.test(x)) ||
      !Number.isSafeInteger(o.maxManifestBytes) || (o.maxManifestBytes as number) < 512 ||
      (o.maxManifestBytes as number) > 512 || !Number.isSafeInteger(o.maxRecordBytes) ||
      (o.maxRecordBytes as number) < 0 || (o.maxRecordBytes as number) > 8192) return undefined;
  if (o.features.includes("segmentRecordV1") && (o.maxRecordBytes as number) < 1) return undefined;
  return o as unknown as ReceiverCapabilities;
}
export function supportsReceiverFeature(input: unknown, feature: "planCeilingsV1" | "segmentRecordV1"): boolean {
  return parseReceiverCapabilities(input)?.features.includes(feature) === true;
}
/** Pure gate shared by future BLE negotiation and the Wi-Fi path; never adds invented data. */
export function gateTransferExtensions(input: Record<string, unknown>, capabilities: unknown): Record<string, unknown> {
  const output = { ...input };
  const parsed = parseReceiverCapabilities(capabilities);
  if (!supportsReceiverFeature(parsed, "segmentRecordV1")) delete output.segmentRecord;
  else if (output.segmentRecord !== undefined) {
    try {
      if (new TextEncoder().encode(JSON.stringify(output.segmentRecord)).length > parsed!.maxRecordBytes) delete output.segmentRecord;
    } catch { delete output.segmentRecord; }
  }
  if (typeof input.baselinePacingPlan === "object" && input.baselinePacingPlan !== null &&
      !supportsReceiverFeature(capabilities, "planCeilingsV1")) {
    const plan = { ...(input.baselinePacingPlan as Record<string, unknown>) };
    delete plan.replan;
    if (Array.isArray(plan.zones)) plan.zones = plan.zones.map(z => {
      const zone = { ...z }; delete zone.ceilingPowerWatts; return zone;
    });
    output.baselinePacingPlan = plan;
  }
  return output;
}
