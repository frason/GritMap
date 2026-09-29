import {
  assertPositiveFinite,
  interpolateChannel,
  preparePoints,
  type NumericChannel,
} from "./resampleChannel.ts";
import type { SegmentAttempt } from "./compareAttempts.ts";

export interface HistoricalBandSample {
  distanceMeters: number;
  /** Minimum value across every attempt's data at this distance, or null if none has data here. */
  min: number | null;
  /** Maximum value across every attempt's data at this distance, or null if none has data here. */
  max: number | null;
  /** The current attempt's own value at this distance, so it can be drawn on top of the band. */
  current: number | null;
}

export interface ComputeHistoricalBandOptions {
  stepMeters?: number;
  maxInterpolationGapMs?: number;
}

const DEFAULT_STEP_METERS = 10;
const DEFAULT_MAX_INTERPOLATION_GAP_MS = 30_000;
const DISTANCE_EPSILON_METERS = 1e-7;

/**
 * A specific attempt (typically the most recent) plotted against the min-max range of
 * every other valid attempt on the same segment, per docs/Grip-Map-app-spec.md's "Post-MVP:
 * Historical Trend Comparison View" -- the "historical band" variant, preferred there over
 * a spaghetti plot of every individual line. Reuses the exact same distance-alignment
 * toolkit compareAttempts.ts uses for its two-attempt case, generalized to N attempts here.
 */
export function computeHistoricalBand(
  attempts: readonly SegmentAttempt[],
  currentAttemptId: string,
  channel: NumericChannel,
  options: ComputeHistoricalBandOptions = {},
): HistoricalBandSample[] {
  const stepMeters = options.stepMeters ?? DEFAULT_STEP_METERS;
  const maxGapMs = options.maxInterpolationGapMs ?? DEFAULT_MAX_INTERPOLATION_GAP_MS;
  assertPositiveFinite(stepMeters, "stepMeters");
  assertPositiveFinite(maxGapMs, "maxInterpolationGapMs");

  if (attempts.length === 0) return [];
  const segmentId = attempts[0]!.segmentId;
  if (attempts.some((attempt) => attempt.segmentId !== segmentId)) {
    throw new Error("Every attempt must belong to the same segment");
  }
  const current = attempts.find((attempt) => attempt.id === currentAttemptId);
  if (current === undefined) {
    throw new Error(`currentAttemptId ${currentAttemptId} is not one of the given attempts`);
  }

  const preparedByAttempt = attempts.map((attempt) => preparePoints(attempt.points));
  const nonEmpty = preparedByAttempt.filter((points) => points.length > 0);
  if (nonEmpty.length === 0) return [];

  // The band only covers distance every attempt actually reaches -- matches
  // compareAttempts.ts's own "stop at the shorter attempt, never extrapolate" rule,
  // generalized from two attempts to N.
  const sharedDistance = Math.min(...nonEmpty.map((points) => points[points.length - 1]!.distanceMeters));
  if (sharedDistance < 0) return [];

  const currentPoints = preparePoints(current.points);
  const sampleCount = Math.floor((sharedDistance + DISTANCE_EPSILON_METERS) / stepMeters);
  const samples: HistoricalBandSample[] = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    const distanceMeters = index * stepMeters;
    const values = preparedByAttempt
      .map((points) => interpolateChannel(points, distanceMeters, channel, maxGapMs))
      .filter((value): value is number => value !== null);

    samples.push({
      distanceMeters,
      min: values.length === 0 ? null : Math.min(...values),
      max: values.length === 0 ? null : Math.max(...values),
      current: interpolateChannel(currentPoints, distanceMeters, channel, maxGapMs),
    });
  }

  return samples;
}
