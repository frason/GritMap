export interface LatLngBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface DistancePoint {
  lat: number;
  lng: number;
  distanceMeters: number;
}

export interface DistanceRange {
  minDistanceMeters: number;
  maxDistanceMeters: number;
}

/**
 * Maps a map viewport (lat/lng bounding box) onto the ride's own distance axis, so zooming
 * the map can zoom an elevation-vs-distance chart to the matching section -- a simple
 * bounding-box filter over the track's points, not polygon/great-circle math; good enough
 * for "zoom in here, see that section's elevation." Returns undefined when no point falls
 * inside the bounds (e.g. the user panned away from the route entirely) so the caller can
 * choose to keep showing whatever range it last had rather than collapsing to nothing.
 */
export function computeVisibleDistanceRange(
  points: readonly DistancePoint[],
  bounds: LatLngBounds,
): DistanceRange | undefined {
  let minDistanceMeters: number | undefined;
  let maxDistanceMeters: number | undefined;

  for (const point of points) {
    if (point.lat < bounds.south || point.lat > bounds.north) continue;
    if (point.lng < bounds.west || point.lng > bounds.east) continue;
    if (minDistanceMeters === undefined || point.distanceMeters < minDistanceMeters) {
      minDistanceMeters = point.distanceMeters;
    }
    if (maxDistanceMeters === undefined || point.distanceMeters > maxDistanceMeters) {
      maxDistanceMeters = point.distanceMeters;
    }
  }

  return minDistanceMeters === undefined || maxDistanceMeters === undefined
    ? undefined
    : { minDistanceMeters, maxDistanceMeters };
}
