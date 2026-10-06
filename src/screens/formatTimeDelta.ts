/**
 * A time difference for comparison UIs. Positive means slower / behind, negative faster / ahead.
 * Rounds to whole seconds ("+0:12", "-1:05"); under half a second reads as "even".
 */
export function formatTimeDelta(deltaMs: number): string {
  const totalSeconds = Math.round(Math.abs(deltaMs) / 1_000);
  if (totalSeconds === 0) return "even";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${deltaMs < 0 ? "-" : "+"}${minutes}:${String(seconds).padStart(2, "0")}`;
}
