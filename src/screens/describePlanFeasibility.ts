import type { RealisticPlanResult } from "../pacing/realisticPlan.ts";
import { formatDurationMinutesSeconds } from "./formatRideStats.ts";
import { formatTimeDelta } from "./formatTimeDelta.ts";

/** A gap this small is not worth telling the rider about: 15 s or 2% of the goal, whichever is larger. */
const NEGLIGIBLE_GAP_MS = 15_000;
const NEGLIGIBLE_GAP_FRACTION = 0.02;

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
}): PlanFeasibilityLines | undefined {
  const { realistic, goalDurationMs, predictedFinishMs } = input;
  const goal = formatDurationMinutesSeconds(goalDurationMs);
  const gapMs = predictedFinishMs === undefined ? undefined : predictedFinishMs - goalDurationMs;
  const negligibleMs = Math.max(NEGLIGIBLE_GAP_MS, goalDurationMs * NEGLIGIBLE_GAP_FRACTION);
  // The power can add up and the goal still be out of reach: the time the plan produces for this rider is what counts.
  const tooSlow = gapMs !== undefined && gapMs > negligibleMs;
  if (!realistic.feasible || tooSlow) {
    const best =
      predictedFinishMs !== undefined && gapMs !== undefined && gapMs > NEGLIGIBLE_GAP_MS
        ? `The best plan GritMap can build finishes in about ${formatDurationMinutesSeconds(predictedFinishMs)}, ${formatTimeDelta(gapMs).slice(1)} slower than your goal.`
        : `The best plan averages about ${Math.round(realistic.achievedMeanWatts)} W, and your goal needs about ${Math.round(realistic.requiredMeanWatts)} W.`;
    return {
      tone: "warning",
      headline: `Your ${goal} goal looks out of reach for now.`,
      detail: `${best} GritMap never asks for more power than you have held on this climb, or more than your effort budget allows. It gets closer as you ride this segment.`,
    };
  }
  if (realistic.trimmedZoneIndices.length > 0) {
    return {
      tone: "info",
      headline: "Some targets were held back.",
      detail: `${realistic.trimmedZoneIndices.length === 1 ? "One section was" : `${realistic.trimmedZoneIndices.length} sections were`} kept within what you have held on this climb, and the easier sections after ${realistic.trimmedZoneIndices.length === 1 ? "it make" : "them make"} up the difference. Your ${goal} goal still holds.`,
    };
  }
  return undefined;
}
