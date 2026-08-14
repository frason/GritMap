export interface RidePoint {
  lat: number;
  lng: number;
  timestampMs: number;
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
  startPointIndex: number;
  endPointIndex: number;
  coveragePct: number;
  maxBackwardMeters: number;
  maxGapMs: number;
  maxDeviationMeters: number;
  medianDeviationMeters: number;
  /** Diagnostic confidence score in [0, 1]; higher is more trustworthy. */
  confidence: number;
  /** Matcher algorithm version active when this candidate was produced. */
  matcherVersion: number;
  reasons: string[];
}

const EARTH_RADIUS_METERS = 6_371_008.8;
const MAX_BACKWARD_METERS = 30;
const MAX_GAP_MS = 30_000;
const DUPLICATE_OVERLAP_THRESHOLD = 0.5;

/**
 * Bumped whenever the matching algorithm's inputs/outputs or decision logic change.
 * Persisted with every decision so a later reevaluation pass can find and re-run
 * candidates that were produced under an older version.
 */
export const MATCHER_VERSION = 1;

/** Relative weights used to blend confidence sub-scores. Must sum to 1. */
const CONFIDENCE_WEIGHTS = {
  coverage: 0.35,
  direction: 0.25,
  corridor: 0.15,
  backward: 0.15,
  continuity: 0.1,
} as const;

const DIRECTION_FAILURE_REASONS = new Set(["reverse-traversal", "different-route"]);

interface XY {
  x: number;
  y: number;
}

interface Projection {
  deviationMeters: number;
  progressMeters: number;
}

interface EvaluatedCandidate extends Omit<MatchCandidate, "confidence" | "matcherVersion"> {
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
  return deduplicate([...forward, ...reverse]).map(({ offCorridorTravelMeters: _, ...match }) => ({
    ...match,
    confidence: calculateConfidence(match, segment),
    matcherVersion: MATCHER_VERSION,
  }));
}

/**
 * Diagnostic confidence score in [0, 1] blending route coverage, direction/order
 * correctness, corridor (perpendicular) distance, backward projected movement, and
 * GPS continuity. Used for advanced review triage, not for the accept/borderline/reject
 * decision itself (that remains rule-based above).
 */
export function calculateConfidence(
  candidate: Pick<
    MatchCandidate,
    "coveragePct" | "maxDeviationMeters" | "maxBackwardMeters" | "maxGapMs" | "reasons"
  >,
  segment: Pick<SegmentDefinition, "corridorMeters">,
): number {
  const coverageScore = clamp01(candidate.coveragePct);
  const directionScore = candidate.reasons.some((reason) => DIRECTION_FAILURE_REASONS.has(reason))
    ? 0
    : 1;
  const corridorScore = clamp01(1 - candidate.maxDeviationMeters / (segment.corridorMeters * 2));
  const backwardScore = clamp01(1 - candidate.maxBackwardMeters / MAX_BACKWARD_METERS);
  const continuityScore = clamp01(1 - candidate.maxGapMs / (MAX_GAP_MS * 2));

  return clamp01(
    coverageScore * CONFIDENCE_WEIGHTS.coverage +
      directionScore * CONFIDENCE_WEIGHTS.direction +
      corridorScore * CONFIDENCE_WEIGHTS.corridor +
      backwardScore * CONFIDENCE_WEIGHTS.backward +
      continuityScore * CONFIDENCE_WEIGHTS.continuity,
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
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
  let maximumDeviation = 0;
  let offCorridorTravel = 0;
  let previousIndex = startIndex;
  const projections: Projection[] = [];
  const deviations: number[] = [];

  for (let index = startIndex; index < ride.length; index += 1) {
    const projection = projectOntoPolyline(
      rideXY[index],
      referenceXY,
      segment.referencePolyline,
    );
    projections.push(projection);
    deviations.push(projection.deviationMeters);
    maximumDeviation = Math.max(maximumDeviation, projection.deviationMeters);

    if (index > startIndex) {
      maximumGap = Math.max(maximumGap, ride[index].timestampMs - ride[previousIndex].timestampMs);
      if (projection.deviationMeters > segment.corridorMeters) {
        offCorridorTravel += distance(rideXY[previousIndex], rideXY[index]);
      }
    }

    maximumProgress = Math.max(maximumProgress, projection.progressMeters);
    maximumBackward = Math.max(maximumBackward, maximumProgress - projection.progressMeters);

    if (maximumBackward > MAX_BACKWARD_METERS) {
      return reject(
        startIndex,
        index,
        maximumBackward,
        maximumGap,
        maximumDeviation,
        median(deviations),
        ["backward-progress"],
      );
    }

    if (isAtEnd(rideXY[index], referenceXY.at(-1)!, projection, totalLength, segment)) {
      const points = rideXY.slice(startIndex, index + 1);
      const coveragePct = calculateCoverage(points, referenceXY, segment.corridorMeters);
      const significantDetour =
        offCorridorTravel > totalLength * (1 - segment.requiredCoveragePct) &&
        maximumDeviation > segment.corridorMeters * 2;

      if (significantDetour) {
        return reject(
          startIndex,
          index,
          maximumBackward,
          maximumGap,
          maximumDeviation,
          median(deviations),
          ["different-route"],
          coveragePct,
          offCorridorTravel,
        );
      }

      const reasons: string[] = [];
      if (coveragePct < segment.requiredCoveragePct) reasons.push("insufficient-coverage");
      if (maximumGap > MAX_GAP_MS) reasons.push("gps-gap");

      return {
        decision: reasons.length === 0 ? "accept" : "borderline",
        startPointIndex: startIndex,
        endPointIndex: index,
        coveragePct,
        maxBackwardMeters: maximumBackward,
        maxGapMs: maximumGap,
        maxDeviationMeters: maximumDeviation,
        medianDeviationMeters: median(deviations),
        reasons,
        offCorridorTravelMeters: offCorridorTravel,
      };
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

      results.push(
        reject(
          start,
          end,
          totalLength,
          maxTimestampGap(ride, start, end),
          0,
          0,
          ["reverse-traversal"],
        ),
      );
      break;
    }
  }
  return results;
}

function projectOntoPolyline(
  point: XY,
  polyline: readonly XY[],
  reference: readonly ReferencePoint[],
): Projection {
  let bestDeviation = Number.POSITIVE_INFINITY;
  let bestProgress = 0;

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const start = polyline[index];
    const end = polyline[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const rawT = lengthSquared === 0 ? 0 : ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    const t = Math.max(0, Math.min(1, rawT));
    const projected = { x: start.x + t * dx, y: start.y + t * dy };
    const deviation = distance(point, projected);
    if (deviation < bestDeviation) {
      bestDeviation = deviation;
      bestProgress =
        reference[index].distanceMeters +
        t * (reference[index + 1].distanceMeters - reference[index].distanceMeters);
    }
  }

  return { deviationMeters: bestDeviation, progressMeters: bestProgress };
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
    if (!kept.some((existing) => overlapRatio(candidate, existing) > DUPLICATE_OVERLAP_THRESHOLD)) {
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

function overlapRatio(left: MatchCandidate, right: MatchCandidate): number {
  const overlap =
    Math.max(0, Math.min(left.endPointIndex, right.endPointIndex) - Math.max(left.startPointIndex, right.startPointIndex) + 1);
  const shorter = Math.min(
    left.endPointIndex - left.startPointIndex + 1,
    right.endPointIndex - right.startPointIndex + 1,
  );
  return overlap / shorter;
}

function reject(
  startPointIndex: number,
  endPointIndex: number,
  maxBackwardMeters: number,
  maxGapMs: number,
  maxDeviationMeters: number,
  medianDeviationMeters: number,
  reasons: string[],
  coveragePct = 0,
  offCorridorTravelMeters = 0,
): EvaluatedCandidate {
  return {
    decision: "reject",
    startPointIndex,
    endPointIndex,
    coveragePct,
    maxBackwardMeters,
    maxGapMs,
    maxDeviationMeters,
    medianDeviationMeters,
    reasons,
    offCorridorTravelMeters,
  };
}

function maxTimestampGap(ride: readonly RidePoint[], start: number, end: number): number {
  let maximum = 0;
  for (let index = start + 1; index <= end; index += 1) {
    maximum = Math.max(maximum, ride[index].timestampMs - ride[index - 1].timestampMs);
  }
  return maximum;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
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
}
