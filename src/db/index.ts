/**
 * Database operations for GritMap.
 * Handles initialization and persistence of segment attempts and diagnostics.
 */

import { MatchCandidate } from "../matcher/matchSegment";
import {
  SegmentAttempt,
  MatchDiagnostic,
  createSegmentAttempt,
  createMatchDiagnostic,
  isDuplicateAttempt,
} from "./persistence";

/**
 * Database interface to be implemented by actual database backends (SQLite, etc).
 * This abstraction allows testing and multiple implementations.
 */
export interface Database {
  /**
   * Initialize database tables.
   */
  initialize(): Promise<void>;

  /**
   * Persist a segment attempt and its diagnostics.
   * @param attempt The attempt to save (null for rejected candidates)
   * @param diagnostic The diagnostic details
   */
  saveAttempt(attempt: SegmentAttempt | null, diagnostic: MatchDiagnostic): Promise<void>;

  /**
   * Get all existing attempts for a segment to check for duplicates.
   */
  getAttempts(segmentId: string, rideId: string): Promise<SegmentAttempt[]>;

  /**
   * Delete all attempts and diagnostics for a segment (cascade on segment deletion).
   */
  deleteSegmentAttempts(segmentId: string): Promise<void>;

  /**
   * Delete all attempts and diagnostics for a ride (cascade on ride deletion).
   */
  deleteRideAttempts(rideId: string): Promise<void>;
}

/**
 * Persists matcher candidates to the database.
 * Handles accepted and borderline candidates creating segment_attempts rows.
 * Rejected candidates only create match_diagnostics rows (no segment_attempts).
 * Detects and prevents duplicates when matcher runs twice on the same ride/segment.
 *
 * @param candidates Matcher results
 * @param segmentId The segment being matched
 * @param rideId The ride being scanned
 * @param ridePoints The ride's GPS points (for extracting timestamps)
 * @param db Database instance
 */
export async function persistMatcherResults(
  candidates: MatchCandidate[],
  segmentId: string,
  rideId: string,
  ridePoints: Array<{ timestampMs: number }>,
  db: Database,
): Promise<void> {
  // Get existing attempts to check for duplicates
  const existingAttempts = await db.getAttempts(segmentId, rideId);

  // Process each candidate
  for (const candidate of candidates) {
    // Skip if this is a duplicate (same segment, ride, range, and version)
    if (isDuplicateAttempt(existingAttempts, candidate, segmentId, rideId)) {
      continue;
    }

    // Create attempt and diagnostic
    // Only accept/borderline create segment_attempts rows; rejected only create diagnostics
    const attempt = createSegmentAttempt(candidate, segmentId, rideId, ridePoints);
    const diagnostic = createMatchDiagnostic(candidate, segmentId, rideId, attempt?.id ?? null);

    // Persist both
    await db.saveAttempt(attempt, diagnostic);
  }
}

export type { SegmentAttempt, MatchDiagnostic };
export { createSegmentAttempt, createMatchDiagnostic };
