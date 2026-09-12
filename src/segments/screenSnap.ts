export interface DistanceIndexedLatLng {
  lat: number;
  lng: number;
  distanceMeters: number;
}

/**
 * Picks up to maxPoints candidates evenly spaced by array position from `points`, always
 * including the first and last. Used to bound how many points RouteMapView.native.tsx's
 * on-map drag handles project onto screen coordinates (via MapLibre's native project()
 * bridge call) on every map pan/zoom -- projecting every raw GPS point (thousands, for a
 * multi-hour ride) would mean thousands of native round trips each time the viewport
 * settles, regardless of ride length.
 */
export function sampleForHandleSnapping<T extends DistanceIndexedLatLng>(
  points: readonly T[],
  maxPoints: number,
): T[] {
  if (points.length <= maxPoints) return [...points];
  if (maxPoints <= 1) return points.length > 0 ? [points[points.length - 1]!] : [];

  const result: T[] = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.min(Math.round(i * step), points.length - 1);
    result.push(points[index]!);
  }
  return result;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ScreenSnapCandidate extends ScreenPoint {
  distanceMeters: number;
}

/**
 * Finds the candidate closest to `query` in screen space (plain 2D Euclidean distance, no
 * geographic math -- the candidates are already projected screen coordinates). Used during
 * an active drag gesture so a handle's new position snaps to an actual point along the
 * track, entirely in JS with no native calls mid-drag (see sampleForHandleSnapping's doc).
 * Returns the whole candidate (not just its distanceMeters) so the caller can also snap the
 * handle's *visual* position onto the matched point on the route line, rather than leaving
 * it floating wherever the finger happens to be.
 */
export function nearestScreenSnapCandidate(
  candidates: readonly ScreenSnapCandidate[],
  query: ScreenPoint,
): ScreenSnapCandidate | undefined {
  let best: ScreenSnapCandidate | undefined;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const dx = candidate.x - query.x;
    const dy = candidate.y - query.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      best = candidate;
    }
  }
  return best;
}
