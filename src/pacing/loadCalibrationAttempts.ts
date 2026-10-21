import { getAttemptDetail, type GetAttemptDetailDatabase } from "../db/getAttemptDetail.ts";
import { getAttemptTrack, type GetAttemptTrackDatabase } from "../db/getAttemptTrack.ts";
import { listAttemptsForSegment, type ListAttemptsForSegmentDatabase } from "../db/listAttemptsForSegment.ts";
import type { CalibrationAttempt } from "./predictPlanFinish.ts";

/** The rider's most recent accepted (or manually approved) efforts on a segment, newest first, with their tracks. */
export function loadCalibrationAttempts(
  database: GetAttemptDetailDatabase & GetAttemptTrackDatabase & ListAttemptsForSegmentDatabase,
  segmentId: string,
  limit = 3,
  /**
   * The rider's weight (kg) on the day of an effort, when the app knows it (a weight history; none is stored yet). Without it
   * every effort is calibrated at the rider's current weight.
   */
  weightAt?: (startTimestampMs: number) => number | undefined,
): CalibrationAttempt[] {
  const attempts: CalibrationAttempt[] = [];
  const recent = listAttemptsForSegment(database, segmentId)
    .filter((attempt) => attempt.decision === "accept" || attempt.manuallyApproved)
    .sort((a, b) => b.startTimestampMs - a.startTimestampMs);
  for (const summary of recent) {
    if (attempts.length >= limit) break;
    const detail = getAttemptDetail(database, summary.attemptId);
    if (detail === undefined) continue;
    const track = getAttemptTrack(database, detail.rideId, detail.startPointIndex, detail.endPointIndex);
    if (track.length < 2) continue;
    const weight = weightAt?.(summary.startTimestampMs);
    attempts.push({
      track,
      durationMs: summary.endTimestampMs - summary.startTimestampMs,
      ...(weight === undefined ? {} : { riderWeightKg: weight }),
    });
  }
  return attempts;
}
