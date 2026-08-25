import { getMatcherRidePoints } from "../db/getMatcherRidePoints.ts";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail.ts";
import { listRides } from "../db/listRides.ts";
import { listSegments } from "../db/listSegments.ts";
import {
  persistMatchCandidate,
  type MatchPersistenceDatabase,
  type PersistMatchResult,
} from "../db/persistMatchCandidate.ts";
import { matchSegment, type RidePoint, type SegmentDefinition } from "./matchSegment.ts";
import { toMatcherRidePoints } from "./toMatcherRidePoints.ts";

export interface MatchRunSummary {
  inserted: number;
  updated: number;
  duplicate: number;
  removed: number;
  rejected: number;
}

/**
 * Scans one ride against every existing segment and persists results. Call this right after
 * a ride is imported or replaced (issue #5's flow). A freshly imported ride has no
 * segment_attempts yet; a replaced ride's old attempts were already cascade-deleted when its
 * ride_points were replaced (see persistImportedRide.ts's own doc comment).
 */
export function runMatcherForRide(
  database: MatchPersistenceDatabase,
  generateId: () => string,
  rideId: string,
  nowMs: number,
): MatchRunSummary {
  const summary = emptySummary();
  const ridePoints = toMatcherRidePoints(getMatcherRidePoints(database, rideId));
  if (ridePoints.length < 2) return summary;

  for (const { segmentId } of listSegments(database)) {
    const segment = getSegmentDetail(database, segmentId);
    if (segment === undefined) continue;
    runOnePair(database, generateId, ridePoints, rideId, segment, nowMs, summary);
  }
  return summary;
}

/**
 * Scans one segment against every existing ride and persists results. Call this right after
 * a segment is created (issue #7's flow) -- a brand-new segment has no attempts against any
 * ride yet, including the ride it was itself defined from.
 */
export function runMatcherForSegment(
  database: MatchPersistenceDatabase,
  generateId: () => string,
  segmentId: string,
  nowMs: number,
): MatchRunSummary {
  const summary = emptySummary();
  const segment = getSegmentDetail(database, segmentId);
  if (segment === undefined) return summary;

  for (const { rideId } of listRides(database)) {
    const ridePoints = toMatcherRidePoints(getMatcherRidePoints(database, rideId));
    if (ridePoints.length < 2) continue;
    runOnePair(database, generateId, ridePoints, rideId, segment, nowMs, summary);
  }
  return summary;
}

function runOnePair(
  database: MatchPersistenceDatabase,
  generateId: () => string,
  ridePoints: readonly RidePoint[],
  rideId: string,
  segment: SegmentDetail,
  nowMs: number,
  summary: MatchRunSummary,
): void {
  if (segment.referencePolyline.length < 2) return;
  const definition: SegmentDefinition = {
    id: segment.segmentId,
    corridorMeters: segment.corridorMeters,
    requiredCoveragePct: segment.requiredCoveragePct,
    referencePolyline: segment.referencePolyline,
  };

  for (const candidate of matchSegment(ridePoints, definition)) {
    const result = persistMatchCandidate(database, candidate, {
      attemptId: generateId(),
      segmentId: segment.segmentId,
      rideId,
      createdAtMs: nowMs,
    });
    tally(summary, result);
  }
}

function emptySummary(): MatchRunSummary {
  return { inserted: 0, updated: 0, duplicate: 0, removed: 0, rejected: 0 };
}

function tally(summary: MatchRunSummary, result: PersistMatchResult): void {
  summary[result.status] += 1;
}
