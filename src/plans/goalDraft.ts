import { parseTargetDurationInput } from "../screens/parseTargetDuration.ts";

export interface GoalDraftInput {
  minutes: string;
  seconds: string;
  longTermMinutes: string;
  longTermSeconds: string;
  /** The rider tapped "Remove long-term goal" and left both long-term boxes empty. */
  removeLongTerm: boolean;
}

export type GoalDraftResult =
  | { ok: true; targetDurationMs: number; longTermDurationMs?: number | null }
  | { ok: false; message: string };

/** Checks the goal editor's boxes the same way the segment screen does, and says what to fix in plain words. */
export function validateGoalDraft(input: GoalDraftInput): GoalDraftResult {
  const targetDurationMs = parseTargetDurationInput(input.minutes, input.seconds);
  if (targetDurationMs === undefined) return { ok: false, message: "Enter a target time, for example 40 minutes and 0 seconds." };
  const longTermTyped = input.longTermMinutes.trim().length > 0 || input.longTermSeconds.trim().length > 0;
  const longTermDurationMs = longTermTyped ? parseTargetDurationInput(input.longTermMinutes, input.longTermSeconds) : undefined;
  if (longTermTyped && longTermDurationMs === undefined) return { ok: false, message: "Enter your long-term goal as minutes and seconds, or clear both boxes." };
  if (longTermDurationMs !== undefined && longTermDurationMs >= targetDurationMs) {
    return { ok: false, message: "Your long-term goal should be faster than the goal you are working towards now." };
  }
  if (longTermDurationMs !== undefined) return { ok: true, targetDurationMs, longTermDurationMs };
  return input.removeLongTerm ? { ok: true, targetDurationMs, longTermDurationMs: null } : { ok: true, targetDurationMs };
}

/** Splits a duration into the two boxes' text. */
export function durationToInputs(durationMs: number): { minutes: string; seconds: string } {
  return { minutes: String(Math.floor(durationMs / 60_000)), seconds: String(Math.round((durationMs % 60_000) / 1_000)) };
}
