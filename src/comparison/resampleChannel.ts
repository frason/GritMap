export interface ResamplePoint {
  distanceMeters: number;
  timestampMs: number;
  power?: number;
  heartRate?: number;
  elevationMeters?: number;
}

export type NumericChannel = "power" | "heartRate" | "elevationMeters";

const DISTANCE_EPSILON_METERS = 1e-7;

/**
 * The single distance-alignment toolkit for one attempt's points, shared by
 * compareAttempts.ts (two attempts, paired) and computeHistoricalBand.ts (many attempts,
 * banded) so both reuse the exact same gap-aware interpolation rather than each
 * reimplementing it. Deliberately performs no display smoothing.
 */
export function preparePoints<T extends ResamplePoint>(points: readonly T[]): T[] {
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

export function interpolateTimestamp(
  points: readonly ResamplePoint[],
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

export function interpolateChannel(
  points: readonly ResamplePoint[],
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

export function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
}
