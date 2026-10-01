import type { SegmentReferencePoint } from "./resamplePolyline.ts";

export interface SegmentElevationStats {
  elevationGainMeters: number;
  averageGradePercent: number;
}

/**
 * Elevation gain is the sum of positive deltas between consecutive points that both have
 * elevation -- the same convention persistImportedRide.ts's computeTotalAscentMeters uses
 * for whole rides, applied here to a segment's reference polyline instead (a gap across
 * missing elevation samples contributes no delta, never fabricating a jump across it).
 * Average grade is that gain over the segment's total distance -- the standard "how steep
 * is this climb overall" summary (see computeZoneGrades.ts for per-zone grade instead).
 * Returns undefined when the segment has no elevation data at all.
 */
export function computeSegmentElevationStats(
  referencePolyline: readonly SegmentReferencePoint[],
): SegmentElevationStats | undefined {
  if (referencePolyline.length === 0) return undefined;

  let ascent = 0;
  let previousElevation: number | undefined;
  let sawElevation = false;

  for (const point of referencePolyline) {
    const elevation = point.elevationMeters;
    if (elevation === undefined) {
      previousElevation = undefined;
      continue;
    }
    sawElevation = true;
    if (previousElevation !== undefined && elevation > previousElevation) {
      ascent += elevation - previousElevation;
    }
    previousElevation = elevation;
  }

  if (!sawElevation) return undefined;

  const totalDistanceMeters = referencePolyline[referencePolyline.length - 1]!.distanceMeters;
  const averageGradePercent = totalDistanceMeters > 0 ? (ascent / totalDistanceMeters) * 100 : 0;
  return { elevationGainMeters: ascent, averageGradePercent };
}
