export interface ResultsAttempt {
  attemptId: string;
  startTimestampMs: number;
  durationMs: number;
}

export interface ResultsPoint extends ResultsAttempt {
  /** 0 (earliest effort) to 1 (latest); 0.5 when there is only one date. */
  x: number;
  /** 0 (fastest) to 1 (slowest); 0.5 when every time is the same. */
  y: number;
  /** 1 for the fastest effort, 2 for the next, and so on. */
  rank: number;
  isBest: boolean;
}

/**
 * Places the rider's counted efforts for the "Your Results" chart: time on one axis, duration on the other,
 * faster higher up. Nothing here is invented: positions come straight from the stored times, and ranks from
 * sorting them.
 */
export function resultsPoints(attempts: readonly ResultsAttempt[]): ResultsPoint[] {
  if (attempts.length === 0) return [];
  const starts = attempts.map((attempt) => attempt.startTimestampMs);
  const durations = attempts.map((attempt) => attempt.durationMs);
  const minStart = Math.min(...starts);
  const maxStart = Math.max(...starts);
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const byDuration = [...attempts].sort((a, b) => a.durationMs - b.durationMs || a.startTimestampMs - b.startTimestampMs);
  const rankOf = new Map(byDuration.map((attempt, index) => [attempt.attemptId, index + 1]));
  return [...attempts]
    .sort((a, b) => a.startTimestampMs - b.startTimestampMs)
    .map((attempt) => ({
      ...attempt,
      x: maxStart === minStart ? 0.5 : (attempt.startTimestampMs - minStart) / (maxStart - minStart),
      y: maxDuration === minDuration ? 0.5 : (attempt.durationMs - minDuration) / (maxDuration - minDuration),
      rank: rankOf.get(attempt.attemptId)!,
      isBest: rankOf.get(attempt.attemptId) === 1,
    }));
}

/** How this effort compares with the rider's best: "Best", or "+0:42 off your best". Undefined when there is no best. */
export function gapToBestLabel(durationMs: number, bestMs: number | undefined, format: (ms: number) => string): string | undefined {
  if (bestMs === undefined) return undefined;
  if (durationMs <= bestMs) return "Best";
  return `+${format(durationMs - bestMs)} off your best`;
}

export interface AxisTick {
  /** Same scale as ResultsPoint.y: 0 is the top (fastest), 1 the bottom (slowest). */
  y: number;
  durationMs: number;
}

/**
 * The time labels that ground the results chart: fastest at the top, slowest at the bottom, halfway between in the
 * middle. When every effort has the same time there is only one value to show, at the middle.
 */
export function axisTicks(points: readonly ResultsPoint[]): AxisTick[] {
  if (points.length === 0) return [];
  const durations = points.map((point) => point.durationMs);
  const fastest = Math.min(...durations);
  const slowest = Math.max(...durations);
  if (fastest === slowest) return [{ y: 0.5, durationMs: fastest }];
  return [
    { y: 0, durationMs: fastest },
    { y: 0.5, durationMs: (fastest + slowest) / 2 },
    { y: 1, durationMs: slowest },
  ];
}
