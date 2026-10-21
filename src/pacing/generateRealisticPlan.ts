import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import { buildTargetPowerZones, type PacingZone } from "./buildTargetPowerZones.ts";
import type { ActualTrackPoint } from "./computePlanVsActual.ts";
import { computeAdaptiveZoneGrades } from "./computeZoneGrades.ts";
import { summarizeEfforts, summarizeZoneHistory, type EffortSummary } from "./planCeilings.ts";
import { computeAnchorPowerWatts } from "./powerDurationAnchor.ts";
import { predictFinishTime } from "./predictFinishTime.ts";
import { calibrateModel, predictPlanFinish, type PlanFinishPrediction } from "./predictPlanFinish.ts";
import { solveAnchorForGoal } from "./solveAnchorForGoal.ts";
import { buildRealisticPlan, type RealisticPlanConfig, type RealisticPlanResult } from "./realisticPlan.ts";

/** What the planner may learn from the rider's own past efforts on this segment. */
export interface PlanHistoryInput {
  /** Past efforts, newest first, each a track re-based to its own start (getAttemptTrack) and, when known, its elapsed time. */
  attempts: readonly { track: readonly ActualTrackPoint[]; durationMs?: number; riderWeightKg?: number }[];
  /** Rider weight, used only to estimate how long each zone takes for the energy-budget guard. */
  riderWeightKg?: number;
}

export interface GeneratedPlan {
  /** The plan to ride and to send: the grade-shaped plan after ceilings, the energy budget and redistribution. */
  zones: PacingZone[];
  /** The plan as the old generator would have built it, before any of that. */
  rawZones: PacingZone[];
  anchorPowerWatts: number;
  /** Where the anchor came from: solved from the goal time with the physics model (needs weight and elevation), or the power-duration table. */
  anchorSource: "goal-time" | "power-duration-table";
  /** Set when the goal time needs more (`high`) or less (`low`) average power than the allowed band, so the anchor was held at its limit. */
  anchorLimited?: "low" | "high";
  realistic: RealisticPlanResult;
  /** How many past efforts had usable power in at least one zone. */
  effortsWithPower: number;
  /**
   * The past effort whose late-segment power set a floor under the plan, when the plan would otherwise be slower than an
   * effort the rider has already ridden and the goal is at least as ambitious as it. `zones` counts the floors applied.
   */
  referenceEffort?: { durationSeconds: number; zones: number };
  /** The predicted finish of the final plan (needs the rider's weight and the route's elevation). */
  finish?: PlanFinishPrediction;
}

/** An effort counts as faster than the plan only when it beats the plan's predicted finish by at least this much. */
const REFERENCE_MARGIN_MS = 5_000;
/** The goal must be at least this close to the effort's time (or faster) for the effort to be "within reach". */
const REFERENCE_GOAL_TOLERANCE = 1.02;

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
  const windows = computeAdaptiveZoneGrades(input.referencePolyline);
  const tableAnchor = computeAnchorPowerWatts(input.ftpWatts, input.goalDurationMs);
  const calibrationAttempts = (input.history?.attempts ?? [])
    .filter((attempt): attempt is { track: readonly ActualTrackPoint[]; durationMs: number; riderWeightKg?: number } => attempt.durationMs !== undefined)
    .slice(0, 3);
  // The average power the goal needs comes from the physics model calibrated on the rider's own efforts; the table is the fallback.
  let anchorPowerWatts = tableAnchor;
  let anchorSource: GeneratedPlan["anchorSource"] = "power-duration-table";
  let anchorLimited: GeneratedPlan["anchorLimited"];
  const weight = input.history?.riderWeightKg;
  if (weight !== undefined) {
    const calibration = calibrateModel({
      zones: buildTargetPowerZones(windows, tableAnchor, input.ftpWatts),
      referencePolyline: input.referencePolyline,
      riderWeightKg: weight,
      attempts: calibrationAttempts,
    });
    const solved = solveAnchorForGoal({
      windows,
      ftpWatts: input.ftpWatts,
      goalDurationMs: input.goalDurationMs,
      referencePolyline: input.referencePolyline,
      riderWeightKg: weight,
      calibrationFactor: calibration?.factor ?? 1,
    });
    if (solved !== undefined) {
      anchorPowerWatts = solved.anchorPowerWatts;
      anchorSource = "goal-time";
      anchorLimited = solved.limited;
    }
  }
  const rawZones = buildTargetPowerZones(windows, anchorPowerWatts, input.ftpWatts);
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
  const efforts =
    input.history === undefined || input.history.attempts.length === 0
      ? []
      : summarizeEfforts({ attempts: input.history.attempts, zones: rawZones, segmentLengthMeters, ...(input.config === undefined ? {} : { config: input.config }) });
  const build = (evidencedFloorWatts?: readonly (number | null)[]) =>
    buildRealisticPlan({
      zones: rawZones,
      ftpWatts: input.ftpWatts,
      anchorPowerWatts,
      goalDurationMs: input.goalDurationMs,
      ...(history === undefined ? {} : { history }),
      ...(zoneSeconds === undefined ? {} : { zoneSeconds }),
      ...(efforts.length === 0 ? {} : { efforts }),
      ...(evidencedFloorWatts === undefined ? {} : { evidencedFloorWatts }),
      ...(input.config === undefined ? {} : { config: input.config }),
    });
  const predict = (zones: readonly PacingZone[]): PlanFinishPrediction | undefined => {
    if (weight === undefined) return undefined;
    return predictPlanFinish({ zones, referencePolyline: input.referencePolyline, riderWeightKg: weight, attempts: calibrationAttempts });
  };

  let realistic = build();
  let finish = predict(realistic.zones);

  // If the plan would be slower than an effort the rider has already ridden, and the goal asks for at least that, the plan
  // must not ask for less than that effort held late in the segment: evidence beats the energy-budget assumption.
  const slowerThanPlan = finish?.durationMs ?? input.goalDurationMs;
  const reference = efforts
    .filter((effort) => effort.meanWatts !== null && effort.durationSeconds * 1_000 < slowerThanPlan - REFERENCE_MARGIN_MS)
    .filter((effort) => input.goalDurationMs <= effort.durationSeconds * 1_000 * REFERENCE_GOAL_TOLERANCE)
    .reduce<EffortSummary | undefined>((fastest, effort) => (fastest === undefined || effort.durationSeconds < fastest.durationSeconds ? effort : fastest), undefined);
  let referenceEffort: GeneratedPlan["referenceEffort"];
  if (reference !== undefined) {
    const withFloors = build(reference.zoneWatts);
    if (withFloors.floorZoneIndices.length > 0) {
      realistic = withFloors;
      finish = predict(realistic.zones);
      referenceEffort = { durationSeconds: reference.durationSeconds, zones: withFloors.floorZoneIndices.length };
    }
  }

  return {
    zones: realistic.zones,
    rawZones,
    anchorPowerWatts,
    anchorSource,
    ...(anchorLimited === undefined ? {} : { anchorLimited }),
    realistic,
    effortsWithPower: history === undefined ? 0 : Math.max(0, ...history.map((entry) => entry.attemptsWithData)),
    ...(referenceEffort === undefined ? {} : { referenceEffort }),
    ...(finish === undefined ? {} : { finish }),
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
