import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import { computePlanVsActual, type ActualTrackPoint } from "./computePlanVsActual.ts";
import {
  calibrationFactor,
  combineCalibrationFactors,
  predictFinishTime,
  type PredictionZone,
} from "./predictFinishTime.ts";

export interface CalibrationAttempt {
  /** The effort's own track, distance re-based to its start (getAttemptTrack). */
  track: readonly ActualTrackPoint[];
  durationMs: number;
}

export interface PlanFinishPrediction {
  /** The prediction to show: calibrated when the rider has usable past efforts, else the model's own. */
  durationMs: number;
  basis: "estimate" | "calibrated";
  /** The uncalibrated model result (what `basis: "estimate"` reports). */
  modelDurationMs: number;
  attemptsUsed: number;
  /** Spread of the efforts' individual factors, as % of the median; absent unless calibrated. */
  spreadPct?: number;
}

/** A past effort is only trusted for calibration when most of its zones have power readings. */
const MIN_ZONE_POWER_COVERAGE = 0.9;

/**
 * The finish time a plan should produce for this rider on this route. The physics model
 * (predictFinishTime.ts) gives the shape; each of the rider's own past efforts on the segment
 * then corrects its scale: the model is run on the power they actually held, and the ratio of
 * their real time to that is the factor (their bike, position, conditions). Without a usable
 * effort the prediction falls back to the model alone and says so.
 */
export function predictPlanFinish(input: {
  zones: readonly PredictionZone[];
  referencePolyline: readonly SegmentReferencePoint[];
  riderWeightKg: number;
  attempts?: readonly CalibrationAttempt[];
}): PlanFinishPrediction | undefined {
  const model = { riderWeightKg: input.riderWeightKg };
  const base = predictFinishTime(input.zones, input.referencePolyline, model);
  if (base === undefined || !base.hasElevation) return undefined;

  const segmentLengthMeters = input.zones[input.zones.length - 1]!.endDistanceMeters;
  const factors: number[] = [];
  for (const attempt of input.attempts ?? []) {
    const { zones: results } = computePlanVsActual({
      track: attempt.track,
      zones: input.zones,
      segmentLengthMeters,
    });
    const withPower = results.filter((zone) => zone.actualPowerWatts !== null).length;
    if (results.length === 0 || withPower / results.length < MIN_ZONE_POWER_COVERAGE) continue;
    const ridden = predictFinishTime(
      results.map((zone) => ({
        startDistanceMeters: zone.startDistanceMeters,
        endDistanceMeters: zone.endDistanceMeters,
        targetPowerWatts: zone.actualPowerWatts ?? zone.targetPowerWatts,
      })),
      input.referencePolyline,
      model,
    );
    const factor = ridden === undefined ? undefined : calibrationFactor(attempt.durationMs, ridden.durationMs);
    if (factor !== undefined) factors.push(factor);
  }

  const combined = combineCalibrationFactors(factors);
  if (combined === undefined) {
    return { durationMs: base.durationMs, basis: "estimate", modelDurationMs: base.durationMs, attemptsUsed: 0 };
  }
  return {
    durationMs: Math.round(base.durationMs * combined.factor),
    basis: "calibrated",
    modelDurationMs: base.durationMs,
    attemptsUsed: factors.filter((value) => value >= 0.8 && value <= 1.3).length,
    spreadPct: combined.spreadPct,
  };
}
