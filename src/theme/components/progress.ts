/** A progress value is a fraction from 0 to 1; anything else (NaN, negative, over 1) is pulled into range. */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** The whole-percent value VoiceOver reads for a progress bar ("78 percent"). */
export function progressAccessibilityValue(value: number): { min: number; max: number; now: number } {
  return { min: 0, max: 100, now: Math.round(clampProgress(value) * 100) };
}
