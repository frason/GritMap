export interface InsightEffort {
  attemptId: string;
  startTimestampMs: number;
  durationMs: number;
}

export interface SegmentInsight {
  attemptId: string;
  /** The latest counted effort's time. */
  durationMs: number;
  startTimestampMs: number;
  /** Short, factual lines, in order: against the goal, against the best, against the previous effort. */
  lines: string[];
}

/**
 * What the latest effort on a segment says, from the rider's own counted efforts and goal only. Each line appears only
 * when it can be worked out: no goal means no goal line, a first effort has nothing to be compared with.
 * Returns undefined when there are no counted efforts.
 */
export function segmentInsight(input: { efforts: readonly InsightEffort[]; goalMs?: number; format: (ms: number) => string }): SegmentInsight | undefined {
  const sorted = [...input.efforts].sort((a, b) => a.startTimestampMs - b.startTimestampMs);
  const latest = sorted.at(-1);
  if (latest === undefined) return undefined;
  const earlier = sorted.slice(0, -1);
  const lines: string[] = [];

  if (input.goalMs !== undefined) {
    const gap = latest.durationMs - input.goalMs;
    lines.push(gap <= 0 ? `${input.format(-gap)} under your goal` : `${input.format(gap)} over your goal`);
  }

  const bestBefore = earlier.length === 0 ? undefined : Math.min(...earlier.map((effort) => effort.durationMs));
  if (bestBefore !== undefined) {
    if (latest.durationMs < bestBefore) lines.push(`New personal best, ${input.format(bestBefore - latest.durationMs)} faster than before`);
    else if (latest.durationMs > bestBefore) lines.push(`${input.format(latest.durationMs - bestBefore)} off your best`);
    else lines.push("Matches your best");
  } else {
    lines.push("Your first effort here");
  }

  const previous = earlier.at(-1);
  if (previous !== undefined && previous.durationMs !== latest.durationMs && earlier.length >= 1) {
    const faster = latest.durationMs < previous.durationMs;
    // The best-line already says it when this is a new best; only add the trend when it adds something.
    if (!(faster && bestBefore !== undefined && latest.durationMs < bestBefore)) {
      lines.push(`${faster ? "Faster" : "Slower"} than your previous effort by ${input.format(Math.abs(latest.durationMs - previous.durationMs))}`);
    }
  }

  return { attemptId: latest.attemptId, durationMs: latest.durationMs, startTimestampMs: latest.startTimestampMs, lines };
}
