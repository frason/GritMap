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

/**
 * Interpolation is called once per sample step (hundreds to thousands of times per attempt) on the
 * same prepared array, and each call used to rebuild its observation list from every ride point:
 * about 7.5 s for the three-channel historical band on three 2,500-point efforts. The list depends
 * only on the (never mutated) prepared array and the channel, so it is built once per array.
 * Keyed by array identity in a WeakMap: a new or changed array is a new key, and nothing is retained
 * once the array is garbage-collected.
 */
const observationCache = new WeakMap<readonly ResamplePoint[], Map<string, Observation[]>>();

function observationsFor(points: readonly ResamplePoint[], channel: NumericChannel | "timestamp"): Observation[] {
  let byChannel = observationCache.get(points);
  if (byChannel === undefined) {
    byChannel = new Map();
    observationCache.set(points, byChannel);
  }
  let observations = byChannel.get(channel);
  if (observations === undefined) {
    observations =
      channel === "timestamp"
        ? points.map((point) => ({ distanceMeters: point.distanceMeters, timestampMs: point.timestampMs, value: point.timestampMs }))
        : points.flatMap((point) => {
            const value = point[channel];
            return value === undefined || !Number.isFinite(value)
              ? []
              : [{ distanceMeters: point.distanceMeters, timestampMs: point.timestampMs, value }];
          });
    byChannel.set(channel, observations);
  }
  return observations;
}

export function interpolateTimestamp(
  points: readonly ResamplePoint[],
  distanceMeters: number,
  maxGapMs: number,
): number | null {
  return interpolateObservations(observationsFor(points, "timestamp"), distanceMeters, maxGapMs);
}

export function interpolateChannel(
  points: readonly ResamplePoint[],
  distanceMeters: number,
  channel: NumericChannel,
  maxGapMs: number,
): number | null {
  return interpolateObservations(observationsFor(points, channel), distanceMeters, maxGapMs);
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
