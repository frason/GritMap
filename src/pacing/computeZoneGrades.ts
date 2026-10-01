import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";

/** A quarter mile, matching the companion Karoo app's existing pacing-plan zone length. */
export const QUARTER_MILE_METERS = 402.875;

/**
 * Below this, a trailing remainder zone merges into the previous one instead of standing
 * alone -- matches the 10m resample-grid interval (docs/MVP.md), so a near-empty trailing
 * zone can never be an artifact of resampling granularity alone.
 */
const MIN_FINAL_ZONE_METERS = 10;

export interface ZoneWindow {
  startDistanceMeters: number;
  endDistanceMeters: number;
  gradePct: number;
}

/**
 * Chunks a segment's (already 10m-resampled) reference polyline into fixed-length zones
 * and computes each zone's average grade. The final zone ends at the polyline's exact
 * total distance -- never rounded up to the next full zone -- and a remainder shorter
 * than the resample interval folds into the previous zone rather than standing alone.
 */
export function computeZoneGrades(
  referencePolyline: readonly SegmentReferencePoint[],
  zoneLengthMeters: number = QUARTER_MILE_METERS,
): ZoneWindow[] {
  if (referencePolyline.length === 0) return [];
  const totalDistanceMeters = referencePolyline[referencePolyline.length - 1]!.distanceMeters;
  if (totalDistanceMeters <= 0) return [];

  const boundaries: number[] = [0];
  for (let next = zoneLengthMeters; next < totalDistanceMeters; next += zoneLengthMeters) {
    boundaries.push(next);
  }
  boundaries.push(totalDistanceMeters);

  if (
    boundaries.length >= 3 &&
    boundaries[boundaries.length - 1]! - boundaries[boundaries.length - 2]! < MIN_FINAL_ZONE_METERS
  ) {
    boundaries.splice(boundaries.length - 2, 1);
  }

  const zones: ZoneWindow[] = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const startDistanceMeters = boundaries[i]!;
    const endDistanceMeters = boundaries[i + 1]!;
    zones.push({
      startDistanceMeters,
      endDistanceMeters,
      gradePct: computeGradePct(referencePolyline, startDistanceMeters, endDistanceMeters),
    });
  }
  return zones;
}

/**
 * Grade = (sum of elevation deltas across the portion of each leg that overlaps this
 * window, for legs where both endpoints have elevation data) / (the window's full
 * nominal length, not just the elevation-covered portion). Splitting each leg's delta
 * proportionally at the window boundary avoids double-counting the same rise on both
 * sides of a boundary that falls mid-leg (zone length isn't a multiple of the 10m
 * resample interval, so this is the common case, not an edge case). Dividing by the full
 * window length -- rather than only the covered length -- dilutes the grade toward 0 in
 * proportion to missing elevation coverage, and yields exactly 0 when a window has no
 * elevation data at all.
 */
function computeGradePct(
  referencePolyline: readonly SegmentReferencePoint[],
  windowStart: number,
  windowEnd: number,
): number {
  const windowLength = windowEnd - windowStart;
  if (windowLength <= 0) return 0;

  let totalRise = 0;
  for (let i = 1; i < referencePolyline.length; i += 1) {
    const previous = referencePolyline[i - 1]!;
    const current = referencePolyline[i]!;
    if (previous.elevationMeters === undefined || current.elevationMeters === undefined) continue;

    const legStart = previous.distanceMeters;
    const legEnd = current.distanceMeters;
    const overlapStart = Math.max(legStart, windowStart);
    const overlapEnd = Math.min(legEnd, windowEnd);
    if (overlapStart >= overlapEnd || legEnd <= legStart) continue;

    const elevationAt = (distanceMeters: number) =>
      previous.elevationMeters! +
      ((distanceMeters - legStart) / (legEnd - legStart)) *
        (current.elevationMeters! - previous.elevationMeters!);

    totalRise += elevationAt(overlapEnd) - elevationAt(overlapStart);
  }
  return (totalRise / windowLength) * 100;
}
