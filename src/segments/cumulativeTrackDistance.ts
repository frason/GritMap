import type { RideTrackPoint } from "../db/getRideTrack.ts";
import { haversineDistanceMeters } from "./haversineDistance.ts";

export interface DistanceIndexedPoint {
  pointIndex: number;
  lat: number;
  lng: number;
  /** True cumulative haversine distance from the track's first point, in meters. */
  distanceMeters: number;
  elevationMeters?: number;
}

/**
 * Computes true cumulative haversine distance across a ride's GPS-present track points, for
 * the distance-based scrubber (docs/PLAN_segment_definition_increment.md) -- deliberately
 * not `ride_points.distance_meters` (the FIT device's own odometer reading), so the
 * scrubber's distance axis and resamplePolyline.ts's distance axis (which also uses
 * haversineDistanceMeters) stay internally consistent with each other.
 */
export function computeCumulativeTrackDistance(
  points: readonly RideTrackPoint[],
): DistanceIndexedPoint[] {
  let cumulative = 0;
  return points.map((point, index) => {
    if (index > 0) {
      cumulative += haversineDistanceMeters(points[index - 1]!, point);
    }
    return {
      pointIndex: point.pointIndex,
      lat: point.lat,
      lng: point.lng,
      distanceMeters: cumulative,
      ...(point.elevationMeters === undefined ? {} : { elevationMeters: point.elevationMeters }),
    };
  });
}

/** Finds the track point whose cumulative distance is closest to `targetDistanceMeters`. */
export function nearestByDistance(
  points: readonly DistanceIndexedPoint[],
  targetDistanceMeters: number,
): DistanceIndexedPoint | undefined {
  let best: DistanceIndexedPoint | undefined;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const diff = Math.abs(point.distanceMeters - targetDistanceMeters);
    if (diff < bestDiff) {
      best = point;
      bestDiff = diff;
    }
  }
  return best;
}
