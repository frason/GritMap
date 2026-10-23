import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import { buildTargetPowerZones } from "./buildTargetPowerZones.ts";
import { computeAdaptiveZoneGrades } from "./computeZoneGrades.ts";
import { predictFinishTime } from "./predictFinishTime.ts";
import { calibrateModel, type CalibrationAttempt } from "./predictPlanFinish.ts";
import { MIN_SOLVED_ANCHOR_PCT_FTP } from "./solveAnchorForGoal.ts";

export interface GoalTimeRange {
  /** About how long the segment takes at the rider's FTP (the model, corrected by their own efforts when they have some). */
  typicalMs: number;
  /** A goal slower than this asks for less than the plan model's normal range: the plan would be flat. */
  easiestMs: number;
}

/**
 * Sensible goal times for a segment and rider, from the same physics model the plan uses, so the goal editor can offer a
 * hint and warn about a goal that is too easy to make a useful plan. Undefined without weight or elevation.
 */
export function goalTimeRange(input: {
  referencePolyline: readonly SegmentReferencePoint[];
  ftpWatts: number;
  riderWeightKg: number | undefined;
  attempts?: readonly CalibrationAttempt[];
}): GoalTimeRange | undefined {
  if (input.riderWeightKg === undefined || !(input.ftpWatts > 0)) return undefined;
  const windows = computeAdaptiveZoneGrades(input.referencePolyline);
  if (windows.length === 0) return undefined;
  const finishAt = (anchor: number) =>
    predictFinishTime(buildTargetPowerZones(windows, anchor, input.ftpWatts), input.referencePolyline, { riderWeightKg: input.riderWeightKg! });
  const typical = finishAt(input.ftpWatts);
  const easiest = finishAt(input.ftpWatts * MIN_SOLVED_ANCHOR_PCT_FTP);
  if (typical === undefined || easiest === undefined || !typical.hasElevation) return undefined;
  const calibration = calibrateModel({
    zones: buildTargetPowerZones(windows, input.ftpWatts, input.ftpWatts),
    referencePolyline: input.referencePolyline,
    riderWeightKg: input.riderWeightKg,
    ...(input.attempts === undefined ? {} : { attempts: input.attempts.slice(0, 3) }),
  });
  const factor = calibration?.factor ?? 1;
  return { typicalMs: Math.round(typical.durationMs * factor), easiestMs: Math.round(easiest.durationMs * factor) };
}
