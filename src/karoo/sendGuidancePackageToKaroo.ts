import type { SegmentDetail } from "../db/getSegmentDetail.ts";
import { toPortableSegmentJson } from "../segments/toPortableSegmentJson.ts";
import { buildBaselinePacingPlan } from "../pacing/buildBaselinePacingPlan.ts";
import { buildRiderHistoryPackage } from "../pacing/buildRiderHistoryPackage.ts";
import type { SendSegmentResult } from "./sendSegmentToKaroo.ts";

export interface GuidancePackageRiderInput {
  ftpWatts: number;
  weightKg: number;
  maxHeartRateBpm?: number;
}

/**
 * Posts a segment, a generated pacing plan, and the rider profile it was generated for to
 * the Karoo's local HTTP receiver -- same endpoint and transport as sendSegmentToKaroo.ts
 * (SegmentInboxProcessor.processAll() dispatches on packageType itself, so no new
 * Karoo-side endpoint is needed).
 *
 * The rider profile is included because TransferPackage.kt requires one already installed
 * on the Karoo with a matching ftpWatts before it will accept a baseline plan at all, and
 * there's no Karoo-side screen to enter one locally -- this transfer is the only path. That
 * rejection happens async, after this app's HTTP POST already got a 200, so a successful
 * response here means "received," never "imported."
 */
export async function sendGuidancePackageToKaroo(
  segment: SegmentDetail,
  rider: GuidancePackageRiderInput,
  targetDurationMs: number,
  hostAndPort: string,
  packageId: string,
  nowMs: number,
): Promise<SendSegmentResult> {
  const json = {
    schemaVersion: 1,
    packageType: "gritmap-transfer",
    packageId,
    createdAtMs: nowMs,
    segment: toPortableSegmentJson({
      id: segment.segmentId,
      name: segment.name,
      schemaVersion: segment.schemaVersion,
      corridorMeters: segment.corridorMeters,
      requiredCoveragePct: segment.requiredCoveragePct,
      fingerprint: segment.fingerprint,
      referencePolyline: segment.referencePolyline,
    }),
    riderHistory: buildRiderHistoryPackage({
      ftpWatts: rider.ftpWatts,
      weightKg: rider.weightKg,
      ...(rider.maxHeartRateBpm === undefined ? {} : { maxHeartRateBpm: rider.maxHeartRateBpm }),
    }),
    baselinePacingPlan: buildBaselinePacingPlan({
      id: packageId,
      segmentFingerprint: segment.fingerprint,
      referencePolyline: segment.referencePolyline,
      ftpWatts: rider.ftpWatts,
      targetDurationMs,
      createdAtMs: nowMs,
    }),
  };

  try {
    const response = await fetch(`http://${hostAndPort}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    });
    return { ok: response.ok, statusCode: response.status };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
