import type { SavedSegmentPlan } from "../db/segmentPlans.ts";
import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import { buildTargetPowerZones } from "./buildTargetPowerZones.ts";
import { computeAdaptiveZoneGrades } from "./computeZoneGrades.ts";
import { computeAnchorPowerWatts } from "./powerDurationAnchor.ts";
import type { PlanZoneLike } from "./computePlanVsActual.ts";

export type ResolvedSegmentPlan =
  | { kind: "imported"; plan: SavedSegmentPlan; zones: PlanZoneLike[] }
  | { kind: "generated"; ftpWatts: number; goalDurationMs: number; zones: PlanZoneLike[] }
  | { kind: "none"; reason: "no-ftp" | "no-goal" };

/**
 * The plan a segment currently has: an active imported rider/coach plan wins; otherwise the
 * plan GritMap generates from FTP and this segment's goal time; otherwise none. Mirrors what
 * the segment screen shows and sends, so a comparison is against "the plan as it stands".
 */
export function resolveSegmentPlan(input: {
  activePlan?: SavedSegmentPlan;
  ftpWatts?: number;
  /** The active goal's target time, only when that goal is for this segment. */
  goalDurationMs?: number;
  referencePolyline: readonly SegmentReferencePoint[];
}): ResolvedSegmentPlan {
  if (input.activePlan !== undefined) {
    return { kind: "imported", plan: input.activePlan, zones: input.activePlan.zones };
  }
  if (input.ftpWatts === undefined) return { kind: "none", reason: "no-ftp" };
  if (input.goalDurationMs === undefined) return { kind: "none", reason: "no-goal" };
  const anchor = computeAnchorPowerWatts(input.ftpWatts, input.goalDurationMs);
  const zones = buildTargetPowerZones(computeAdaptiveZoneGrades(input.referencePolyline), anchor, input.ftpWatts);
  return { kind: "generated", ftpWatts: input.ftpWatts, goalDurationMs: input.goalDurationMs, zones };
}
