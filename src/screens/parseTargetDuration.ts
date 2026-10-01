/**
 * Parses a minutes/seconds pair (as typed into two separate text inputs) into a positive
 * duration in milliseconds, or undefined for anything invalid -- non-numeric, negative,
 * seconds >= 60, or a total of zero. Shared by every goal-time input in the app (currently
 * HomeScreen's GoalSetupForm and SegmentDetailScreen's inline goal editor) so this
 * validation rule can't drift between them.
 */
export function parseTargetDurationInput(minutesInput: string, secondsInput: string): number | undefined {
  const minutes = Number(minutesInput);
  const seconds = Number(secondsInput || "0");
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
    return undefined;
  }
  const targetDurationMs = (minutes * 60 + seconds) * 1_000;
  return targetDurationMs > 0 ? targetDurationMs : undefined;
}
