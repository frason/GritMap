import type { ZoneWindow } from "./computeZoneGrades.ts";

export type PacingClassification = "REST" | "HOLD" | "PUSH";

export interface PacingZone extends ZoneWindow {
  targetPowerWatts: number;
  classification: PacingClassification;
  instruction: string;
}

/**
 * Fractional power change per 1 percentage-point of grade differential from the segment's
 * own distance-weighted average grade. Deliberately coarse and round -- not derived from
 * rider mass, drag, or rolling resistance (none of that is tracked anywhere in this app).
 * Exposed as a named constant so it can be tuned later against real ride data.
 */
const GRADE_SENSITIVITY = 0.05;
const MIN_PCT_FTP = 0.7;
/** Matches the companion Karoo app's own hard ceiling (AiPlanValidator: ftpWatts * 1.5). */
const MAX_PCT_FTP = 1.5;
/** Margin under the Karoo's hard 100W-per-adjacent-zone cap, so rounding can't breach it. */
const MAX_STEP_WATTS = 80;
const REST_THRESHOLD = 0.9;
const PUSH_THRESHOLD = 1.1;
const STEEP_GRADE_PCT = 3;

/**
 * Converts each zone's grade into a target power: a baseline anchor power (from FTP +
 * goal duration, see powerDurationAnchor.ts) modulated up on steeper-than-average zones
 * and down on shallower ones, clamped to a physiological range, renormalized so the
 * distance-weighted mean stays at the anchor, then step-limited so no two adjacent zones
 * differ more than the Karoo's own tolerance -- a real steep pitch can otherwise produce a
 * jump large enough that the Karoo's importer rejects the whole plan.
 */
export function buildTargetPowerZones(
  zoneWindows: readonly ZoneWindow[],
  anchorPowerWatts: number,
  ftpWatts: number,
): PacingZone[] {
  if (zoneWindows.length === 0) return [];
  if (!Number.isFinite(anchorPowerWatts) || anchorPowerWatts <= 0) {
    throw new RangeError(`anchorPowerWatts must be positive and finite, got ${anchorPowerWatts}`);
  }
  if (!Number.isFinite(ftpWatts) || ftpWatts <= 0) {
    throw new RangeError(`ftpWatts must be positive and finite, got ${ftpWatts}`);
  }

  const lengths = zoneWindows.map((zone) => zone.endDistanceMeters - zone.startDistanceMeters);
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const avgGrade =
    totalLength > 0
      ? zoneWindows.reduce((sum, zone, i) => sum + zone.gradePct * lengths[i]!, 0) / totalLength
      : 0;

  const minWatts = Math.floor(ftpWatts * MIN_PCT_FTP);
  const maxWatts = Math.floor(ftpWatts * MAX_PCT_FTP);

  const raw = zoneWindows.map(
    (zone) => anchorPowerWatts * (1 + GRADE_SENSITIVITY * (zone.gradePct - avgGrade)),
  );
  const clamped = raw.map((watts) => clamp(watts, minWatts, maxWatts));

  const meanClamped =
    totalLength > 0
      ? clamped.reduce((sum, watts, i) => sum + watts * lengths[i]!, 0) / totalLength
      : anchorPowerWatts;
  const scale = meanClamped > 0 ? anchorPowerWatts / meanClamped : 1;
  const renormalized = clamped.map((watts) => clamp(watts * scale, minWatts, maxWatts));

  const stepLimited: number[] = [];
  let previous: number | undefined;
  for (const watts of renormalized) {
    const bounded =
      previous === undefined ? watts : clamp(watts, previous - MAX_STEP_WATTS, previous + MAX_STEP_WATTS);
    const value = clamp(bounded, minWatts, maxWatts);
    stepLimited.push(value);
    previous = value;
  }

  return zoneWindows.map((zone, i) => {
    const targetPowerWatts = Math.round(stepLimited[i]!);
    const classification = classify(targetPowerWatts, anchorPowerWatts);
    return {
      ...zone,
      targetPowerWatts,
      classification,
      instruction: instructionFor(classification, zone.gradePct),
    };
  });
}

function classify(targetPowerWatts: number, anchorPowerWatts: number): PacingClassification {
  const ratio = targetPowerWatts / anchorPowerWatts;
  if (ratio < REST_THRESHOLD) return "REST";
  if (ratio > PUSH_THRESHOLD) return "PUSH";
  return "HOLD";
}

function instructionFor(classification: PacingClassification, gradePct: number): string {
  const steep = Math.abs(gradePct) >= STEEP_GRADE_PCT;
  const roundedAbs = Math.round(Math.abs(gradePct));
  if (classification === "REST") {
    return steep && gradePct < 0 ? `Rest — ${roundedAbs}% downhill` : "Rest";
  }
  if (classification === "PUSH") {
    return steep && gradePct > 0 ? `Push — ${roundedAbs}% pitch ahead` : "Push";
  }
  return steep ? `Hold — ${Math.round(gradePct)}% grade` : "Hold";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
