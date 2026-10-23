import type { RealisticPlanResult } from "../pacing/realisticPlan.ts";
import { formatDurationMinutesSeconds } from "./formatRideStats.ts";
import { formatTimeDelta } from "./formatTimeDelta.ts";

/** A gap this small is not worth telling the rider about: 15 s or 2% of the goal, whichever is larger. */
const NEGLIGIBLE_GAP_MS = 15_000;
const NEGLIGIBLE_GAP_FRACTION = 0.02;
/** A plan must beat the rider's best by more than this for the wording to say so. */
const NEGLIGIBLE_BEST_MARGIN_MS = 5_000;

export interface PlanFeasibilityLines {
  tone: "info" | "warning";
  headline: string;
  detail: string;
}

/**
 * Plain-language wording for a generated plan that had to be trimmed (GOALS priority 8). Silent when the plan
 * already met the goal and nothing was cut. When the goal is out of reach it says what the best plan is and
 * how far short it falls, never promising the goal.
 */
export function describePlanFeasibility(input: {
  realistic: Pick<RealisticPlanResult, "feasible" | "requiredMeanWatts" | "achievedMeanWatts" | "trimmedZoneIndices">;
  goalDurationMs: number;
  /** The predicted finish of the plan that can be ridden (predictPlanFinish), when the rider's weight is known. */
  predictedFinishMs?: number;
  /** The rider's own fastest accepted effort on this segment, when they have one. */
  bestEffortMs?: number;
  /**
   * True when the plan's ceilings come from what the rider has actually held on this segment. Without it the wording must not
   * claim the rider "has held" anything: the plan then uses general limits.
   */
  hasHistory?: boolean;
  /** True when the goal is easier than the plan model's normal range, so the plan is flat (the 70%-of-FTP floor). */
  goalBelowNormalEffort?: boolean;
}): PlanFeasibilityLines | undefined {
  const { realistic, goalDurationMs, predictedFinishMs, bestEffortMs } = input;
  const hasHistory = input.hasHistory === true;
  if (input.goalBelowNormalEffort === true) {
    return {
      tone: "warning",
      headline: "This goal is easier than a normal effort, so the plan is flat.",
      detail: "Try a faster goal to get a plan that changes with the climb.",
    };
  }
  const goal = formatDurationMinutesSeconds(goalDurationMs);
  const gapMs = predictedFinishMs === undefined ? undefined : predictedFinishMs - goalDurationMs;
  const negligibleMs = Math.max(NEGLIGIBLE_GAP_MS, goalDurationMs * NEGLIGIBLE_GAP_FRACTION);
  // When a finish time can be predicted it decides: the power can add up and the goal still be out of reach, or the plan can
  // average less power than the goal's rule of thumb and still finish in time. Without a prediction, the power decides.
  const outOfReach = gapMs === undefined ? !realistic.feasible : gapMs > negligibleMs;
  if (outOfReach) {
    const best = bestEffortMs === undefined ? undefined : formatDurationMinutesSeconds(bestEffortMs);
    if (predictedFinishMs !== undefined && bestEffortMs !== undefined && predictedFinishMs < bestEffortMs - NEGLIGIBLE_BEST_MARGIN_MS) {
      return {
        tone: "info",
        headline: `Your ${goal} goal is a stretch for now, but your best is within reach.`,
        detail: `The best plan GritMap can build finishes in about ${formatDurationMinutesSeconds(predictedFinishMs)}, ${formatTimeDelta(bestEffortMs - predictedFinishMs).replace("-", "").replace("+", "")} faster than your best of ${best}. GritMap plans no more power than you have held on this climb, or than your effort budget allows. That grows as you set new bests.`,
      };
    }
    const sentence =
      predictedFinishMs !== undefined && gapMs !== undefined && gapMs > NEGLIGIBLE_GAP_MS
        ? `The best plan GritMap can build finishes in about ${formatDurationMinutesSeconds(predictedFinishMs)}, ${formatTimeDelta(gapMs).slice(1)} slower than your goal.`
        : `The best plan averages about ${Math.round(realistic.achievedMeanWatts)} W, and your goal needs about ${Math.round(realistic.requiredMeanWatts)} W.`;
    return {
      tone: "warning",
      headline: `Your ${goal} goal looks out of reach for now.`,
      detail: `${sentence}${best === undefined ? "" : ` Your best so far is ${best}.`} ${
        hasHistory
          ? "GritMap plans no more power than you have held on this climb, or than your effort budget allows. That grows as you set new bests."
          : "GritMap will tighten this plan once you have ridden the segment."
      }`,
    };
  }
  // "Held back" is only true when the limits come from the rider's own efforts; with no history say nothing.
  if (hasHistory && realistic.trimmedZoneIndices.length > 0) {
    return {
      tone: "info",
      headline: "Some targets were held back.",
      detail: `${realistic.trimmedZoneIndices.length === 1 ? "One section was" : `${realistic.trimmedZoneIndices.length} sections were`} kept within what you have held on this climb, and the easier sections after ${realistic.trimmedZoneIndices.length === 1 ? "it make" : "them make"} up the difference. Your ${goal} goal still holds. GritMap plans no more power than you have held on this climb; it grows as you set new bests.`,
    };
  }
  return undefined;
}
