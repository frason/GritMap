import { isSamePhysicalTraversal } from "./traversalOverlap.ts";

export interface RidePoint {
  lat: number;
  lng: number;
  timestampMs: number;
  /**
   * Identity of this point in its original source array — the parsed FIT record index,
   * which is also the persisted `ride_points.point_index` once the ride is imported.
   * Callers that remove non-GPS records before calling `matchSegment` MUST carry the
   * original index forward here (see `toMatcherRidePoints`) so `MatchCandidate.startPointIndex`
   * / `endPointIndex` keep identifying the correct database row even after filtering.
   * Defaults to the point's position within the `ride` array when omitted, which is only
   * correct if `ride` has not been filtered or reordered relative to its source.
   */
  sourcePointIndex?: number;
}

export interface ReferencePoint {
  lat: number;
  lng: number;
  distanceMeters: number;
}

export interface SegmentDefinition {
  id: string;
  corridorMeters: number;
  requiredCoveragePct: number;
  referencePolyline: ReferencePoint[];
}

export type MatchDecision = "accept" | "borderline" | "reject";

export interface MatchCandidate {
  decision: MatchDecision;
  /** `RidePoint.sourcePointIndex` (or array position if omitted) of the first matched point. */
  startPointIndex: number;
  /** `RidePoint.sourcePointIndex` (or array position if omitted) of the last matched point. */
  endPointIndex: number;
  coveragePct: number;
  maxBackwardMeters: number;
  maxGapMs: number;
  gpsGapCount: number;
  maxDeviationMeters: number;
  medianDeviationMeters: number;
  confidenceScore: number;
  matcherVersion: number;
  reasons: string[];
}

export interface ConfidenceScoreInput {
  coveragePct: number;
  requiredCoveragePct: number;
  maxDeviationMeters: number;
  medianDeviationMeters: number;
  corridorMeters: number;
  maxBackwardMeters: number;
  maxGapMs: number;
  reasons: readonly string[];
}

/** Bump whenever matching decisions, diagnostics, or confidence scoring change. */
export const MATCHER_VERSION = 2;

const EARTH_RADIUS_METERS = 6_371_008.8;
const MAX_BACKWARD_METERS = 30;
const MAX_GAP_MS = 30_000;

/**
 * Produces a diagnostic confidence fraction from five independently bounded components:
 * coverage (35%), direction/order (20%), corridor adherence (20%), backward movement
 * (10%), and GPS continuity (15%). Match decisions remain authoritative and are not
 * derived from this score.
 */
export function calculateConfidenceScore(input: ConfidenceScoreInput): number {
  const coverageTarget = input.requiredCoveragePct > 0 ? input.requiredCoveragePct : 1;
  const coverage = clamp01(input.coveragePct / coverageTarget);
  const direction = input.reasons.some((reason) =>
    reason === "reverse-traversal" || reason === "backward-progress"
  ) ? 0 : 1;
  const medianAdherence = 1 - clamp01(input.medianDeviationMeters / input.corridorMeters);
  const maximumAdherence = 1 - clamp01(input.maxDeviationMeters / (input.corridorMeters * 2));
  const corridor = (medianAdherence + maximumAdherence) / 2;
  const backward = 1 - clamp01(input.maxBackwardMeters / MAX_BACKWARD_METERS);
  const continuity =
    1 - clamp01(Math.max(0, input.maxGapMs - MAX_GAP_MS) / MAX_GAP_MS);

  return roundScore(
    0.35 * coverage +
    0.2 * direction +
    0.2 * corridor +
    0.1 * backward +
    0.15 * continuity,
  );
}

interface XY {
  x: number;
  y: number;
}

interface Projection {
  deviationMeters: number;
  progressMeters: number;
}

interface EvaluatedCandidate extends MatchCandidate {
  offCorridorTravelMeters: number;
}

/**
 * Finds completed directed traversals. Incomplete start touches are intentionally omitted.
 * Completed reverse traversals are returned as rejects so callers can diagnose direction.
 */
export function matchSegment(
  ride: readonly RidePoint[],
  segment: SegmentDefinition,
): MatchCandidate[] {
  validateInputs(ride, segment);
  if (ride.length < 2 || segment.referencePolyline.length < 2) {
    return [];
  }

  const origin = segment.referencePolyline[0];
  const referenceXY = segment.referencePolyline.map((point) => toXY(point, origin));
  const rideXY = ride.map((point) => toXY(point, origin));
  const totalLength = segment.referencePolyline.at(-1)?.distanceMeters ?? 0;

  const forward: EvaluatedCandidate[] = [];
  for (let index = 0; index < ride.length; index += 1) {
    if (distance(rideXY[index], referenceXY[0]) <= segment.corridorMeters) {
      const candidate = evaluateForward(
        ride,
        rideXY,
        referenceXY,
        segment,
        totalLength,
        index,
      );
      if (candidate !== null) {
        forward.push(candidate);
      }
    }
  }

  const reverse = findReverseTraversals(ride, rideXY, referenceXY, segment, totalLength);
  return deduplicate([...forward, ...reverse]).map(({ offCorridorTravelMeters: _, ...match }) =>
    match,
  );
}

function evaluateForward(
  ride: readonly RidePoint[],
  rideXY: readonly XY[],
  referenceXY: readonly XY[],
  segment: SegmentDefinition,
  totalLength: number,
  startIndex: number,
): EvaluatedCandidate | null {
  let maximumProgress = 0;
  let maximumBackward = 0;
  let maximumGap = 0;
  let gpsGapCount = 0;
  let maximumDeviation = 0;
  let offCorridorTravel = 0;
  let previousIndex = startIndex;
  // A candidate always starts near the segment's own beginning (the outer loop only calls
  // evaluateForward when the ride point is within corridorMeters of referenceXY[0]), so 0 is
  // a safe expectation for the very first projection too, not just a "no hint yet" sentinel.
  let previousProgressMeters = 0;
  const projections: Projection[] = [];

  for (let index = startIndex; index < ride.length; index += 1) {
    const projection = projectOntoPolyline(
      rideXY[index],
      referenceXY,
      segment.referencePolyline,
      previousProgressMeters,
    );
    previousProgressMeters = projection.progressMeters;
    projections.push(projection);
    maximumDeviation = Math.max(maximumDeviation, projection.deviationMeters);

    if (index > startIndex) {
      const gapMs = ride[index].timestampMs - ride[previousIndex].timestampMs;
      maximumGap = Math.max(maximumGap, gapMs);
      if (gapMs > MAX_GAP_MS) gpsGapCount += 1;
      if (projection.deviationMeters > segment.corridorMeters) {
        offCorridorTravel += distance(rideXY[previousIndex], rideXY[index]);
      }
    }

    maximumProgress = Math.max(maximumProgress, projection.progressMeters);
    maximumBackward = Math.max(maximumBackward, maximumProgress - projection.progressMeters);

    if (maximumBackward > MAX_BACKWARD_METERS) {
      return createCandidate({
        decision: "reject",
        startPointIndex: sourceIndexOf(ride, startIndex),
        endPointIndex: sourceIndexOf(ride, index),
        coveragePct: totalLength > 0 ? Math.min(1, maximumProgress / totalLength) : 0,
        maxBackwardMeters: maximumBackward,
        maxGapMs: maximumGap,
        gpsGapCount,
        deviationsMeters: projections.map((item) => item.deviationMeters),
        reasons: ["backward-progress"],
        segment,
        offCorridorTravelMeters: offCorridorTravel,
      });
    }

    if (isAtEnd(rideXY[index], referenceXY.at(-1)!, projection, totalLength, segment)) {
      const points = rideXY.slice(startIndex, index + 1);
      const coveragePct = calculateCoverage(points, referenceXY, segment.corridorMeters);
      const significantDetour =
        offCorridorTravel > totalLength * (1 - segment.requiredCoveragePct) &&
        maximumDeviation > segment.corridorMeters * 2;

      if (significantDetour) {
        return createCandidate({
          decision: "reject",
          startPointIndex: sourceIndexOf(ride, startIndex),
          endPointIndex: sourceIndexOf(ride, index),
          coveragePct,
          maxBackwardMeters: maximumBackward,
          maxGapMs: maximumGap,
          gpsGapCount,
          deviationsMeters: projections.map((item) => item.deviationMeters),
          reasons: ["different-route"],
          segment,
          offCorridorTravelMeters: offCorridorTravel,
        });
      }

      const reasons: string[] = [];
      if (coveragePct < segment.requiredCoveragePct) reasons.push("insufficient-coverage");
      if (maximumGap > MAX_GAP_MS) reasons.push("gps-gap");

      return createCandidate({
        decision: reasons.length === 0 ? "accept" : "borderline",
        startPointIndex: sourceIndexOf(ride, startIndex),
        endPointIndex: sourceIndexOf(ride, index),
        coveragePct,
        maxBackwardMeters: maximumBackward,
        maxGapMs: maximumGap,
        gpsGapCount,
        deviationsMeters: projections.map((item) => item.deviationMeters),
        reasons,
        segment,
        offCorridorTravelMeters: offCorridorTravel,
      });
    }
    previousIndex = index;
  }

  return null;
}

function findReverseTraversals(
  ride: readonly RidePoint[],
  rideXY: readonly XY[],
  referenceXY: readonly XY[],
  segment: SegmentDefinition,
  totalLength: number,
): EvaluatedCandidate[] {
  const results: EvaluatedCandidate[] = [];
  for (let start = 0; start < ride.length; start += 1) {
    if (distance(rideXY[start], referenceXY.at(-1)!) > segment.corridorMeters) continue;

    for (let end = start + 1; end < ride.length; end += 1) {
      if (distance(rideXY[end], referenceXY[0]) > segment.corridorMeters) continue;
      const startProjection = projectOntoPolyline(
        rideXY[start],
        referenceXY,
        segment.referencePolyline,
      );
      const endProjection = projectOntoPolyline(
        rideXY[end],
        referenceXY,
        segment.referencePolyline,
      );
      if (startProjection.progressMeters < totalLength - segment.corridorMeters) continue;
      if (endProjection.progressMeters > segment.corridorMeters) continue;

      const points = rideXY.slice(start, end + 1);
      const projections = points.map((point) =>
        projectOntoPolyline(point, referenceXY, segment.referencePolyline)
      );
      const gapStats = timestampGapStats(ride, start, end);
      results.push(createCandidate({
        decision: "reject",
        startPointIndex: sourceIndexOf(ride, start),
        endPointIndex: sourceIndexOf(ride, end),
        coveragePct: calculateCoverage(points, referenceXY, segment.corridorMeters),
        maxBackwardMeters: totalLength,
        maxGapMs: gapStats.maxGapMs,
        gpsGapCount: gapStats.gpsGapCount,
        deviationsMeters: projections.map((item) => item.deviationMeters),
        reasons: ["reverse-traversal"],
        segment,
        offCorridorTravelMeters: 0,
      }));
      break;
    }
  }
  return results;
}

/**
 * A route that passes close to itself -- a hairpin or switchback, common on climbing
 * segments -- can put two very different progress values within a couple of meters of each
 * other. Picking the single globally nearest point is ambiguous right at the turn: it can
 * snap onto the wrong leg even though the rider never left the corridor, producing a large
 * spurious backward (or forward) jump. Diagnosed against a real climb with a real switchback
 * (see matchSegment.test.ts's hairpin fixture) before this constant was chosen.
 */
const PROJECTION_AMBIGUITY_MARGIN_METERS = 5;

function projectOntoPolyline(
  point: XY,
  polyline: readonly XY[],
  reference: readonly ReferencePoint[],
  previousProgressMeters?: number,
): Projection {
  let best: Projection = { deviationMeters: Number.POSITIVE_INFINITY, progressMeters: 0 };

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const candidate = projectOntoSegment(point, polyline[index], polyline[index + 1], reference[index], reference[index + 1]);
    if (candidate.deviationMeters < best.deviationMeters) {
      best = candidate;
    }
  }

  if (previousProgressMeters === undefined) {
    return best;
  }

  // Among every near-tied candidate (within the ambiguity margin of the closest one),
  // prefer the one that continues smoothly from the previous point's progress instead of
  // the merely closest one -- this is what actually resolves the hairpin ambiguity above.
  let biased = best;
  let biasedProgressGap = Math.abs(best.progressMeters - previousProgressMeters);
  for (let index = 0; index < polyline.length - 1; index += 1) {
    const candidate = projectOntoSegment(point, polyline[index], polyline[index + 1], reference[index], reference[index + 1]);
    if (candidate.deviationMeters > best.deviationMeters + PROJECTION_AMBIGUITY_MARGIN_METERS) continue;
    const progressGap = Math.abs(candidate.progressMeters - previousProgressMeters);
    if (progressGap < biasedProgressGap) {
      biasedProgressGap = progressGap;
      biased = candidate;
    }
  }
  return biased;
}

function projectOntoSegment(
  point: XY,
  segmentStart: XY,
  segmentEnd: XY,
  referenceStart: ReferencePoint,
  referenceEnd: ReferencePoint,
): Projection {
  const dx = segmentEnd.x - segmentStart.x;
  const dy = segmentEnd.y - segmentStart.y;
  const lengthSquared = dx * dx + dy * dy;
  const rawT =
    lengthSquared === 0
      ? 0
      : ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, rawT));
  const projected = { x: segmentStart.x + t * dx, y: segmentStart.y + t * dy };
  return {
    deviationMeters: distance(point, projected),
    progressMeters:
      referenceStart.distanceMeters + t * (referenceEnd.distanceMeters - referenceStart.distanceMeters),
  };
}

function calculateCoverage(
  ridePoints: readonly XY[],
  referencePoints: readonly XY[],
  corridorMeters: number,
): number {
  if (referencePoints.length === 0) return 0;
  const covered = referencePoints.filter((referencePoint) =>
    ridePoints.some((ridePoint) => distance(referencePoint, ridePoint) <= corridorMeters),
  ).length;
  return covered / referencePoints.length;
}

function isAtEnd(
  point: XY,
  end: XY,
  projection: Projection,
  totalLength: number,
  segment: SegmentDefinition,
): boolean {
  return (
    distance(point, end) <= segment.corridorMeters &&
    projection.progressMeters >= totalLength - segment.corridorMeters
  );
}

function deduplicate(candidates: EvaluatedCandidate[]): EvaluatedCandidate[] {
  const ranked = [...candidates].sort(compareQuality);
  const kept: EvaluatedCandidate[] = [];
  for (const candidate of ranked) {
    if (!kept.some((existing) => isSamePhysicalTraversal(candidate, existing))) {
      kept.push(candidate);
    }
  }
  return kept.sort((a, b) => a.startPointIndex - b.startPointIndex);
}

function compareQuality(left: EvaluatedCandidate, right: EvaluatedCandidate): number {
  const decisionRank = { accept: 0, borderline: 1, reject: 2 };
  return (
    decisionRank[left.decision] - decisionRank[right.decision] ||
    right.coveragePct - left.coveragePct ||
    left.maxDeviationMeters - right.maxDeviationMeters
  );
}

interface CandidateMetrics {
  decision: MatchDecision;
  startPointIndex: number;
  endPointIndex: number;
  coveragePct: number;
  maxBackwardMeters: number;
  maxGapMs: number;
  gpsGapCount: number;
  deviationsMeters: readonly number[];
  reasons: string[];
  segment: SegmentDefinition;
  offCorridorTravelMeters: number;
}

function createCandidate(metrics: CandidateMetrics): EvaluatedCandidate {
  const maxDeviationMeters = Math.max(0, ...metrics.deviationsMeters);
  const medianDeviationMeters = median(metrics.deviationsMeters);
  const confidenceScore = calculateConfidenceScore({
    coveragePct: metrics.coveragePct,
    requiredCoveragePct: metrics.segment.requiredCoveragePct,
    maxDeviationMeters,
    medianDeviationMeters,
    corridorMeters: metrics.segment.corridorMeters,
    maxBackwardMeters: metrics.maxBackwardMeters,
    maxGapMs: metrics.maxGapMs,
    reasons: metrics.reasons,
  });

  return {
    decision: metrics.decision,
    startPointIndex: metrics.startPointIndex,
    endPointIndex: metrics.endPointIndex,
    coveragePct: metrics.coveragePct,
    maxBackwardMeters: metrics.maxBackwardMeters,
    maxGapMs: metrics.maxGapMs,
    gpsGapCount: metrics.gpsGapCount,
    maxDeviationMeters,
    medianDeviationMeters,
    confidenceScore,
    matcherVersion: MATCHER_VERSION,
    reasons: metrics.reasons,
    offCorridorTravelMeters: metrics.offCorridorTravelMeters,
  };
}

function timestampGapStats(
  ride: readonly RidePoint[],
  start: number,
  end: number,
): { maxGapMs: number; gpsGapCount: number } {
  let maxGapMs = 0;
  let gpsGapCount = 0;
  for (let index = start + 1; index <= end; index += 1) {
    const gapMs = ride[index].timestampMs - ride[index - 1].timestampMs;
    maxGapMs = Math.max(maxGapMs, gapMs);
    if (gapMs > MAX_GAP_MS) gpsGapCount += 1;
  }
  return { maxGapMs, gpsGapCount };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number): number {
  return Math.round(clamp01(value) * 1_000_000) / 1_000_000;
}

/** Resolves the original source-array identity for a ride index, per `RidePoint.sourcePointIndex`. */
function sourceIndexOf(ride: readonly RidePoint[], index: number): number {
  return ride[index].sourcePointIndex ?? index;
}

function toXY(point: { lat: number; lng: number }, origin: { lat: number; lng: number }): XY {
  const latitudeRadians = ((point.lat + origin.lat) / 2) * (Math.PI / 180);
  return {
    x: (point.lng - origin.lng) * (Math.PI / 180) * EARTH_RADIUS_METERS * Math.cos(latitudeRadians),
    y: (point.lat - origin.lat) * (Math.PI / 180) * EARTH_RADIUS_METERS,
  };
}

function distance(left: XY, right: XY): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function validateInputs(ride: readonly RidePoint[], segment: SegmentDefinition): void {
  if (!Number.isFinite(segment.corridorMeters) || segment.corridorMeters <= 0) {
    throw new Error("corridorMeters must be positive");
  }
  if (segment.requiredCoveragePct < 0 || segment.requiredCoveragePct > 1) {
    throw new Error("requiredCoveragePct must be between 0 and 1");
  }
  for (const point of [...ride, ...segment.referencePolyline]) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      throw new Error("Coordinates must be finite");
    }
  }
  for (const point of ride) {
    if (
      point.sourcePointIndex !== undefined &&
      (!Number.isInteger(point.sourcePointIndex) || point.sourcePointIndex < 0)
    ) {
      throw new Error("sourcePointIndex must be a non-negative integer");
    }
  }
}
