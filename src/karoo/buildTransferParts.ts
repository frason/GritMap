import type { SegmentDetail } from "../db/getSegmentDetail.ts";
import type { SavedSegmentPlan } from "../db/segmentPlans.ts";
import { buildBaselinePacingPlan, toBaselinePlanWire } from "../pacing/buildBaselinePacingPlan.ts";
import { toPortableSegmentJson } from "../segments/toPortableSegmentJson.ts";

export interface TransferRiderInput {
  ftpWatts: number;
}

export type BaselinePlanResult = { ok: true; baselinePacingPlan: object } | { ok: false; message: string };

/**
 * The segment object the Karoo receives, shared by the Wi-Fi send and the Bluetooth capsule so both
 * paths carry byte-for-byte the same portable segment JSON.
 */
export function buildTransferSegmentJson(segment: SegmentDetail): object {
  return toPortableSegmentJson({
    id: segment.segmentId,
    name: segment.name,
    schemaVersion: segment.schemaVersion,
    corridorMeters: segment.corridorMeters,
    requiredCoveragePct: segment.requiredCoveragePct,
    fingerprint: segment.fingerprint,
    referencePolyline: segment.referencePolyline,
  });
}

/**
 * The `baselinePacingPlan` the Karoo receives: an imported rider/coach plan when one is given
 * (refused if it was written for a different FTP than the rider's current one, which the Karoo would
 * reject asynchronously), otherwise GritMap's generated plan for the goal time. Shared by the Wi-Fi
 * send and the Bluetooth capsule so both carry the same plan.
 */
export function buildTransferBaselinePlan(input: {
  segment: SegmentDetail;
  rider: TransferRiderInput;
  targetDurationMs: number | undefined;
  importedPlan?: SavedSegmentPlan | undefined;
  packageId: string;
  nowMs: number;
}): BaselinePlanResult {
  const { segment, rider, targetDurationMs, importedPlan, packageId, nowMs } = input;
  if (importedPlan !== undefined) {
    if (importedPlan.ftpWatts !== Math.round(rider.ftpWatts)) {
      return {
        ok: false,
        message: `This plan was written for an FTP of ${importedPlan.ftpWatts} W but yours is ${Math.round(rider.ftpWatts)} W. Import an updated plan first.`,
      };
    }
    return {
      ok: true,
      baselinePacingPlan: toBaselinePlanWire({
        id: packageId,
        segmentFingerprint: segment.fingerprint,
        createdAtMs: nowMs,
        generator: { type: "manual", modelVersion: importedPlan.source },
        ftpWatts: importedPlan.ftpWatts,
        ...(importedPlan.targetFinishSeconds === undefined ? {} : { targetFinishTimeSeconds: importedPlan.targetFinishSeconds }),
        zones: importedPlan.zones,
      }),
    };
  }
  if (targetDurationMs === undefined) return { ok: false, message: "Set a goal time first." };
  return {
    ok: true,
    baselinePacingPlan: buildBaselinePacingPlan({
      id: packageId,
      segmentFingerprint: segment.fingerprint,
      referencePolyline: segment.referencePolyline,
      ftpWatts: rider.ftpWatts,
      targetDurationMs,
      createdAtMs: nowMs,
    }),
  };
}
