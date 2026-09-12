import { haversineDistanceMeters, type LatLng } from "./haversineDistance.ts";

export interface DistanceIndexedLatLng extends LatLng {
  distanceMeters: number;
}

/**
 * Finds the track point geographically closest to `target` by true haversine distance.
 * Used to snap a map tap (RouteMapView.native.tsx's segment-editing mode, issue #58) onto
 * the actual route, rather than trusting the tapped coordinate's own precision. A plain
 * linear scan is fine here -- this runs once per tap, not per frame, even against a
 * multi-thousand-point ride track.
 */
export function nearestTrackPointByLatLng<T extends DistanceIndexedLatLng>(
  points: readonly T[],
  target: LatLng,
): T | undefined {
  let best: T | undefined;
  let bestDistanceMeters = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const distanceMeters = haversineDistanceMeters(point, target);
    if (distanceMeters < bestDistanceMeters) {
      bestDistanceMeters = distanceMeters;
      best = point;
    }
  }
  return best;
}
