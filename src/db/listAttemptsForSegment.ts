export interface ListAttemptsForSegmentDatabase {
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
  };
}

export interface AttemptSummary {
  attemptId: string;
  rideId: string;
  rideOriginalFilename: string;
  startTimestampMs: number;
  endTimestampMs: number;
  decision: "accept" | "borderline";
  confidenceScore: number;
  manuallyApproved: boolean;
}

interface StoredAttemptSummary {
  attempt_id: string;
  ride_id: string;
  original_filename: string;
  start_timestamp_ms: number;
  end_timestamp_ms: number;
  decision: "accept" | "borderline";
  confidence_score: number;
  manually_approved: number;
}

/** Lists every attempt for a segment, newest first, for the Segment Detail screen. */
export function listAttemptsForSegment(
  database: ListAttemptsForSegmentDatabase,
  segmentId: string,
): AttemptSummary[] {
  const rows = database
    .prepare(
      `SELECT
        segment_attempts.id AS attempt_id,
        segment_attempts.ride_id AS ride_id,
        imported_files.original_filename AS original_filename,
        segment_attempts.start_timestamp_ms,
        segment_attempts.end_timestamp_ms,
        segment_attempts.decision,
        segment_attempts.confidence_score,
        segment_attempts.manually_approved
      FROM segment_attempts
      JOIN rides ON rides.id = segment_attempts.ride_id
      JOIN imported_files ON imported_files.id = rides.imported_file_id
      WHERE segment_attempts.segment_id = ?
      ORDER BY segment_attempts.start_timestamp_ms DESC, segment_attempts.id DESC`,
    )
    .all(segmentId) as StoredAttemptSummary[];

  return rows.map((row) => ({
    attemptId: row.attempt_id,
    rideId: row.ride_id,
    rideOriginalFilename: row.original_filename,
    startTimestampMs: row.start_timestamp_ms,
    endTimestampMs: row.end_timestamp_ms,
    decision: row.decision,
    confidenceScore: row.confidence_score,
    manuallyApproved: row.manually_approved === 1,
  }));
}
