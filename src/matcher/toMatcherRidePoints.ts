import type { RidePoint } from "./matchSegment.ts";

/**
 * The minimum shape needed to build matcher input from a source point array — parsed FIT
 * records (`ParsedPoint`) and persisted `ride_points` rows both satisfy this.
 */
export interface SourcePoint {
  timestampMs: number;
  lat?: number;
  lng?: number;
}

/**
 * The single production mapping from an ordered source-point array (parsed FIT records, or
 * `ride_points` rows loaded in `point_index` order) onto matcher input.
 *
 * Points without GPS coordinates are removed, exactly like earlier ad hoc filtering, but the
 * point's position in `points` — which is also `ride_points.point_index` after import — is
 * preserved on `sourcePointIndex`. `matchSegment` echoes this value back on
 * `MatchCandidate.startPointIndex` / `endPointIndex`, so callers must always build matcher
 * input through this function (not their own filter) to keep matcher output, persisted
 * `segment_attempts` boundaries, and the original `ride_points` row in agreement.
 */
export function toMatcherRidePoints(points: readonly SourcePoint[]): RidePoint[] {
  const output: RidePoint[] = [];
  points.forEach((point, sourcePointIndex) => {
    if (point.lat === undefined || point.lng === undefined) return;
    output.push({
      lat: point.lat,
      lng: point.lng,
      timestampMs: point.timestampMs,
      sourcePointIndex,
    });
  });
  return output;
}
