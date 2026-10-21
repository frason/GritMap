import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTargetPowerZones } from "./buildTargetPowerZones.ts";
import { computeAdaptiveZoneGrades } from "./computeZoneGrades.ts";
import { predictFinishTime } from "./predictFinishTime.ts";
import { MAX_SOLVED_ANCHOR_PCT_FTP, MIN_SOLVED_ANCHOR_PCT_FTP, solveAnchorForGoal } from "./solveAnchorForGoal.ts";

// A synthetic 6 km climb, steadier at the start and steeper late. No real ride data.
function polyline(withElevation = true) {
  let elevationMeters = 100;
  return Array.from({ length: 601 }, (_, i) => {
    const distanceMeters = i * 10;
    if (i > 0) elevationMeters += 10 * (distanceMeters > 3600 && distanceMeters <= 4400 ? 0.09 : 0.05);
    return { lat: 37 + i * 0.00009, lng: -122, distanceMeters, ...(withElevation ? { elevationMeters } : {}) };
  });
}

const FTP = 250;
const WEIGHT = 70;
const windows = computeAdaptiveZoneGrades(polyline());

function finishFor(anchor: number, factor = 1): number {
  const zones = buildTargetPowerZones(windows, anchor, FTP);
  return predictFinishTime(zones, polyline(), { riderWeightKg: WEIGHT })!.durationMs * factor;
}

describe("solveAnchorForGoal", () => {
  it("finds the average power whose predicted finish is the goal", () => {
    const goal = finishFor(240);
    const solved = solveAnchorForGoal({ windows, ftpWatts: FTP, goalDurationMs: goal, referencePolyline: polyline(), riderWeightKg: WEIGHT, calibrationFactor: 1 })!;
    assert.equal(solved.limited, undefined);
    assert.ok(Math.abs(solved.anchorPowerWatts - 240) < 0.5, `anchor ${solved.anchorPowerWatts}`);
    assert.ok(Math.abs(finishFor(solved.anchorPowerWatts) - goal) < 1_000);
  });

  it("asks for more power for a faster goal, and the plans genuinely differ", () => {
    const solve = (goalMs: number) => solveAnchorForGoal({ windows, ftpWatts: FTP, goalDurationMs: goalMs, referencePolyline: polyline(), riderWeightKg: WEIGHT, calibrationFactor: 1 })!;
    const slower = solve(finishFor(225));
    const faster = solve(finishFor(255));
    assert.ok(faster.anchorPowerWatts - slower.anchorPowerWatts > 20, `${slower.anchorPowerWatts} vs ${faster.anchorPowerWatts}`);
  });

  it("scales with the rider's calibration: a rider who is slower than the model needs more power for the same time", () => {
    const goal = finishFor(240);
    const base = solveAnchorForGoal({ windows, ftpWatts: FTP, goalDurationMs: goal, referencePolyline: polyline(), riderWeightKg: WEIGHT, calibrationFactor: 1 })!;
    const slow = solveAnchorForGoal({ windows, ftpWatts: FTP, goalDurationMs: goal, referencePolyline: polyline(), riderWeightKg: WEIGHT, calibrationFactor: 1.08 })!;
    assert.ok(slow.anchorPowerWatts > base.anchorPowerWatts + 5);
  });

  it("holds the anchor at its limit when the goal is out of the allowed band", () => {
    const tooFast = solveAnchorForGoal({ windows, ftpWatts: FTP, goalDurationMs: 5 * 60_000, referencePolyline: polyline(), riderWeightKg: WEIGHT, calibrationFactor: 1 })!;
    assert.equal(tooFast.limited, "high");
    assert.equal(tooFast.anchorPowerWatts, FTP * MAX_SOLVED_ANCHOR_PCT_FTP);
    const tooSlow = solveAnchorForGoal({ windows, ftpWatts: FTP, goalDurationMs: 6 * 3_600_000, referencePolyline: polyline(), riderWeightKg: WEIGHT, calibrationFactor: 1 })!;
    assert.equal(tooSlow.limited, "low");
    assert.equal(tooSlow.anchorPowerWatts, FTP * MIN_SOLVED_ANCHOR_PCT_FTP);
  });

  it("returns nothing without elevation (the power-duration table is used then) or without zones", () => {
    const flatWindows = computeAdaptiveZoneGrades(polyline(false));
    assert.equal(solveAnchorForGoal({ windows: flatWindows, ftpWatts: FTP, goalDurationMs: 1_200_000, referencePolyline: polyline(false), riderWeightKg: WEIGHT, calibrationFactor: 1 }), undefined);
    assert.equal(solveAnchorForGoal({ windows: [], ftpWatts: FTP, goalDurationMs: 1_200_000, referencePolyline: polyline(), riderWeightKg: WEIGHT, calibrationFactor: 1 }), undefined);
  });
});
