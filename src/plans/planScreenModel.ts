import type { ActiveGoal } from "../db/getActiveGoal.ts";
import { isSegmentPlanOutdated, type SavedSegmentPlan } from "../db/segmentPlans.ts";
import { summarizeCoachPlan } from "../pacing/coachPlan.ts";
import { generateRealisticPlan } from "../pacing/generateRealisticPlan.ts";
import { goalTimeRange, type GoalTimeRange } from "../pacing/goalTimeRange.ts";
import { predictPlanFinish, type CalibrationAttempt } from "../pacing/predictPlanFinish.ts";
import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import { describePlanFeasibility, type PlanFeasibilityLines } from "../screens/describePlanFeasibility.ts";
import { describePlanPrediction, type PlanPredictionLines } from "../screens/describePlanPrediction.ts";
import { describeStagedGoal, suggestNextGoalMs, type StagedGoalLines } from "../screens/describeStagedGoal.ts";
import { buildGoalStages, buildSectionRows, goalProgress, lastSentLabel, planSourceLabel, type GoalStage, type PlanSectionRow, type PlanZoneInput } from "./planView.ts";

export interface PlanScreenInput {
  referencePolyline: readonly SegmentReferencePoint[];
  ftpWatts?: number;
  weightKg?: number;
  /** The rider's active goal, which may be on a different segment. */
  activeGoal?: ActiveGoal;
  /** The name of the segment the active goal is on, when it is not this one. */
  otherGoalSegmentName?: string;
  /** An imported coach, AI or own plan; it wins over GritMap's own. */
  activePlan?: SavedSegmentPlan;
  /** The rider's past efforts on this segment, newest first: ceilings for the generated plan. */
  historyAttempts: readonly CalibrationAttempt[];
  /** The few most recent efforts, used to calibrate an imported plan's predicted finish. */
  predictionAttempts: readonly CalibrationAttempt[];
  /** The last time the phone sent this segment's plan to a Karoo, from its own send log. */
  lastSentAtMs?: number;
}

export interface PlanSummary {
  sectionCount: number;
  averageWatts: number;
  percentOfFtp: number;
  minWatts: number;
  maxWatts: number;
}

export interface PlanPrediction {
  durationMs: number;
  lines: PlanPredictionLines;
}

export interface PlanGoalView {
  nextMs: number;
  longTermMs?: number;
  bestMs?: number;
  stages: GoalStage[];
  /** 0 to 1: how close the best is to the next goal. Undefined without a best effort. */
  progress?: number;
  staged?: StagedGoalLines;
}

export type PlanScreenModel =
  /** No FTP saved: the plan cannot be built until the rider enters it. */
  | { kind: "needs-ftp" }
  /** An FTP but no goal on this segment: ask for one. */
  | { kind: "needs-goal"; otherGoal?: { name: string; durationMs: number }; goalRange?: GoalTimeRange; beatBestMs?: number; suggestedBeatBestMs?: number }
  | {
      kind: "plan";
      origin: "generated" | "imported";
      sourceLabel: string;
      zones: PlanZoneInput[];
      sections: PlanSectionRow[];
      summary: PlanSummary;
      goal?: PlanGoalView;
      prediction?: PlanPrediction;
      feasibility?: PlanFeasibilityLines;
      /** An imported plan written for a different FTP than the rider's now. Sending is blocked until it is replaced. */
      outdated?: { planFtpWatts: number; currentFtpWatts: number };
      notes?: string;
      /** Without a weight there is no predicted finish; the plan offers to ask for it. */
      needsWeight: boolean;
      lastSent?: string;
    };

const toZoneInputs = (zones: readonly PlanZoneInput[]): PlanZoneInput[] =>
  zones.map(({ startDistanceMeters, endDistanceMeters, targetPowerWatts, classification }) => ({ startDistanceMeters, endDistanceMeters, targetPowerWatts, classification }));

/**
 * Everything the Plan view shows, decided in one pure place from the segment, the rider's numbers,
 * their goal and any imported plan. It follows the same rules the segment screen and the Karoo send
 * use (an imported plan wins; otherwise GritMap's realistic plan for the goal), so what the rider
 * sees is what gets sent.
 */
export function buildPlanScreenModel(input: PlanScreenInput): PlanScreenModel {
  const { ftpWatts } = input;
  if (ftpWatts === undefined) return { kind: "needs-ftp" };

  const bestMs = input.historyAttempts.length === 0 ? undefined : Math.min(...input.historyAttempts.map((attempt) => attempt.durationMs));
  const lastSent = lastSentLabel(input.lastSentAtMs);
  return buildFor(input, ftpWatts, bestMs, lastSent);
}

function buildFor(input: PlanScreenInput, ftpWatts: number, bestMs: number | undefined, lastSent: string | undefined): PlanScreenModel {
  const goalHere = input.activeGoal !== undefined && input.otherGoalSegmentName === undefined ? input.activeGoal : undefined;
  const needsWeight = input.weightKg === undefined;

  if (input.activePlan !== undefined) {
    const plan = input.activePlan;
    const zones = toZoneInputs(plan.zones);
    const summary = summarizeCoachPlan(plan.zones, plan.ftpWatts);
    const predicted = needsWeight
      ? undefined
      : predictPlanFinish({ zones: plan.zones, referencePolyline: input.referencePolyline, riderWeightKg: input.weightKg!, attempts: input.predictionAttempts });
    return {
      kind: "plan",
      origin: "imported",
      sourceLabel: planSourceLabel({ origin: "imported", source: plan.source, ...(plan.authorLabel === undefined ? {} : { authorLabel: plan.authorLabel }) }),
      zones,
      sections: buildSectionRows(zones),
      summary: { sectionCount: summary.zoneCount, averageWatts: summary.averagePowerWatts, percentOfFtp: summary.percentOfFtp, minWatts: summary.minPowerWatts, maxWatts: summary.maxPowerWatts },
      ...(goalHere === undefined ? {} : { goal: goalView(goalHere, bestMs) }),
      ...(predicted === undefined
        ? {}
        : {
            prediction: {
              durationMs: predicted.durationMs,
              lines: describePlanPrediction({
                prediction: predicted,
                ...(goalHere === undefined ? {} : { goalDurationMs: goalHere.targetDurationMs }),
                ...(plan.targetFinishSeconds === undefined ? {} : { coachTargetSeconds: plan.targetFinishSeconds }),
              }),
            },
          }),
      ...(isSegmentPlanOutdated(plan, ftpWatts) ? { outdated: { planFtpWatts: plan.ftpWatts, currentFtpWatts: Math.round(ftpWatts) } } : {}),
      ...(plan.notes === undefined ? {} : { notes: plan.notes }),
      needsWeight,
      ...(lastSent === undefined ? {} : { lastSent }),
    };
  }

  if (goalHere === undefined) {
    const goalRange = needsWeight ? undefined : goalTimeRange({ referencePolyline: input.referencePolyline, ftpWatts, riderWeightKg: input.weightKg, attempts: input.historyAttempts });
    return {
      kind: "needs-goal",
      ...(input.activeGoal !== undefined && input.otherGoalSegmentName !== undefined ? { otherGoal: { name: input.otherGoalSegmentName, durationMs: input.activeGoal.targetDurationMs } } : {}),
      ...(goalRange === undefined ? {} : { goalRange }),
      ...(bestMs === undefined ? {} : { beatBestMs: bestMs, suggestedBeatBestMs: suggestNextGoalMs(bestMs) }),
    };
  }

  const generated = generateRealisticPlan({
    referencePolyline: input.referencePolyline,
    ftpWatts,
    goalDurationMs: goalHere.targetDurationMs,
    history: { attempts: input.historyAttempts, ...(input.weightKg === undefined ? {} : { riderWeightKg: input.weightKg }) },
  });
  const zones = toZoneInputs(generated.zones);
  const anchor = generated.anchorPowerWatts;
  const feasibility = describePlanFeasibility({
    realistic: generated.realistic,
    goalDurationMs: goalHere.targetDurationMs,
    ...(generated.finish === undefined ? {} : { predictedFinishMs: generated.finish.durationMs }),
    ...(bestMs === undefined ? {} : { bestEffortMs: bestMs }),
    hasHistory: generated.effortsWithPower > 0,
    goalBelowNormalEffort: generated.anchorLimited === "low" || (generated.anchorSource === "power-duration-table" && anchor <= ftpWatts * 0.7 + 0.5),
  });
  const averageWatts = Math.round(anchor);
  const watts = zones.map((zone) => zone.targetPowerWatts);
  return {
    kind: "plan",
    origin: "generated",
    sourceLabel: planSourceLabel({ origin: "generated" }),
    zones,
    sections: buildSectionRows(zones),
    summary: { sectionCount: zones.length, averageWatts, percentOfFtp: Math.round((anchor / ftpWatts) * 100), minWatts: Math.min(...watts), maxWatts: Math.max(...watts) },
    goal: goalView(goalHere, bestMs),
    ...(generated.finish === undefined
      ? {}
      : { prediction: { durationMs: generated.finish.durationMs, lines: describePlanPrediction({ prediction: generated.finish, goalDurationMs: goalHere.targetDurationMs }) } }),
    ...(feasibility === undefined ? {} : { feasibility }),
    needsWeight,
    ...(lastSent === undefined ? {} : { lastSent }),
  };
}

function goalView(goal: ActiveGoal, bestMs: number | undefined): PlanGoalView {
  const progress = goalProgress(bestMs, goal.targetDurationMs);
  const staged =
    goal.longTermDurationMs === undefined
      ? undefined
      : describeStagedGoal({ ...(bestMs === undefined ? {} : { bestMs }), nextGoalMs: goal.targetDurationMs, longTermMs: goal.longTermDurationMs });
  return {
    nextMs: goal.targetDurationMs,
    ...(goal.longTermDurationMs === undefined ? {} : { longTermMs: goal.longTermDurationMs }),
    ...(bestMs === undefined ? {} : { bestMs }),
    stages: buildGoalStages({ ...(bestMs === undefined ? {} : { bestMs }), nextGoalMs: goal.targetDurationMs, ...(goal.longTermDurationMs === undefined ? {} : { longTermMs: goal.longTermDurationMs }) }),
    ...(progress === undefined ? {} : { progress }),
    ...(staged === undefined ? {} : { staged }),
  };
}
