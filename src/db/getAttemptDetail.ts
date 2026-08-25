export interface GetAttemptDetailDatabase {
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
  };
}

export interface AttemptDetail {
  attemptId: string;
  segmentId: string;
  rideId: string;
  rideOriginalFilename: string;
  startPointIndex: number;
  endPointIndex: number;
  startTimestampMs: number;
  endTimestampMs: number;
  matcherVersion: number;
  decision: "accept" | "borderline";
  manuallyApproved: boolean;
  coveragePct: number;
  maxDeviationMeters: number;
  medianDeviationMeters?: number;
  maxBackwardMeters: number;
  maxGapMs: number;
  gpsGapCount: number;
  confidenceScore: number;
  reasons: string[];
}

interface StoredAttemptDetail {
  attempt_id: string;
  segment_id: string;
  ride_id: string;
  original_filename: string;
  start_point_index: number;
  end_point_index: number;
  start_timestamp_ms: number;
  end_timestamp_ms: number;
  matcher_version: number;
  decision: "accept" | "borderline";
  manually_approved: number;
  coverage_pct: number;
  max_deviation_meters: number;
  median_deviation_meters: number | null;
  max_backward_meters: number;
  max_gap_ms: number;
  gps_gap_count: number;
  confidence_score: number;
  reasons_json: string;
}

/** Reads one attempt's full diagnostic detail, for the advanced review screen (issue #11). */
export function getAttemptDetail(
  database: GetAttemptDetailDatabase,
  attemptId: string,
): AttemptDetail | undefined {
  const row = database
    .prepare(
      `SELECT
        segment_attempts.id AS attempt_id,
        segment_attempts.segment_id AS segment_id,
        segment_attempts.ride_id AS ride_id,
        imported_files.original_filename AS original_filename,
        segment_attempts.start_point_index,
        segment_attempts.end_point_index,
        segment_attempts.start_timestamp_ms,
        segment_attempts.end_timestamp_ms,
        segment_attempts.matcher_version,
        segment_attempts.decision,
        segment_attempts.manually_approved,
        match_diagnostics.coverage_pct,
        match_diagnostics.max_deviation_meters,
        match_diagnostics.median_deviation_meters,
        match_diagnostics.max_backward_meters,
        match_diagnostics.max_gap_ms,
        match_diagnostics.gps_gap_count,
        match_diagnostics.confidence_score,
        match_diagnostics.reasons_json
      FROM segment_attempts
      JOIN rides ON rides.id = segment_attempts.ride_id
      JOIN imported_files ON imported_files.id = rides.imported_file_id
      JOIN match_diagnostics ON match_diagnostics.attempt_id = segment_attempts.id
      WHERE segment_attempts.id = ?`,
    )
    .get(attemptId) as StoredAttemptDetail | undefined;

  if (row === undefined) return undefined;

  return {
    attemptId: row.attempt_id,
    segmentId: row.segment_id,
    rideId: row.ride_id,
    rideOriginalFilename: row.original_filename,
    startPointIndex: row.start_point_index,
    endPointIndex: row.end_point_index,
    startTimestampMs: row.start_timestamp_ms,
    endTimestampMs: row.end_timestamp_ms,
    matcherVersion: row.matcher_version,
    decision: row.decision,
    manuallyApproved: row.manually_approved === 1,
    coveragePct: row.coverage_pct,
    maxDeviationMeters: row.max_deviation_meters,
    ...(row.median_deviation_meters === null
      ? {}
      : { medianDeviationMeters: row.median_deviation_meters }),
    maxBackwardMeters: row.max_backward_meters,
    maxGapMs: row.max_gap_ms,
    gpsGapCount: row.gps_gap_count,
    confidenceScore: row.confidence_score,
    reasons: JSON.parse(row.reasons_json) as string[],
  };
}
