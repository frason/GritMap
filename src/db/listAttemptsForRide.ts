export interface ListAttemptsForRideDatabase {
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
  };
}

export interface RideAttemptSummary {
  attemptId: string;
  segmentId: string;
  segmentName: string;
  startTimestampMs: number;
  endTimestampMs: number;
  decision: "accept" | "borderline";
  confidenceScore: number;
  manuallyApproved: boolean;
}

interface StoredRideAttemptSummary {
  attempt_id: string;
  segment_id: string;
  segment_name: string;
  start_timestamp_ms: number;
  end_timestamp_ms: number;
  decision: "accept" | "borderline";
  confidence_score: number;
  manually_approved: number;
}

/**
 * Lists every segment traversal detected on a ride, newest first, for the Ride Detail
 * screen's "Detected segments" section -- the mirror image of listAttemptsForSegment.ts
 * (segment -> its attempting rides). Both read the same segment_attempts rows; this one
 * joins to segments for a display name instead of to rides/imported_files.
 */
export function listAttemptsForRide(
  database: ListAttemptsForRideDatabase,
  rideId: string,
): RideAttemptSummary[] {
  const rows = database
    .prepare(
      `SELECT
        segment_attempts.id AS attempt_id,
        segment_attempts.segment_id AS segment_id,
        segments.name AS segment_name,
        segment_attempts.start_timestamp_ms,
        segment_attempts.end_timestamp_ms,
        segment_attempts.decision,
        segment_attempts.confidence_score,
        segment_attempts.manually_approved
      FROM segment_attempts
      JOIN segments ON segments.id = segment_attempts.segment_id
      WHERE segment_attempts.ride_id = ?
      ORDER BY segment_attempts.start_timestamp_ms DESC, segment_attempts.id DESC`,
    )
    .all(rideId) as StoredRideAttemptSummary[];

  return rows.map((row) => ({
    attemptId: row.attempt_id,
    segmentId: row.segment_id,
    segmentName: row.segment_name,
    startTimestampMs: row.start_timestamp_ms,
    endTimestampMs: row.end_timestamp_ms,
    decision: row.decision,
    confidenceScore: row.confidence_score,
    manuallyApproved: row.manually_approved === 1,
  }));
}
