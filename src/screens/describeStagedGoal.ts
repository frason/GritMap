import { formatDurationMinutesSeconds } from "./formatRideStats.ts";

/** A new next goal beats the rider's best by about this much. */
const BEAT_BEST_FRACTION = 0.01;
const ROUND_TO_MS = 5_000;

/** The next goal to suggest after a best effort: about 1% faster, rounded down to 5 seconds, and at least 5 seconds faster. */
export function suggestNextGoalMs(bestMs: number): number {
  const target = Math.floor((bestMs * (1 - BEAT_BEST_FRACTION)) / ROUND_TO_MS) * ROUND_TO_MS;
  return Math.max(ROUND_TO_MS, Math.min(target, bestMs - ROUND_TO_MS));
}

export interface StagedGoalLines {
  /** How far the best effort is from the long-term goal; absent without both a best effort and a long-term goal. */
  progress?: string;
  /** Said when the best effort has reached the next goal. */
  reached?: string;
  /** The next goal to offer one tap for after `reached`; absent when there is nothing sensible to offer. */
  suggestedNextGoalMs?: number;
}

/**
 * Plain wording for a staged goal: the next goal drives the plan; the long-term goal only gets a progress line and a note
 * when the next goal has been reached.
 */
export function describeStagedGoal(input: { bestMs?: number; nextGoalMs: number; longTermMs?: number }): StagedGoalLines {
  const { bestMs, nextGoalMs, longTermMs } = input;
  const lines: StagedGoalLines = {};
  if (bestMs === undefined) return lines;
  const best = formatDurationMinutesSeconds(bestMs);

  if (longTermMs !== undefined) {
    const longTerm = formatDurationMinutesSeconds(longTermMs);
    lines.progress =
      bestMs <= longTermMs
        ? `You have reached your long-term goal of ${longTerm}. Your best is ${best}.`
        : `${formatDurationMinutesSeconds(bestMs - longTermMs)} to go to your ${longTerm} goal. Your best is ${best}.`;
  }

  if (bestMs <= nextGoalMs) {
    lines.reached = `You reached your ${formatDurationMinutesSeconds(nextGoalMs)} goal with a ${best}.`;
    const suggestion = suggestNextGoalMs(bestMs);
    // Never offer a next goal that is faster than the long-term goal; offer the long-term goal itself when it is the next step.
    const next = longTermMs !== undefined && suggestion < longTermMs ? longTermMs : suggestion;
    if (next < bestMs && (longTermMs === undefined || bestMs > longTermMs)) lines.suggestedNextGoalMs = next;
  }
  return lines;
}
