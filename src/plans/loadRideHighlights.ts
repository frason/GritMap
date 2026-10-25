import { listAttemptsForRide } from "../db/listAttemptsForRide";
import { listAttemptsForSegment } from "../db/listAttemptsForSegment";
import type { SyncDatabase } from "../db/types";
import { rideHighlights, type RideSegmentHighlight } from "./karooMarks";

const counts = (attempt: { decision: string; manuallyApproved: boolean }) => attempt.decision === "accept" || attempt.manuallyApproved;

/** The sent-to-Karoo segments a ride went over, with personal bests flagged. `sentSegmentIds` comes from the send log. */
export function loadRideHighlights(database: SyncDatabase, rideId: string, sentSegmentIds: ReadonlySet<string>): RideSegmentHighlight[] {
  if (sentSegmentIds.size === 0) return [];
  const rideAttempts = listAttemptsForRide(database, rideId)
    .filter(counts)
    .map((attempt) => ({ segmentId: attempt.segmentId, segmentName: attempt.segmentName, durationMs: attempt.endTimestampMs - attempt.startTimestampMs }));
  const bestMsBySegment = new Map<string, number>();
  for (const attempt of rideAttempts) {
    if (!sentSegmentIds.has(attempt.segmentId) || bestMsBySegment.has(attempt.segmentId)) continue;
    const durations = listAttemptsForSegment(database, attempt.segmentId)
      .filter(counts)
      .map((a) => a.endTimestampMs - a.startTimestampMs);
    if (durations.length > 0) bestMsBySegment.set(attempt.segmentId, Math.min(...durations));
  }
  return rideHighlights({ rideAttempts, sentSegmentIds, bestMsBySegment });
}
