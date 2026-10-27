import { getSegmentGoal } from "../db/getActiveGoal";
import { getAthleteProfile } from "../db/getAthleteProfile";
import type { SegmentDetail } from "../db/getSegmentDetail";
import { getPlanSentBefore } from "../db/planSends";
import { createWeightAt } from "../db/profileHistory";
import { getActiveSegmentPlan } from "../db/segmentPlans";
import type { SyncDatabase } from "../db/types";
import { loadCalibrationAttempts } from "../pacing/loadCalibrationAttempts";
import { PLAN_HISTORY_EFFORTS } from "../pacing/loadPlanHistory";
import type { PlanScreenInput } from "./planScreenModel";

/** Reads what the Plan view needs from the database; the rules for what to show are in buildPlanScreenModel. */
export function loadPlanInput(database: SyncDatabase, segment: SegmentDetail): PlanScreenInput {
  const profile = getAthleteProfile(database);
  const activeGoal = getSegmentGoal(database, segment.segmentId);
  const activePlan = getActiveSegmentPlan(database, segment.segmentId);
  const weightAt = createWeightAt(database);
  const lastSentAtMs = activePlan?.lastSentAtMs ?? getPlanSentBefore(database, segment.segmentId, Date.now())?.sentAtMs;
  return {
    referencePolyline: segment.referencePolyline,
    ...(profile.ftpWatts === undefined ? {} : { ftpWatts: profile.ftpWatts }),
    ...(profile.weightKg === undefined ? {} : { weightKg: profile.weightKg }),
    ...(activeGoal === undefined ? {} : { activeGoal }),
    ...(activePlan === undefined ? {} : { activePlan }),
    historyAttempts: loadCalibrationAttempts(database, segment.segmentId, PLAN_HISTORY_EFFORTS, weightAt),
    predictionAttempts: loadCalibrationAttempts(database, segment.segmentId, 3, weightAt),
    ...(lastSentAtMs === undefined ? {} : { lastSentAtMs }),
  };
}
