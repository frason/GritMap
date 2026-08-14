/**
 * Persistence layer for segment attempts and match diagnostics.
 * Handles storing matcher results and preventing duplicates.
 */

import { MatchCandidate } from "../matcher/matchSegment";

/**
 * Represents a segment attempt in the database.
 * References a source ride using start/end point indexes and timestamps,
 * without copying the ride's GPS or sensor streams.
 */
export interface SegmentAttempt {
  id: string;
  segmentId: string;
  rideId: string;
  startPointIndex: number;
  endPointIndex: number;
  startTimestampMs: number;
  endTimestampMs: number;
  decision: "accept" | "borderline" | "reject";
  manuallyApproved: boolean;
  matcherVersion: number;
  createdAt: string;
}

/**
 * Stores detailed diagnostic information for a matcher decision.
 * Enables advanced review and reevaluation when matcher version changes.
 */
export interface MatchDiagnostic {
  id: string;
  attemptId: string;
  segmentId: string;
  rideId: string;
  coveragePct: number;
  maxDeviationMeters: number;
  maxBackwardMeters: number;
  maxGapMs: number;
  confidenceScore: number;
  matcherVersion: number;
  reasons: string[];
  createdAt: string;
}

/**
 * Creates a segment attempt from a matcher candidate.
 * Only accepts and borderline candidates should create attempt rows.
 * Rejected candidates are stored as diagnostics for review but don't create attempts.
 */
export function createSegmentAttempt(
  candidate: MatchCandidate,
  segmentId: string,
  rideId: string,
  ridePoints: Array<{ timestampMs: number }>,
): SegmentAttempt | null {
  // Rejected candidates don't create segment_attempts rows (per MVP spec section 5)
  if (candidate.decision === "reject") {
    return null;
  }

  const id = generateAttemptId(segmentId, rideId, candidate.startPointIndex, candidate.endPointIndex);
  const startTimestampMs = ridePoints[candidate.startPointIndex]?.timestampMs ?? 0;
  const endTimestampMs = ridePoints[candidate.endPointIndex]?.timestampMs ?? 0;

  return {
    id,
    segmentId,
    rideId,
    startPointIndex: candidate.startPointIndex,
    endPointIndex: candidate.endPointIndex,
    startTimestampMs,
    endTimestampMs,
    decision: candidate.decision,
    manuallyApproved: false,
    matcherVersion: candidate.matcherVersion,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Creates a match diagnostic from a matcher candidate.
 * Stores detailed metrics for all decisions (accept/borderline/reject).
 */
export function createMatchDiagnostic(
  candidate: MatchCandidate,
  segmentId: string,
  rideId: string,
  attemptId: string | null,
): MatchDiagnostic {
  return {
    id: generateDiagnosticId(segmentId, rideId, candidate.startPointIndex, candidate.endPointIndex),
    attemptId: attemptId || generateAttemptId(segmentId, rideId, candidate.startPointIndex, candidate.endPointIndex),
    segmentId,
    rideId,
    coveragePct: candidate.coveragePct,
    maxDeviationMeters: candidate.maxDeviationMeters,
    maxBackwardMeters: candidate.maxBackwardMeters,
    maxGapMs: candidate.maxGapMs,
    confidenceScore: candidate.confidenceScore,
    matcherVersion: candidate.matcherVersion,
    reasons: candidate.reasons,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generates a deterministic ID for a segment attempt.
 * Includes segmentId, rideId, start/end indices, and matcher version.
 * This enables detecting duplicate attempts when the matcher runs twice on the same traverse.
 */
function generateAttemptId(
  segmentId: string,
  rideId: string,
  startIndex: number,
  endIndex: number,
): string {
  // Use a hash-like format to make IDs unique per (segment, ride, range)
  return `attempt:${segmentId}:${rideId}:${startIndex}:${endIndex}`;
}

/**
 * Generates a deterministic ID for a match diagnostic.
 * Similar to attempt IDs but for diagnostics that may not have attempts.
 */
function generateDiagnosticId(
  segmentId: string,
  rideId: string,
  startIndex: number,
  endIndex: number,
): string {
  return `diag:${segmentId}:${rideId}:${startIndex}:${endIndex}`;
}

/**
 * Checks if an attempt already exists (duplicate detection).
 * Running the matcher twice on the same ride/segment should not create duplicate rows.
 * This would be called before inserting a new attempt.
 */
export function isDuplicateAttempt(
  existingAttempts: SegmentAttempt[],
  candidate: MatchCandidate,
  segmentId: string,
  rideId: string,
): boolean {
  return existingAttempts.some(
    (attempt) =>
      attempt.segmentId === segmentId &&
      attempt.rideId === rideId &&
      attempt.startPointIndex === candidate.startPointIndex &&
      attempt.endPointIndex === candidate.endPointIndex &&
      attempt.matcherVersion === candidate.matcherVersion,
  );
}

/**
 * Gets the segment duration from start to end point.
 * Duration is wall-clock time between FIT timestamps at segment boundaries.
 * Stops and auto-pause remain part of the attempt time.
 */
export function getAttemptDuration(
  startTimestampMs: number,
  endTimestampMs: number,
): number {
  return endTimestampMs - startTimestampMs;
}
