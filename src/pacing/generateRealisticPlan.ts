import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import { buildTargetPowerZones, type PacingZone } from "./buildTargetPowerZones.ts";
import type { ActualTrackPoint } from "./computePlanVsActual.ts";
import { computeAdaptiveZoneGrades } from "./computeZoneGrades.ts";
import { summarizeZoneHistory } from "./planCeilings.ts";
import { computeAnchorPowerWatts } from "./powerDurationAnchor.ts";
import { predictFinishTime } from "./predictFinishTime.ts";
import { buildRealisticPlan, type RealisticPlanConfig, type RealisticPlanResult } from "./realisticPlan.ts";

/** What the planner may learn from the rider's own past efforts on this segment. */
export interface PlanHistoryInput {
  /** Past efforts, each a track re-based to its own start (getAttemptTrack). */
  attempts: readonly { track: readonly ActualTrackPoint[] }[];
  /** Rider weight, used only to estimate how long each zone takes for the energy-budget guard. */
  riderWeightKg?: number;
}

export interface GeneratedPlan {
  /** The plan to ride and to send: the grade-shaped plan after ceilings, the energy budget and redistribution. */
  zones: PacingZone[];
  /** The plan as the old generator would have built it, before any of that. */
  rawZones: PacingZone[];
  anchorPowerWatts: number;
  realistic: RealisticPlanResult;
  /** How many past efforts had usable power in at least one zone. */
  effortsWithPower: number;
}

/**
 * The one place a generated pacing plan is made for display and for sending: the grade-shaped baseline
 * (buildTargetPowerZones) made rideable by buildRealisticPlan. Both the segment screen and the Karoo
 * send call it, so what the rider sees is what the Karoo gets. Pure and deterministic.
 */
export function generateRealisticPlan(input: {
  referencePolyline: readonly SegmentReferencePoint[];
  ftpWatts: number;
  goalDurationMs: number;
  history?: PlanHistoryInput;
  config?: Partial<RealisticPlanConfig>;
}): GeneratedPlan {
  const anchorPowerWatts = computeAnchorPowerWatts(input.ftpWatts, input.goalDurationMs);
  const rawZones = buildTargetPowerZones(computeAdaptiveZoneGrades(input.referencePolyline), anchorPowerWatts, input.ftpWatts);
  const segmentLengthMeters = rawZones.length === 0 ? 0 : rawZones[rawZones.length - 1]!.endDistanceMeters;
  const history =
    input.history === undefined || input.history.attempts.length === 0
      ? undefined
      : summarizeZoneHistory({
          attempts: input.history.attempts,
          zones: rawZones,
          segmentLengthMeters,
          ...(input.config === undefined ? {} : { config: input.config }),
        });
  const zoneSeconds = estimateZoneSeconds(rawZones, input.referencePolyline, input.goalDurationMs, input.history?.riderWeightKg);
  const realistic = buildRealisticPlan({
    zones: rawZones,
    ftpWatts: input.ftpWatts,
    anchorPowerWatts,
    goalDurationMs: input.goalDurationMs,
    ...(history === undefined ? {} : { history }),
    ...(zoneSeconds === undefined ? {} : { zoneSeconds }),
    ...(input.config === undefined ? {} : { config: input.config }),
  });
  return {
    zones: realistic.zones,
    rawZones,
    anchorPowerWatts,
    realistic,
    effortsWithPower: history === undefined ? 0 : Math.max(0, ...history.map((entry) => entry.attemptsWithData)),
  };
}

/**
 * Seconds in each zone at the raw plan's targets from the physics model (predictFinishTime), shared out
 * so they add up to the goal time. Undefined without a weight or elevation: the planner then shares the
 * goal time out by distance.
 */
function estimateZoneSeconds(
  zones: readonly PacingZone[],
  referencePolyline: readonly SegmentReferencePoint[],
  goalDurationMs: number,
  riderWeightKg: number | undefined,
): number[] | undefined {
  if (riderWeightKg === undefined || zones.length === 0) return undefined;
  const modelMs: number[] = [];
  for (const zone of zones) {
    const prediction = predictFinishTime([zone], referencePolyline, { riderWeightKg });
    if (prediction === undefined || !prediction.hasElevation) return undefined;
    modelMs.push(prediction.durationMs);
  }
  const total = modelMs.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return undefined;
  return modelMs.map((value) => (value / total) * (goalDurationMs / 1_000));
}
