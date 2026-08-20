import { haversineDistanceMeters, type LatLng } from "./haversineDistance.ts";

export interface ResamplePoint extends LatLng {
  elevationMeters?: number;
}

export interface SegmentReferencePoint extends LatLng {
  distanceMeters: number;
  elevationMeters?: number;
}

/**
 * Resamples a ride's point range onto a fixed-interval distance axis (10m per
 * docs/MVP.md), for storage as a segment's directed reference polyline. Always emits a
 * point at distance 0 and one at the exact final endpoint (even when the total isn't a
 * multiple of `intervalMeters`), with no duplicate-distance points and no zero-length
 * trailing segment. Elevation is linearly interpolated only when both bracketing source
 * points have it, otherwise omitted -- matching the "missing sensor data stays missing"
 * rule used throughout persistImportedRide.ts.
 */
export function resamplePolyline(
  points: readonly ResamplePoint[],
  intervalMeters: number,
): SegmentReferencePoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [toReferencePoint(points[0], 0)];

  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumulative.push(cumulative[i - 1] + haversineDistanceMeters(points[i - 1], points[i]));
  }
  const totalDistanceMeters = cumulative[cumulative.length - 1];

  const output: SegmentReferencePoint[] = [];
  let legStartIndex = 0;
  let stationDistance = 0;

  while (stationDistance <= totalDistanceMeters) {
    while (
      legStartIndex < points.length - 2 &&
      cumulative[legStartIndex + 1] < stationDistance
    ) {
      legStartIndex += 1;
    }
    output.push(interpolateAt(points, cumulative, legStartIndex, stationDistance));
    stationDistance += intervalMeters;
  }

  const lastEmittedDistance = output[output.length - 1]?.distanceMeters ?? -1;
  if (lastEmittedDistance < totalDistanceMeters) {
    output.push(toReferencePoint(points[points.length - 1], totalDistanceMeters));
  }

  return output;
}

function interpolateAt(
  points: readonly ResamplePoint[],
  cumulative: readonly number[],
  legStartIndex: number,
  targetDistanceMeters: number,
): SegmentReferencePoint {
  const start = points[legStartIndex];
  const end = points[legStartIndex + 1];
  const legStart = cumulative[legStartIndex];
  const legEnd = cumulative[legStartIndex + 1];
  const legLength = legEnd - legStart;
  const t = legLength > 0 ? clamp01((targetDistanceMeters - legStart) / legLength) : 0;

  const lat = start.lat + t * (end.lat - start.lat);
  const lng = start.lng + t * (end.lng - start.lng);
  const elevationMeters =
    start.elevationMeters !== undefined && end.elevationMeters !== undefined
      ? start.elevationMeters + t * (end.elevationMeters - start.elevationMeters)
      : undefined;

  return {
    lat,
    lng,
    distanceMeters: targetDistanceMeters,
    ...(elevationMeters === undefined ? {} : { elevationMeters }),
  };
}

function toReferencePoint(point: ResamplePoint, distanceMeters: number): SegmentReferencePoint {
  return {
    lat: point.lat,
    lng: point.lng,
    distanceMeters,
    ...(point.elevationMeters === undefined ? {} : { elevationMeters: point.elevationMeters }),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
