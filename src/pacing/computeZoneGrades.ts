import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";

/** A quarter mile -- the explicit-length default of computeZoneGrades, kept for callers/tests that pin a length. */
export const QUARTER_MILE_METERS = 402.875;

/**
 * Candidate zone lengths for computeAdaptiveZoneGrades. 402.336m / 804.672m are exact
 * quarter / half miles (matching the Karoo's own live-split unit, ActiveAttemptSession.kt's
 * QUARTER_MILE_METERS); 100m is the Karoo climber feature's resolution and the floor, so a
 * short segment still gets several zones.
 */
export const ZONE_LENGTH_CHOICES_METERS = [100, 200, 402.336, 804.672] as const;

/** Aim for roughly this many zones, then snap the resulting length to the nearest choice. */
const TARGET_ZONE_COUNT = 20;

/**
 * Below this, a trailing remainder zone merges into the previous one instead of standing
 * alone: at least the 10m resample-grid interval (docs/MVP.md), or 10% of the zone length
 * for longer zones, so a sliver of a zone is never emitted.
 */
const MIN_FINAL_ZONE_METERS = 10;
const MIN_FINAL_ZONE_FRACTION = 0.1;

export interface ZoneWindow {
  startDistanceMeters: number;
  endDistanceMeters: number;
  gradePct: number;
}

/**
 * Picks a zone length that scales with the segment: aim for ~20 zones, then snap to the
 * nearest (in log terms) of 100m / 200m / quarter mile / half mile. A half-mile segment
 * gets 100m zones (8 of them) instead of two quarter-mile ones; a 6.5-mile climb gets
 * quarter-mile zones (~26); a very long one tops out at half-mile zones.
 */
export function chooseZoneLengthMeters(totalDistanceMeters: number): number {
  if (!Number.isFinite(totalDistanceMeters) || totalDistanceMeters <= 0) {
    return ZONE_LENGTH_CHOICES_METERS[0];
  }
  const target = totalDistanceMeters / TARGET_ZONE_COUNT;
  let best: number = ZONE_LENGTH_CHOICES_METERS[0];
  let bestLogDistance = Number.POSITIVE_INFINITY;
  for (const choice of ZONE_LENGTH_CHOICES_METERS) {
    const logDistance = Math.abs(Math.log(target / choice));
    if (logDistance < bestLogDistance) {
      best = choice;
      bestLogDistance = logDistance;
    }
  }
  return best;
}

/** computeZoneGrades with the zone length chosen from the segment's own total distance. */
export function computeAdaptiveZoneGrades(
  referencePolyline: readonly SegmentReferencePoint[],
): ZoneWindow[] {
  const totalDistanceMeters = referencePolyline[referencePolyline.length - 1]?.distanceMeters ?? 0;
  return computeZoneGrades(referencePolyline, chooseZoneLengthMeters(totalDistanceMeters));
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

  const minFinalZoneMeters = Math.max(MIN_FINAL_ZONE_METERS, zoneLengthMeters * MIN_FINAL_ZONE_FRACTION);
  if (
    boundaries.length >= 3 &&
    boundaries[boundaries.length - 1]! - boundaries[boundaries.length - 2]! < minFinalZoneMeters
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
