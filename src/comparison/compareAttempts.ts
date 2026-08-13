export interface RidePoint {
  /** Cumulative distance from the segment start. */
  distanceMeters: number;
  /** Wall-clock timestamp from the FIT file. */
  timestampMs: number;
  power?: number;
  heartRate?: number;
  elevationMeters?: number;
}

export interface SegmentAttempt {
  id: string;
  segmentId: string;
  rideId: string;
  startTimestampMs: number;
  endTimestampMs: number;
  /** Points already sliced to this attempt's range, in distance order. */
  points: RidePoint[];
}

export interface ComparisonSample {
  distanceMeters: number;
  /** Primary elapsed time minus comparison elapsed time. Positive means primary is behind. */
  timeGapMs: number | null;
  primaryPower: number | null;
  comparisonPower: number | null;
  primaryHeartRate: number | null;
  comparisonHeartRate: number | null;
  primaryElevation: number | null;
  comparisonElevation: number | null;
}

export interface CompareAttemptsOptions {
  stepMeters?: number;
  maxInterpolationGapMs?: number;
}

type NumericChannel = "power" | "heartRate" | "elevationMeters";

const DEFAULT_STEP_METERS = 10;
const DEFAULT_MAX_INTERPOLATION_GAP_MS = 30_000;
const DISTANCE_EPSILON_METERS = 1e-7;

/**
 * Produces unsmoothed, distance-aligned data for charting two attempts.
 * This function deliberately performs no display smoothing: derived values must remain
 * reproducible from the raw FIT samples. A chart may smooth a copy of the result.
 */
export function compareAttempts(
  primary: SegmentAttempt,
  comparison: SegmentAttempt,
  options: CompareAttemptsOptions = {},
): ComparisonSample[] {
  const stepMeters = options.stepMeters ?? DEFAULT_STEP_METERS;
  const maxGapMs = options.maxInterpolationGapMs ?? DEFAULT_MAX_INTERPOLATION_GAP_MS;

  assertPositiveFinite(stepMeters, "stepMeters");
  assertPositiveFinite(maxGapMs, "maxInterpolationGapMs");
  if (primary.segmentId !== comparison.segmentId) {
    throw new Error("Attempts must belong to the same segment");
  }

  const primaryPoints = preparePoints(primary.points);
  const comparisonPoints = preparePoints(comparison.points);
  if (primaryPoints.length === 0 || comparisonPoints.length === 0) {
    return [];
  }

  const sharedDistance = Math.min(
    primaryPoints[primaryPoints.length - 1].distanceMeters,
    comparisonPoints[comparisonPoints.length - 1].distanceMeters,
  );
  if (sharedDistance < 0) {
    return [];
  }

  const samples: ComparisonSample[] = [];
  const sampleCount = Math.floor((sharedDistance + DISTANCE_EPSILON_METERS) / stepMeters);

  for (let index = 0; index <= sampleCount; index += 1) {
    const distanceMeters = index * stepMeters;
    const primaryTimestamp = interpolateTimestamp(primaryPoints, distanceMeters, maxGapMs);
    const comparisonTimestamp = interpolateTimestamp(comparisonPoints, distanceMeters, maxGapMs);

    samples.push({
      distanceMeters,
      timeGapMs:
        primaryTimestamp === null || comparisonTimestamp === null
          ? null
          : primaryTimestamp - primary.startTimestampMs -
            (comparisonTimestamp - comparison.startTimestampMs),
      primaryPower: interpolateChannel(primaryPoints, distanceMeters, "power", maxGapMs),
      comparisonPower: interpolateChannel(comparisonPoints, distanceMeters, "power", maxGapMs),
      primaryHeartRate: interpolateChannel(primaryPoints, distanceMeters, "heartRate", maxGapMs),
      comparisonHeartRate: interpolateChannel(
        comparisonPoints,
        distanceMeters,
        "heartRate",
        maxGapMs,
      ),
      primaryElevation: interpolateChannel(
        primaryPoints,
        distanceMeters,
        "elevationMeters",
        maxGapMs,
      ),
      comparisonElevation: interpolateChannel(
        comparisonPoints,
        distanceMeters,
        "elevationMeters",
        maxGapMs,
      ),
    });
  }

  return samples;
}

function preparePoints(points: readonly RidePoint[]): RidePoint[] {
  const prepared = points.map((point) => ({ ...point }));
  prepared.sort((left, right) =>
    left.distanceMeters === right.distanceMeters
      ? left.timestampMs - right.timestampMs
      : left.distanceMeters - right.distanceMeters,
  );

  for (const point of prepared) {
    if (!Number.isFinite(point.distanceMeters) || point.distanceMeters < 0) {
      throw new Error("Ride-point distances must be finite and non-negative");
    }
    if (!Number.isFinite(point.timestampMs)) {
      throw new Error("Ride-point timestamps must be finite");
    }
  }

  return prepared;
}

function interpolateTimestamp(
  points: readonly RidePoint[],
  distanceMeters: number,
  maxGapMs: number,
): number | null {
  return interpolateObservations(
    points.map((point) => ({
      distanceMeters: point.distanceMeters,
      timestampMs: point.timestampMs,
      value: point.timestampMs,
    })),
    distanceMeters,
    maxGapMs,
  );
}

function interpolateChannel(
  points: readonly RidePoint[],
  distanceMeters: number,
  channel: NumericChannel,
  maxGapMs: number,
): number | null {
  const observations = points.flatMap((point) => {
    const value = point[channel];
    return value === undefined || !Number.isFinite(value)
      ? []
      : [{ distanceMeters: point.distanceMeters, timestampMs: point.timestampMs, value }];
  });

  return interpolateObservations(observations, distanceMeters, maxGapMs);
}

interface Observation {
  distanceMeters: number;
  timestampMs: number;
  value: number;
}

function interpolateObservations(
  observations: readonly Observation[],
  targetDistance: number,
  maxGapMs: number,
): number | null {
  if (observations.length === 0) {
    return null;
  }

  const upperIndex = lowerBound(observations, targetDistance);
  const upper = observations[upperIndex];
  if (upper !== undefined && approximatelyEqual(upper.distanceMeters, targetDistance)) {
    return upper.value;
  }
  if (upperIndex === 0 || upperIndex === observations.length) {
    return null;
  }

  const lower = observations[upperIndex - 1];
  if (Math.abs(upper.timestampMs - lower.timestampMs) > maxGapMs) {
    return null;
  }

  const distanceSpan = upper.distanceMeters - lower.distanceMeters;
  if (distanceSpan <= DISTANCE_EPSILON_METERS) {
    return null;
  }

  const ratio = (targetDistance - lower.distanceMeters) / distanceSpan;
  return lower.value + ratio * (upper.value - lower.value);
}

function lowerBound(observations: readonly Observation[], targetDistance: number): number {
  let low = 0;
  let high = observations.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (observations[middle].distanceMeters < targetDistance - DISTANCE_EPSILON_METERS) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= DISTANCE_EPSILON_METERS;
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
}
