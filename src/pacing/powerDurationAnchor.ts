export interface DurationAnchorPoint {
  durationMinutes: number;
  pctFtp: number;
}

/**
 * The standard Coggan/Allen power-duration shape (Training and Racing with a Power
 * Meter): FTP is defined as roughly the 60-minute sustainable power, so shorter efforts
 * are ridden above 100% of it and longer ones below.
 */
export const POWER_DURATION_ANCHORS: readonly DurationAnchorPoint[] = [
  { durationMinutes: 5, pctFtp: 1.2 },
  { durationMinutes: 10, pctFtp: 1.1 },
  { durationMinutes: 20, pctFtp: 1.05 },
  { durationMinutes: 30, pctFtp: 1.02 },
  { durationMinutes: 60, pctFtp: 1.0 },
  { durationMinutes: 90, pctFtp: 0.97 },
  { durationMinutes: 120, pctFtp: 0.95 },
  { durationMinutes: 180, pctFtp: 0.9 },
  { durationMinutes: 240, pctFtp: 0.85 },
];

const MIN_DURATION_MINUTES = POWER_DURATION_ANCHORS[0]!.durationMinutes;
const MAX_DURATION_MINUTES = POWER_DURATION_ANCHORS[POWER_DURATION_ANCHORS.length - 1]!.durationMinutes;

/**
 * Interpolates %FTP for a goal duration, piecewise-linear in log(durationMinutes) --
 * mean-maximal-power curves decay roughly log-linearly with duration, so this fits the
 * standard anchor points far better than linear-by-minutes would. Clamped (no
 * extrapolation) outside the table's 5-240 minute range.
 */
export function pctFtpForDuration(durationMinutes: number): number {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new RangeError(`durationMinutes must be positive and finite, got ${durationMinutes}`);
  }
  if (durationMinutes <= MIN_DURATION_MINUTES) return POWER_DURATION_ANCHORS[0]!.pctFtp;
  if (durationMinutes >= MAX_DURATION_MINUTES) {
    return POWER_DURATION_ANCHORS[POWER_DURATION_ANCHORS.length - 1]!.pctFtp;
  }

  const logDuration = Math.log(durationMinutes);
  for (let i = 0; i < POWER_DURATION_ANCHORS.length - 1; i += 1) {
    const lower = POWER_DURATION_ANCHORS[i]!;
    const upper = POWER_DURATION_ANCHORS[i + 1]!;
    if (durationMinutes >= lower.durationMinutes && durationMinutes <= upper.durationMinutes) {
      const t =
        (logDuration - Math.log(lower.durationMinutes)) /
        (Math.log(upper.durationMinutes) - Math.log(lower.durationMinutes));
      return lower.pctFtp + t * (upper.pctFtp - lower.pctFtp);
    }
  }
  // Unreachable given the clamps above, but keeps the function total for the type checker.
  return POWER_DURATION_ANCHORS[POWER_DURATION_ANCHORS.length - 1]!.pctFtp;
}

/**
 * Average target watts for the whole segment: FTP scaled by where the goal duration sits
 * on the standard power-duration curve. This is deliberately a lookup, not a physics
 * simulation -- no rider weight, drag, or rolling-resistance data is used, since none of
 * it is tracked anywhere in this app.
 */
export function computeAnchorPowerWatts(ftpWatts: number, targetDurationMs: number): number {
  if (!Number.isFinite(ftpWatts) || ftpWatts <= 0) {
    throw new RangeError(`ftpWatts must be positive and finite, got ${ftpWatts}`);
  }
  if (!Number.isFinite(targetDurationMs) || targetDurationMs <= 0) {
    throw new RangeError(`targetDurationMs must be positive and finite, got ${targetDurationMs}`);
  }
  return ftpWatts * pctFtpForDuration(targetDurationMs / 60_000);
}
