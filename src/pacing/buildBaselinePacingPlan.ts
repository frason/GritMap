import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import { computeAnchorPowerWatts } from "./powerDurationAnchor.ts";
import { computeAdaptiveZoneGrades, computeZoneGrades } from "./computeZoneGrades.ts";
import { buildTargetPowerZones, type PacingClassification } from "./buildTargetPowerZones.ts";

const DEFAULT_MODEL_VERSION = "pacing-anchor-grade-v2";

/**
 * apps/karoo's PacingModels.kt enum has no "REST" value -- "REST" is this app's own
 * rider-facing vocabulary (and the Kotlin side's own UI already maps RECOVER -> "REST"
 * for display). Translate at this boundary only.
 */
const CLASSIFICATION_WIRE_VALUE: Record<PacingClassification, string> = {
  REST: "RECOVER",
  HOLD: "HOLD",
  PUSH: "PUSH",
};

export interface BuildBaselinePacingPlanInput {
  id: string;
  segmentFingerprint: string;
  referencePolyline: readonly SegmentReferencePoint[];
  ftpWatts: number;
  targetDurationMs: number;
  createdAtMs: number;
  modelVersion?: string;
  /** Pins a fixed zone length; omit to scale it with the segment (chooseZoneLengthMeters). */
  zoneLengthMeters?: number;
}

/**
 * Produces the exact JSON shape apps/karoo's TransferPackageParser.parseBaseline() /
 * AiPacingResponseParser.parseZone() expect (read directly from that Kotlin source, not
 * paraphrased).
 */
export function buildBaselinePacingPlan(input: BuildBaselinePacingPlanInput): object {
  const anchorPowerWatts = computeAnchorPowerWatts(input.ftpWatts, input.targetDurationMs);
  const zoneWindows =
    input.zoneLengthMeters === undefined
      ? computeAdaptiveZoneGrades(input.referencePolyline)
      : computeZoneGrades(input.referencePolyline, input.zoneLengthMeters);
  const zones = buildTargetPowerZones(zoneWindows, anchorPowerWatts, input.ftpWatts);

  return {
    schemaVersion: 1,
    id: input.id,
    segmentFingerprint: input.segmentFingerprint,
    createdAtMs: input.createdAtMs,
    generator: {
      type: "phone-ai",
      modelVersion: input.modelVersion ?? DEFAULT_MODEL_VERSION,
    },
    ftpWatts: Math.round(input.ftpWatts),
    targetFinishTimeSeconds: Math.round(input.targetDurationMs / 1000),
    zones: zones.map((zone) => ({
      startDistanceMeters: zone.startDistanceMeters,
      endDistanceMeters: zone.endDistanceMeters,
      targetPowerWatts: zone.targetPowerWatts,
      classification: CLASSIFICATION_WIRE_VALUE[zone.classification],
      icon: CLASSIFICATION_WIRE_VALUE[zone.classification],
      instruction: zone.instruction,
    })),
  };
}
