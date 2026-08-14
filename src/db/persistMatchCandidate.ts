import type { MatchCandidate } from "../matcher/matchSegment.ts";

export interface MatchPersistenceDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
    run(...parameters: unknown[]): unknown;
  };
}

export interface PersistMatchContext {
  attemptId: string;
  segmentId: string;
  rideId: string;
  startTimestampMs: number;
  endTimestampMs: number;
  createdAtMs: number;
  manuallyApproved?: boolean;
}

export type PersistMatchResult =
  | { status: "inserted"; attemptId: string }
  | { status: "duplicate"; attemptId: string }
  | { status: "rejected" };

/**
 * Persists a reviewable or accepted traversal and its one-to-one diagnostics atomically.
 * Rejects are intentionally ignored. An overlapping traversal for the same ride and
 * segment is treated as the same physical attempt and the existing row is kept unchanged.
 */
export function persistMatchCandidate(
  database: MatchPersistenceDatabase,
  candidate: MatchCandidate,
  context: PersistMatchContext,
): PersistMatchResult {
  if (candidate.decision === "reject") return { status: "rejected" };

  database.exec("BEGIN IMMEDIATE");
  try {
    const overlapping = database.prepare(`
      SELECT id
      FROM segment_attempts
      WHERE segment_id = ?
        AND ride_id = ?
        AND start_point_index <= ?
        AND end_point_index >= ?
      ORDER BY start_point_index, end_point_index
      LIMIT 1
    `).get(
      context.segmentId,
      context.rideId,
      candidate.endPointIndex,
      candidate.startPointIndex,
    ) as { id?: string } | undefined;

    if (overlapping?.id !== undefined) {
      database.exec("COMMIT");
      return { status: "duplicate", attemptId: overlapping.id };
    }

    database.prepare(`
      INSERT INTO segment_attempts (
        id,
        segment_id,
        ride_id,
        start_point_index,
        end_point_index,
        start_timestamp_ms,
        end_timestamp_ms,
        matcher_version,
        confidence_score,
        decision,
        manually_approved,
        created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      context.attemptId,
      context.segmentId,
      context.rideId,
      candidate.startPointIndex,
      candidate.endPointIndex,
      context.startTimestampMs,
      context.endTimestampMs,
      candidate.matcherVersion,
      candidate.confidenceScore,
      candidate.decision,
      context.manuallyApproved === true ? 1 : 0,
      context.createdAtMs,
    );

    database.prepare(`
      INSERT INTO match_diagnostics (
        attempt_id,
        coverage_pct,
        max_deviation_meters,
        median_deviation_meters,
        max_backward_meters,
        max_gap_ms,
        gps_gap_count,
        confidence_score,
        reasons_json,
        created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      context.attemptId,
      candidate.coveragePct,
      candidate.maxDeviationMeters,
      candidate.medianDeviationMeters,
      candidate.maxBackwardMeters,
      candidate.maxGapMs,
      candidate.gpsGapCount,
      candidate.confidenceScore,
      JSON.stringify(candidate.reasons),
      context.createdAtMs,
    );

    database.exec("COMMIT");
    return { status: "inserted", attemptId: context.attemptId };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
