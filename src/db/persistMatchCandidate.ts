import type { MatchCandidate } from "../matcher/matchSegment.ts";
import {
  isSamePhysicalTraversal,
  traversalOverlapRatio,
} from "../matcher/traversalOverlap.ts";

export interface MatchPersistenceDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
    get(...parameters: unknown[]): unknown;
    run(...parameters: unknown[]): unknown;
  };
}

export interface PersistMatchContext {
  attemptId: string;
  segmentId: string;
  rideId: string;
  createdAtMs: number;
  manuallyApproved?: boolean;
}

export type PersistMatchResult =
  | { status: "inserted"; attemptId: string }
  | { status: "duplicate"; attemptId: string }
  | { status: "updated"; attemptId: string }
  | { status: "removed"; attemptId: string }
  | { status: "rejected" };

interface StoredAttempt {
  id: string;
  start_point_index: number;
  end_point_index: number;
  matcher_version: number;
  manually_approved: number;
}

/**
 * Persists a reviewable or accepted traversal and its one-to-one diagnostics atomically.
 * An overlapping traversal for the same ride and segment (>50% overlap, see
 * traversalOverlap.ts) is treated as the same physical attempt. Manual decisions always
 * win. Automatic results are refreshed only by a strictly newer matcher version; a newer
 * reject removes the old automatic attempt entirely.
 *
 * `candidate.startPointIndex` / `endPointIndex` are `ride_points.point_index` identities
 * (see `matchSegment`'s `sourcePointIndex` contract). Boundary timestamps are always read
 * directly from those `ride_points` rows rather than trusted from the caller, so a persisted
 * attempt can never disagree with the row it is keyed to.
 */
export function persistMatchCandidate(
  database: MatchPersistenceDatabase,
  candidate: MatchCandidate,
  context: PersistMatchContext,
): PersistMatchResult {
  database.exec("BEGIN IMMEDIATE");
  try {
    const storedAttempts = database.prepare(`
      SELECT id, start_point_index, end_point_index, matcher_version, manually_approved
      FROM segment_attempts
      WHERE segment_id = ?
        AND ride_id = ?
      ORDER BY start_point_index, end_point_index
    `).all(
      context.segmentId,
      context.rideId,
    ) as unknown as StoredAttempt[];
    const overlapping = bestPhysicalTraversalMatch(candidate, storedAttempts);

    if (overlapping !== undefined) {
      if (
        overlapping.manually_approved === 1 ||
        candidate.matcherVersion <= overlapping.matcher_version
      ) {
        database.exec("COMMIT");
        return { status: "duplicate", attemptId: overlapping.id };
      }

      if (candidate.decision === "reject") {
        database.prepare("DELETE FROM segment_attempts WHERE id = ?").run(overlapping.id);
        database.exec("COMMIT");
        return { status: "removed", attemptId: overlapping.id };
      }

      const startTimestampMs = readRidePointTimestampMs(
        database,
        context.rideId,
        candidate.startPointIndex,
      );
      const endTimestampMs = readRidePointTimestampMs(
        database,
        context.rideId,
        candidate.endPointIndex,
      );
      updateAttempt(database, overlapping.id, candidate, startTimestampMs, endTimestampMs);
      database.exec("COMMIT");
      return { status: "updated", attemptId: overlapping.id };
    }

    if (candidate.decision === "reject") {
      database.exec("COMMIT");
      return { status: "rejected" };
    }

    const startTimestampMs = readRidePointTimestampMs(
      database,
      context.rideId,
      candidate.startPointIndex,
    );
    const endTimestampMs = readRidePointTimestampMs(
      database,
      context.rideId,
      candidate.endPointIndex,
    );

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
      startTimestampMs,
      endTimestampMs,
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

/**
 * Reads the timestamp of the `ride_points` row identified by `pointIndex`, the same row the
 * `segment_attempts` FK constraints require to exist. Throws (rolling back the caller's
 * transaction) instead of persisting an attempt whose boundary cannot be verified.
 */
function readRidePointTimestampMs(
  database: MatchPersistenceDatabase,
  rideId: string,
  pointIndex: number,
): number {
  const row = database.prepare(`
    SELECT timestamp_ms
    FROM ride_points
    WHERE ride_id = ? AND point_index = ?
  `).get(rideId, pointIndex) as { timestamp_ms?: number } | undefined;

  if (row?.timestamp_ms === undefined) {
    throw new Error(
      `No ride_points row for ride ${rideId} at point_index ${pointIndex}; cannot persist match boundary`,
    );
  }
  return row.timestamp_ms;
}

function bestPhysicalTraversalMatch(
  candidate: MatchCandidate,
  storedAttempts: readonly StoredAttempt[],
): StoredAttempt | undefined {
  return storedAttempts
    .filter((stored) =>
      isSamePhysicalTraversal(candidate, {
        startPointIndex: stored.start_point_index,
        endPointIndex: stored.end_point_index,
      }),
    )
    .sort((left, right) =>
      traversalOverlapRatio(candidate, {
        startPointIndex: right.start_point_index,
        endPointIndex: right.end_point_index,
      }) -
      traversalOverlapRatio(candidate, {
        startPointIndex: left.start_point_index,
        endPointIndex: left.end_point_index,
      }),
    )[0];
}

function updateAttempt(
  database: MatchPersistenceDatabase,
  attemptId: string,
  candidate: Exclude<MatchCandidate, { decision: "reject" }>,
  startTimestampMs: number,
  endTimestampMs: number,
): void {
  database.prepare(`
    UPDATE segment_attempts
    SET start_point_index = ?,
        end_point_index = ?,
        start_timestamp_ms = ?,
        end_timestamp_ms = ?,
        matcher_version = ?,
        confidence_score = ?,
        decision = ?
    WHERE id = ?
  `).run(
    candidate.startPointIndex,
    candidate.endPointIndex,
    startTimestampMs,
    endTimestampMs,
    candidate.matcherVersion,
    candidate.confidenceScore,
    candidate.decision,
    attemptId,
  );
  database.prepare(`
    UPDATE match_diagnostics
    SET coverage_pct = ?,
        max_deviation_meters = ?,
        median_deviation_meters = ?,
        max_backward_meters = ?,
        max_gap_ms = ?,
        gps_gap_count = ?,
        confidence_score = ?,
        reasons_json = ?
    WHERE attempt_id = ?
  `).run(
    candidate.coveragePct,
    candidate.maxDeviationMeters,
    candidate.medianDeviationMeters,
    candidate.maxBackwardMeters,
    candidate.maxGapMs,
    candidate.gpsGapCount,
    candidate.confidenceScore,
    JSON.stringify(candidate.reasons),
    attemptId,
  );
}
