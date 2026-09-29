import {
  assertPositiveFinite,
  interpolateChannel,
  interpolateTimestamp,
  preparePoints,
} from "./resampleChannel.ts";

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
