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
  maxGapImpliedSpeedMetersPerSec: number;
  reasons: readonly string[];
}

/** Bump whenever matching decisions, diagnostics, or confidence scoring change. */
export const MATCHER_VERSION = 3;

const EARTH_RADIUS_METERS = 6_371_008.8;
const MAX_BACKWARD_METERS = 30;
const MAX_GAP_MS = 30_000;

/**
 * A gap's raw duration says little about whether it's actually suspicious: a five-minute
 * dropout under tree cover that resumes exactly where a normal cycling pace would put the
 * rider is benign, while a much shorter one that implies an impossible jump is a real red
 * flag. 20 m/s (72 km/h) is a generous ceiling even for a fast descent -- full credit below
 * it, fully zeroed out at double this (144 km/h, clearly not a bike).
 */
const PLAUSIBLE_GAP_SPEED_METERS_PER_SEC = 20;

/**
 * Produces a diagnostic confidence fraction from five independently bounded components:
 * coverage (35%), direction/order (20%), corridor adherence (20%), backward movement
 * (10%), and GPS continuity (15%, based on gap *plausibility* -- see
 * PLAUSIBLE_GAP_SPEED_METERS_PER_SEC -- not raw gap duration). Match decisions remain
 * authoritative and are not derived from this score.
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
  const continuity = 1 - clamp01(
    Math.max(0, input.maxGapImpliedSpeedMetersPerSec - PLAUSIBLE_GAP_SPEED_METERS_PER_SEC) /
      PLAUSIBLE_GAP_SPEED_METERS_PER_SEC,
  );

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
  /** Index of the polyline segment (start point) this projection landed on -- internal-only,
   *  used to window the next point's search instead of rescanning the whole polyline. */
  segmentIndex: number;
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
  let maximumGapImpliedSpeed = 0;
  let maximumDeviation = 0;
  let offCorridorTravel = 0;
  let previousIndex = startIndex;
  // A candidate always starts near the segment's own beginning (the outer loop only calls
  // evaluateForward when the ride point is within corridorMeters of referenceXY[0]), so 0 is
  // a safe expectation for the very first projection too, not just a "no hint yet" sentinel.
  let previousProgressMeters = 0;
  let previousSegmentIndex = 0;
  const projections: Projection[] = [];

  for (let index = startIndex; index < ride.length; index += 1) {
    const progressBeforeThisPoint = previousProgressMeters;
    const projection = projectOntoPolyline(
      rideXY[index],
      referenceXY,
      segment.referencePolyline,
      previousSegmentIndex,
      previousProgressMeters,
    );
    previousProgressMeters = projection.progressMeters;
    previousSegmentIndex = projection.segmentIndex;
    projections.push(projection);
    maximumDeviation = Math.max(maximumDeviation, projection.deviationMeters);

    if (index > startIndex) {
      const gapMs = ride[index].timestampMs - ride[previousIndex].timestampMs;
      maximumGap = Math.max(maximumGap, gapMs);
      if (gapMs > MAX_GAP_MS) {
        gpsGapCount += 1;
        // How fast the rider would have had to travel to cover this progress during the
        // gap -- a long dropout that resumes right where a normal cycling pace would put
        // the rider (e.g. under tree cover or in a tunnel) is much less suspicious than a
        // short one that implies an impossible jump. See calculateConfidenceScore's
        // continuity term, which penalizes this instead of raw gap duration.
        const impliedSpeed = Math.abs(projection.progressMeters - progressBeforeThisPoint) / (gapMs / 1000);
        maximumGapImpliedSpeed = Math.max(maximumGapImpliedSpeed, impliedSpeed);
      }
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
        maxGapImpliedSpeedMetersPerSec: maximumGapImpliedSpeed,
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
          maxGapImpliedSpeedMetersPerSec: maximumGapImpliedSpeed,
          deviationsMeters: projections.map((item) => item.deviationMeters),
          reasons: ["different-route"],
          segment,
          offCorridorTravelMeters: offCorridorTravel,
        });
      }

      const reasons: string[] = [];
      if (coveragePct < segment.requiredCoveragePct) reasons.push("insufficient-coverage");
      // A gap is only flagged as a reason for uncertainty when it implies an unreasonable
      // pace, not merely because it was long -- a real dropout under tree cover or in a
      // tunnel that resumes right where a normal cycling speed would put the rider isn't
      // actually suspicious, however long it lasted.
      if (maximumGapImpliedSpeed > PLAUSIBLE_GAP_SPEED_METERS_PER_SEC) reasons.push("implausible-gap-speed");

      return createCandidate({
        decision: reasons.length === 0 ? "accept" : "borderline",
        startPointIndex: sourceIndexOf(ride, startIndex),
        endPointIndex: sourceIndexOf(ride, index),
        coveragePct,
        maxBackwardMeters: maximumBackward,
        maxGapMs: maximumGap,
        gpsGapCount,
        maxGapImpliedSpeedMetersPerSec: maximumGapImpliedSpeed,
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
      const startProjection = projectOntoPolyline(rideXY[start], referenceXY, segment.referencePolyline);
      const endProjection = projectOntoPolyline(rideXY[end], referenceXY, segment.referencePolyline);
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
        // Reverse-traversal candidates are always rejected and never persisted (see
        // persistMatchCandidate.ts), so their confidence score is never actually read --
        // not worth computing implied gap speed for a value nothing consumes.
        maxGapImpliedSpeedMetersPerSec: 0,
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
 *
 * This margin must stay tight (a few meters, not corridorMeters-wide): on any ordinary
 * stretch of route, consecutive resampled reference points can be within corridorMeters of
 * each other too, just because they're close together along the same line -- a wide margin
 * mistakes that for hairpin ambiguity and blocks genuine backward-progress detection
 * (matchSegment.test.ts's "genuine mid-ride reversal" case). A tight absolute margin only
 * catches the case this exists for: near-zero-deviation candidates at very different
 * progress values, which only happens when the route is truly close to itself.
 */
const PROJECTION_AMBIGUITY_MARGIN_METERS = 5;

/**
 * How many polyline segments on either side of the previous point's match to search before
 * falling back to a full scan. Generous enough to absorb a real GPS gap: even at a fast
 * 20 m/s with a 30s dropout (the matcher's own gap tolerance), the rider covers ~600m, i.e.
 * ~60 resampled 10m reference points -- this leaves more than double that as slack.
 */
const PROJECTION_WINDOW_RADIUS = 150;

function projectOntoPolyline(
  point: XY,
  polyline: readonly XY[],
  reference: readonly ReferencePoint[],
  previousSegmentIndex?: number,
  previousProgressMeters?: number,
): Projection {
  // A real ride/segment pair can be thousands of points long on each side; scanning the
  // *entire* reference polyline for every single ride point is the actual cost that made
  // "Rerun matcher" freeze the app on a real device (measured: 8563 ride points x 4066
  // reference points, ~35M inner iterations per matched ride, taking 2-13s depending on the
  // exact algorithm -- far too slow for a button tap on a phone's JS thread). Searching only
  // a window around where the previous point landed cuts that by ~25x for a 4000+ point
  // segment, with a full-scan fallback if nothing plausible turns up in the window (a real
  // gap bigger than PROJECTION_WINDOW_RADIUS allows, or the very first point of a scan).
  if (previousSegmentIndex !== undefined) {
    const lowIndex = Math.max(0, previousSegmentIndex - PROJECTION_WINDOW_RADIUS);
    const highIndex = Math.min(polyline.length - 2, previousSegmentIndex + PROJECTION_WINDOW_RADIUS);
    const windowed = scanRange(point, polyline, reference, lowIndex, highIndex, previousProgressMeters);
    if (windowed.deviationMeters <= PROJECTION_AMBIGUITY_MARGIN_METERS) {
      return windowed;
    }
    // Nothing plausible in the window -- a real gap moved the rider further than expected,
    // or this segment genuinely isn't near where the previous point was. Fall through to a
    // full scan rather than silently returning a wrong, merely-in-window candidate.
  }
  return scanRange(point, polyline, reference, 0, polyline.length - 2, previousProgressMeters);
}

/** Scans polyline segments [lowIndex, highIndex] inclusive; allocation-free per iteration. */
function scanRange(
  point: XY,
  polyline: readonly XY[],
  reference: readonly ReferencePoint[],
  lowIndex: number,
  highIndex: number,
  previousProgressMeters: number | undefined,
): Projection {
  let bestDeviation = Number.POSITIVE_INFINITY;
  let bestProgress = 0;
  let bestIndex = lowIndex;
  let biasedDeviation = Number.POSITIVE_INFINITY;
  let biasedProgress = 0;
  let biasedIndex = lowIndex;
  let biasedProgressGap = Number.POSITIVE_INFINITY;
  let hasBiasedCandidate = false;

  for (let index = lowIndex; index <= highIndex; index += 1) {
    const start = polyline[index];
    const end = polyline[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const rawT =
      lengthSquared === 0 ? 0 : ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    const t = Math.max(0, Math.min(1, rawT));
    const deviation = Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));

    // progress is only computed when actually needed (a new best, or a candidate within the
    // ambiguity margin) -- both are rare within any given window, so this avoids the
    // multiply-add on most iterations.
    if (deviation < bestDeviation) {
      bestDeviation = deviation;
      bestIndex = index;
      bestProgress =
        reference[index].distanceMeters + t * (reference[index + 1].distanceMeters - reference[index].distanceMeters);
    }
    if (previousProgressMeters !== undefined && deviation <= PROJECTION_AMBIGUITY_MARGIN_METERS) {
      const progress =
        reference[index].distanceMeters + t * (reference[index + 1].distanceMeters - reference[index].distanceMeters);
      const progressGap = Math.abs(progress - previousProgressMeters);
      if (progressGap < biasedProgressGap) {
        biasedProgressGap = progressGap;
        biasedDeviation = deviation;
        biasedProgress = progress;
        biasedIndex = index;
        hasBiasedCandidate = true;
      }
    }
  }

  return hasBiasedCandidate
    ? { deviationMeters: biasedDeviation, progressMeters: biasedProgress, segmentIndex: biasedIndex }
    : { deviationMeters: bestDeviation, progressMeters: bestProgress, segmentIndex: bestIndex };
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
  maxGapImpliedSpeedMetersPerSec: number;
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
    maxGapImpliedSpeedMetersPerSec: metrics.maxGapImpliedSpeedMetersPerSec,
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
