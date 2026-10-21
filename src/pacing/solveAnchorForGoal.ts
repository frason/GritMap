import { buildTargetPowerZones } from "./buildTargetPowerZones.ts";
import type { ZoneWindow } from "./computeZoneGrades.ts";
import { predictFinishTime } from "./predictFinishTime.ts";
import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";

/** The solved average power may not leave this band around FTP: below it the plan's own floor applies, above it no rider can be asked. */
export const MIN_SOLVED_ANCHOR_PCT_FTP = 0.7;
export const MAX_SOLVED_ANCHOR_PCT_FTP = 1.3;

export interface SolvedAnchor {
  /** The average power (W) the grade-shaped plan needs for the goal time. */
  anchorPowerWatts: number;
  /** Set when the goal needs more (`high`) or less (`low`) than the allowed band, so the anchor was held at its limit. */
  limited?: "low" | "high";
}

/**
 * The average power a plan needs so the rider finishes in `goalDurationMs`, found by running the physics model
 * (predictFinishTime) on the grade-shaped plan for different average powers and scaling by the rider's calibration
 * factor (their own past efforts). This replaces the power-duration table, which barely changes between a 30 and
 * a 60 minute goal. Undefined when the route has no elevation (the table is used then).
 */
export function solveAnchorForGoal(input: {
  windows: readonly ZoneWindow[];
  ftpWatts: number;
  goalDurationMs: number;
  referencePolyline: readonly SegmentReferencePoint[];
  riderWeightKg: number;
  /** actual time / model time for this rider (calibrateModel); 1 when they have no usable efforts. */
  calibrationFactor: number;
}): SolvedAnchor | undefined {
  const { windows, ftpWatts, goalDurationMs, referencePolyline, riderWeightKg, calibrationFactor } = input;
  if (windows.length === 0 || !(goalDurationMs > 0) || !(ftpWatts > 0)) return undefined;
  let hasElevation = true;
  const finishAt = (anchor: number): number => {
    const zones = buildTargetPowerZones(windows, anchor, ftpWatts);
    const prediction = predictFinishTime(zones, referencePolyline, { riderWeightKg });
    if (prediction === undefined || !prediction.hasElevation) {
      hasElevation = false;
      return Number.NaN;
    }
    return prediction.durationMs * calibrationFactor;
  };

  let low = ftpWatts * MIN_SOLVED_ANCHOR_PCT_FTP;
  let high = ftpWatts * MAX_SOLVED_ANCHOR_PCT_FTP;
  const slowest = finishAt(low);
  if (!hasElevation) return undefined;
  if (slowest <= goalDurationMs) return { anchorPowerWatts: low, limited: "low" };
  const fastest = finishAt(high);
  if (fastest > goalDurationMs) return { anchorPowerWatts: high, limited: "high" };
  // Finish time falls as power rises, so bisect for the power whose finish is the goal.
  for (let i = 0; i < 40 && high - low > 0.05; i += 1) {
    const middle = (low + high) / 2;
    if (finishAt(middle) > goalDurationMs) low = middle;
    else high = middle;
  }
  return { anchorPowerWatts: (low + high) / 2 };
}
