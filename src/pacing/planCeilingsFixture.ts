import { buildTargetPowerZones } from "./buildTargetPowerZones.ts";
import { DEFAULT_REALISTIC_PLAN_CONFIG, buildRealisticPlan } from "./realisticPlan.ts";
import { computeAnchorPowerWatts } from "./powerDurationAnchor.ts";

/**
 * The shared, synthetic fixture for docs/PLAN_CEILINGS_CONTRACT.md: one input the phone's planner and a Karoo
 * replanner can both be checked against. Built from invented numbers only (no ride data). The committed copy
 * is docs/fixtures/plan-ceilings-synthetic.json and a test keeps it equal to what this file generates.
 */
export const fixtureInput = {
  ftpWatts: 250,
  goalDurationSeconds: 2400,
  zoneLengthMeters: 402.336,
  /** Grade (%) of each quarter-mile zone: a steady climb, an early descent, steep pitches late. */
  gradesPct: [2.5, 2.1, -1.7, 4.3, 2.8, 3.2, 6.9, 6.9, 5.8, 5.1, 4.4, 7.0, 8.5, 5.9, 3.6, 4.3, 5.7, 6.3, 7.6, 5.8, 6.5, 5.8, 6.8, 5.6, 6.7, 6.5],
  /** Best average power (W) ever held in each zone by the invented rider; null where they have never ridden it. */
  bestHeldWatts: [235, 232, null, 248, 238, 240, 262, 262, 255, 250, 244, 262, 268, 252, 238, 244, 254, 258, 262, 250, 256, 250, 258, 248, 256, 254],
};

export function buildFixture() {
  const { ftpWatts, goalDurationSeconds, zoneLengthMeters, gradesPct, bestHeldWatts } = fixtureInput;
  const goalDurationMs = goalDurationSeconds * 1000;
  const anchor = computeAnchorPowerWatts(ftpWatts, goalDurationMs);
  const raw = buildTargetPowerZones(
    gradesPct.map((gradePct, i) => ({ startDistanceMeters: i * zoneLengthMeters, endDistanceMeters: (i + 1) * zoneLengthMeters, gradePct })),
    anchor,
    ftpWatts,
  );
  const result = buildRealisticPlan({
    zones: raw,
    ftpWatts,
    anchorPowerWatts: anchor,
    goalDurationMs,
    history: bestHeldWatts.map((best) => ({ bestHeldWatts: best, attemptsWithData: best === null ? 0 : 2 })),
  });
  return {
    description: "Synthetic input and the phone planner's output. Invented numbers; not ride data.",
    input: fixtureInput,
    config: DEFAULT_REALISTIC_PLAN_CONFIG,
    anchorPowerWatts: Math.round(anchor),
    result: {
      feasible: result.feasible,
      requiredMeanWatts: Math.round(result.requiredMeanWatts * 10) / 10,
      achievedMeanWatts: Math.round(result.achievedMeanWatts * 10) / 10,
      assumptions: result.assumptions,
      zones: result.zones.map((zone, i) => ({
        index: i,
        gradePct: zone.gradePct,
        rawTargetPowerWatts: raw[i]!.targetPowerWatts,
        targetPowerWatts: zone.targetPowerWatts,
        ceilingPowerWatts: result.ceilings[i]!.ceilingWatts,
        ceilingSource: result.ceilings[i]!.source,
      })),
    },
  };
}
