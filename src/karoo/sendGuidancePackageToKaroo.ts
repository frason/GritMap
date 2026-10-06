import type { SegmentDetail } from "../db/getSegmentDetail.ts";
import { toPortableSegmentJson } from "../segments/toPortableSegmentJson.ts";
import { buildBaselinePacingPlan, toBaselinePlanWire } from "../pacing/buildBaselinePacingPlan.ts";
import type { SentBaselinePlan } from "../db/planSends.ts";
import type { SavedSegmentPlan } from "../db/segmentPlans.ts";
import { buildRiderHistoryPackage } from "../pacing/buildRiderHistoryPackage.ts";
import type { SendSegmentResult } from "./sendSegmentToKaroo.ts";
import { karooTransferEndpoint } from "./karooTransferEndpoint.ts";

export interface SendGuidanceResult extends SendSegmentResult {
  /** The exact baseline plan that was acknowledged by the Karoo's receiver; present only when `ok`. */
  baselinePlan?: SentBaselinePlan;
}

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
 *
 * When `importedPlan` (a rider/coach plan from coachPlan.ts, saved by segmentPlans.ts) is
 * given, it is sent instead of a generated one, as the same `baselinePacingPlan` shape. The
 * Karoo's wire format has no value for "written by a coach", so it goes out as
 * generator.type "manual" with the provenance (self / human-coach / ai-coach) in modelVersion;
 * see docs/COACH_PLAN_CONTRACT.md. A plan written against a different FTP than the rider's
 * current one is refused here -- the Karoo would reject the mismatch anyway, but only
 * asynchronously, after this POST already got its 200.
 */
export async function sendGuidancePackageToKaroo(
  segment: SegmentDetail,
  rider: GuidancePackageRiderInput,
  targetDurationMs: number | undefined,
  hostAndPort: string,
  packageId: string,
  nowMs: number,
  importedPlan?: SavedSegmentPlan,
): Promise<SendGuidanceResult> {
  let baselinePacingPlan: object;
  if (importedPlan !== undefined) {
    if (importedPlan.ftpWatts !== Math.round(rider.ftpWatts)) {
      return {
        ok: false,
        message: `This plan was written for an FTP of ${importedPlan.ftpWatts} W but yours is ${Math.round(rider.ftpWatts)} W. Import an updated plan first.`,
      };
    }
    baselinePacingPlan = toBaselinePlanWire({
      id: packageId,
      segmentFingerprint: segment.fingerprint,
      createdAtMs: nowMs,
      generator: { type: "manual", modelVersion: importedPlan.source },
      ftpWatts: importedPlan.ftpWatts,
      ...(importedPlan.targetFinishSeconds === undefined
        ? {}
        : { targetFinishTimeSeconds: importedPlan.targetFinishSeconds }),
      zones: importedPlan.zones,
    });
  } else if (targetDurationMs === undefined) {
    return { ok: false, message: "Set a goal time first." };
  } else {
    baselinePacingPlan = buildBaselinePacingPlan({
      id: packageId,
      segmentFingerprint: segment.fingerprint,
      referencePolyline: segment.referencePolyline,
      ftpWatts: rider.ftpWatts,
      targetDurationMs,
      createdAtMs: nowMs,
    });
  }

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
    baselinePacingPlan,
  };

  let endpoint: string;
  try {
    endpoint = karooTransferEndpoint(hostAndPort);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    });
    return {
      ok: response.ok,
      statusCode: response.status,
      ...(response.ok ? { baselinePlan: baselinePacingPlan as SentBaselinePlan } : {}),
    };
  } catch (error) {
    return { ok: false, unreachable: true, message: error instanceof Error ? error.message : String(error) };
  }
}
