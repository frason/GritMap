import type { GetAttemptDetailDatabase } from "../db/getAttemptDetail.ts";
import type { GetAttemptTrackDatabase } from "../db/getAttemptTrack.ts";
import type { ListAttemptsForSegmentDatabase } from "../db/listAttemptsForSegment.ts";
import { createWeightAt, type ProfileHistoryReadDatabase } from "../db/profileHistory.ts";
import { loadCalibrationAttempts } from "./loadCalibrationAttempts.ts";
import type { PlanHistoryInput } from "./generateRealisticPlan.ts";

/** How many of the rider's most recent accepted efforts feed a plan's ceilings. */
export const PLAN_HISTORY_EFFORTS = 12;

/** The rider's past efforts on a segment, ready for generateRealisticPlan. */
export function loadPlanHistory(
  database: GetAttemptDetailDatabase & GetAttemptTrackDatabase & ListAttemptsForSegmentDatabase & ProfileHistoryReadDatabase,
  segmentId: string,
  riderWeightKg?: number,
): PlanHistoryInput {
  return {
    // Each effort is calibrated at the weight the rider had that day, when the profile history knows it.
    attempts: loadCalibrationAttempts(database, segmentId, PLAN_HISTORY_EFFORTS, createWeightAt(database)),
    ...(riderWeightKg === undefined ? {} : { riderWeightKg }),
  };
}
