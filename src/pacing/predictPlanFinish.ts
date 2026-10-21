import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import { computePlanVsActual, type ActualTrackPoint } from "./computePlanVsActual.ts";
import {
  calibrationFactor,
  combineCalibrationFactors,
  MAX_CALIBRATION_FACTOR,
  MIN_CALIBRATION_FACTOR,
  predictFinishTime,
  type PredictionZone,
} from "./predictFinishTime.ts";

export interface CalibrationAttempt {
  /** The effort's own track, distance re-based to its start (getAttemptTrack). */
  track: readonly ActualTrackPoint[];
  durationMs: number;
  /** The rider's weight (kg) when that effort was ridden, if known; otherwise the current weight is used for it. */
  riderWeightKg?: number;
}

export interface ModelCalibration {
  /** Multiply the model's time by this to match how long the rider really takes. */
  factor: number;
  /** Spread of the efforts' individual factors, as % of the median. */
  spreadPct: number;
  attemptsUsed: number;
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

  const calibration = calibrateModel(input);
  if (calibration === undefined) {
    return { durationMs: base.durationMs, basis: "estimate", modelDurationMs: base.durationMs, attemptsUsed: 0 };
  }
  return {
    durationMs: Math.round(base.durationMs * calibration.factor),
    basis: "calibrated",
    modelDurationMs: base.durationMs,
    attemptsUsed: calibration.attemptsUsed,
    spreadPct: calibration.spreadPct,
  };
}

/**
 * How far the physics model is off for this rider: each past effort's real time against the model's time for the power
 * they actually held (their bike, position, conditions, and the weight they had that day when it is known), combined by
 * the median. Depends only on the zone boundaries, not on the targets, so one calibration serves every candidate plan.
 */
export function calibrateModel(input: {
  zones: readonly PredictionZone[];
  referencePolyline: readonly SegmentReferencePoint[];
  riderWeightKg: number;
  attempts?: readonly CalibrationAttempt[];
}): ModelCalibration | undefined {
  if (input.zones.length === 0) return undefined;
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
      { riderWeightKg: attempt.riderWeightKg ?? input.riderWeightKg },
    );
    const factor = ridden === undefined ? undefined : calibrationFactor(attempt.durationMs, ridden.durationMs);
    if (factor !== undefined) factors.push(factor);
  }

  const combined = combineCalibrationFactors(factors);
  if (combined === undefined) return undefined;
  return {
    factor: combined.factor,
    spreadPct: combined.spreadPct,
    attemptsUsed: factors.filter((value) => value >= MIN_CALIBRATION_FACTOR && value <= MAX_CALIBRATION_FACTOR).length,
  };
}
