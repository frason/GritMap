/**
 * Database schema definitions for GritMap.
 * Defines the structure of tables for storing rides, segments, attempts, and diagnostics.
 */

/**
 * SQL to create the segment_attempts table.
 * References a source ride and segment using start/end point indexes and timestamps.
 * Does NOT copy ride GPS/sensor streams (those remain in the ride_points table).
 *
 * Segment duration is wall-clock time between FIT timestamps at segment boundaries.
 * Stops and bike-computer auto-pause remain part of the attempt time.
 */
export const CREATE_SEGMENT_ATTEMPTS_TABLE = `
CREATE TABLE IF NOT EXISTS segment_attempts (
  id TEXT PRIMARY KEY,
  segmentId TEXT NOT NULL,
  rideId TEXT NOT NULL,
  startPointIndex INTEGER NOT NULL,
  endPointIndex INTEGER NOT NULL,
  startTimestampMs INTEGER NOT NULL,
  endTimestampMs INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('accept', 'borderline', 'reject')),
  manuallyApproved INTEGER DEFAULT 0,
  matcherVersion INTEGER NOT NULL,
  createdAt TEXT NOT NULL,

  FOREIGN KEY(segmentId) REFERENCES segments(id) ON DELETE CASCADE,
  FOREIGN KEY(rideId) REFERENCES rides(id) ON DELETE CASCADE,
  UNIQUE(segmentId, rideId, startPointIndex, endPointIndex, matcherVersion)
);

CREATE INDEX IF NOT EXISTS idx_segment_attempts_segment ON segment_attempts(segmentId);
CREATE INDEX IF NOT EXISTS idx_segment_attempts_ride ON segment_attempts(rideId);
CREATE INDEX IF NOT EXISTS idx_segment_attempts_decision ON segment_attempts(decision);
`;

/**
 * SQL to create the match_diagnostics table.
 * Stores detailed diagnostic information for every matcher decision,
 * including coverage, deviation, gaps, backward movement, and confidence score.
 * This enables advanced review and reevaluation when the matcher version changes.
 */
export const CREATE_MATCH_DIAGNOSTICS_TABLE = `
CREATE TABLE IF NOT EXISTS match_diagnostics (
  id TEXT PRIMARY KEY,
  attemptId TEXT NOT NULL,
  segmentId TEXT NOT NULL,
  rideId TEXT NOT NULL,
  coveragePct REAL NOT NULL,
  maxDeviationMeters REAL NOT NULL,
  maxBackwardMeters REAL NOT NULL,
  maxGapMs INTEGER NOT NULL,
  confidenceScore INTEGER NOT NULL,
  matcherVersion INTEGER NOT NULL,
  reasons TEXT NOT NULL,
  createdAt TEXT NOT NULL,

  FOREIGN KEY(attemptId) REFERENCES segment_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY(segmentId) REFERENCES segments(id) ON DELETE CASCADE,
  FOREIGN KEY(rideId) REFERENCES rides(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_match_diagnostics_attempt ON match_diagnostics(attemptId);
CREATE INDEX IF NOT EXISTS idx_match_diagnostics_segment ON match_diagnostics(segmentId);
CREATE INDEX IF NOT EXISTS idx_match_diagnostics_ride ON match_diagnostics(rideId);
`;

/**
 * Minimal schema for rides and segments to satisfy foreign key constraints.
 * The full schema is defined elsewhere; these are just enough for this issue.
 */
export const CREATE_RIDES_TABLE = `
CREATE TABLE IF NOT EXISTS rides (
  id TEXT PRIMARY KEY,
  filePath TEXT NOT NULL,
  startTimestampMs INTEGER NOT NULL,
  createdAt TEXT NOT NULL
);
`;

export const CREATE_SEGMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  referenceRideId TEXT NOT NULL,
  createdAt TEXT NOT NULL,

  FOREIGN KEY(referenceRideId) REFERENCES rides(id) ON DELETE CASCADE
);
`;
