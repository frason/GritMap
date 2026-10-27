import { supportsReceiverFeature, type ReceiverCapabilities } from "../transfer/receiverCapabilities.ts";
import { DEFAULT_REALISTIC_PLAN_CONFIG } from "../pacing/realisticPlan.ts";
import type { SegmentDetail } from "../db/getSegmentDetail.ts";
import type { SavedSegmentPlan } from "../db/segmentPlans.ts";
import { buildBaselinePacingPlan, toBaselinePlanWire } from "../pacing/buildBaselinePacingPlan.ts";
import { generateRealisticPlan, type PlanHistoryInput } from "../pacing/generateRealisticPlan.ts";
import { toPortableSegmentJson } from "../segments/toPortableSegmentJson.ts";

export interface TransferRiderInput {
  ftpWatts: number;
}

/** Sent as `generator.modelVersion` for a plan that went through the realistic planner (ceilings, energy budget). */
export const REALISTIC_PLAN_MODEL_VERSION = "pacing-anchor-grade-realistic-v1";

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
  /**
   * The rider's past efforts on this segment. When given (even with no efforts), a generated plan is made
   * realistic: no target above what the rider has held, an energy-budget guard, trimmed effort moved to later
   * zones. Imported plans are never changed. Omit it to get the plain grade-shaped plan.
   */
  planHistory?: PlanHistoryInput | undefined;
  receiverCapabilities?: ReceiverCapabilities | undefined;
}): BaselinePlanResult {
  const { segment, rider, targetDurationMs, importedPlan, packageId, nowMs, planHistory } = input;
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
  if (planHistory !== undefined) {
    const generated = generateRealisticPlan({
      referencePolyline: segment.referencePolyline,
      ftpWatts: rider.ftpWatts,
      goalDurationMs: targetDurationMs,
      history: planHistory,
    });
    const baseline = toBaselinePlanWire({
      id: packageId, segmentFingerprint: segment.fingerprint, createdAtMs: nowMs,
      generator: { type: "phone-ai", modelVersion: REALISTIC_PLAN_MODEL_VERSION },
      ftpWatts: rider.ftpWatts, targetFinishTimeSeconds: Math.round(targetDurationMs / 1000), zones: generated.zones,
    }) as Record<string, unknown>;
    if (supportsReceiverFeature(input.receiverCapabilities, "planCeilingsV1")) {
      const c = DEFAULT_REALISTIC_PLAN_CONFIG;
      baseline.replan = { schemaVersion: 1, criticalPowerWatts: generated.realistic.assumptions.criticalPowerWatts,
        wPrimeJoules: generated.realistic.assumptions.wPrimeJoules,
        wPrimeReserveFraction: c.wPrimeReserveFraction, maxStepWatts: c.maxStepWatts,
        hardMaxStepWatts: c.hardMaxStepWatts, stepLimitMinGradePct: c.stepLimitMinGradePct };
      baseline.zones = (baseline.zones as Record<string, unknown>[]).map((zone, i) => ({
        ...zone, ceilingPowerWatts: generated.realistic.ceilings[i]!.ceilingWatts,
      }));
    }
    return { ok: true, baselinePacingPlan: baseline };
  }
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
