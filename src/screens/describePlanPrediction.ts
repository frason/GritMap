import type { PlanFinishPrediction } from "../pacing/predictPlanFinish.ts";
import { formatDurationMinutesSeconds } from "./formatRideStats.ts";
import { formatTimeDelta } from "./formatTimeDelta.ts";

/** Within this of the goal reads as "right on" rather than a miss. */
const ON_GOAL_TOLERANCE_MS = 15_000;

export interface PlanPredictionLines {
  /** The headline: the time the plan should produce. */
  headline: string;
  /** Where the number comes from, so a rider can judge how far to trust it. */
  basis: string;
  /** How it compares with the rider's goal for this segment, when they have one. */
  goal?: string;
  /** The coach's own stated target, when the plan had one. */
  coachTarget?: string;
}

export function describePlanPrediction(input: {
  prediction: PlanFinishPrediction;
  /** The active goal's time, only when that goal is for this segment. */
  goalDurationMs?: number;
  coachTargetSeconds?: number;
}): PlanPredictionLines {
  const { prediction } = input;
  const lines: PlanPredictionLines = {
    headline: `Predicted finish about ${formatDurationMinutesSeconds(prediction.durationMs)}`,
    basis:
      prediction.basis === "calibrated"
        ? `Calibrated to your last ${prediction.attemptsUsed} effort${prediction.attemptsUsed === 1 ? "" : "s"} on this segment.`
        : "An estimate from your weight and the route; it sharpens once you have ridden this segment.",
  };
  if (input.goalDurationMs !== undefined) {
    const gapMs = prediction.durationMs - input.goalDurationMs;
    lines.goal =
      Math.abs(gapMs) <= ON_GOAL_TOLERANCE_MS
        ? `Right on your ${formatDurationMinutesSeconds(input.goalDurationMs)} goal.`
        : `Your goal is ${formatDurationMinutesSeconds(input.goalDurationMs)}: this plan is predicted ${formatTimeDelta(Math.abs(gapMs)).slice(1)} ${gapMs > 0 ? "slower" : "faster"}.`;
  }
  if (input.coachTargetSeconds !== undefined) {
    lines.coachTarget = `The plan's own target is ${formatDurationMinutesSeconds(input.coachTargetSeconds * 1_000)}.`;
  }
  return lines;
}
