import { formatShortDate } from "./planView.ts";

export interface KarooMark {
  label: string;
  /** "success": the Karoo has the current plan as far as this phone knows. "warning": it is older than the plan here. */
  tone: "success" | "warning";
}

/**
 * The mark on a segment: what this phone knows about the Karoo's copy, from its own send log. It never claims
 * "On Karoo" because the phone cannot see the Karoo. A send built for a different FTP than the rider's now is
 * called out as an older plan.
 */
export function karooMark(input: { lastSentAtMs?: number; sentFtpWatts?: number; currentFtpWatts?: number; planChangedAtMs?: number }): KarooMark | undefined {
  if (input.lastSentAtMs === undefined) return undefined;
  const ftpChanged = input.sentFtpWatts !== undefined && input.currentFtpWatts !== undefined && Math.round(input.sentFtpWatts) !== Math.round(input.currentFtpWatts);
  const planChanged = input.planChangedAtMs !== undefined && input.planChangedAtMs > input.lastSentAtMs;
  if (ftpChanged || planChanged) return { label: "Older plan on Karoo", tone: "warning" };
  return { label: `Last sent ${formatShortDate(input.lastSentAtMs)}`, tone: "success" };
}

export interface RideSegmentHighlight {
  segmentId: string;
  name: string;
  durationMs: number;
  /** The fastest counted effort the rider has on this segment. */
  personalBest: boolean;
}

/**
 * Of the segments detected on a ride, those the phone has sent to a Karoo, with a personal-best flag.
 * `bestMsBySegment` is the fastest counted effort on each segment across all rides, this ride included.
 */
export function rideHighlights(input: {
  rideAttempts: readonly { segmentId: string; segmentName: string; durationMs: number }[];
  sentSegmentIds: ReadonlySet<string>;
  bestMsBySegment: ReadonlyMap<string, number>;
}): RideSegmentHighlight[] {
  const bestOnRide = new Map<string, { name: string; durationMs: number }>();
  for (const attempt of input.rideAttempts) {
    if (!input.sentSegmentIds.has(attempt.segmentId)) continue;
    const current = bestOnRide.get(attempt.segmentId);
    if (current === undefined || attempt.durationMs < current.durationMs) bestOnRide.set(attempt.segmentId, { name: attempt.segmentName, durationMs: attempt.durationMs });
  }
  return [...bestOnRide.entries()].map(([segmentId, value]) => ({
    segmentId,
    name: value.name,
    durationMs: value.durationMs,
    personalBest: input.bestMsBySegment.get(segmentId) === value.durationMs,
  }));
}
