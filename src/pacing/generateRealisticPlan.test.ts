import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateRealisticPlan } from "./generateRealisticPlan.ts";
import { buildBaselinePacingPlan } from "./buildBaselinePacingPlan.ts";

// A synthetic 6 km climb: steady, with a steep pitch in the second half. No real ride data.
const POLYLINE = (() => {
  let elevationMeters = 100;
  return Array.from({ length: 601 }, (_, i) => {
    const distanceMeters = i * 10;
    if (i > 0) elevationMeters += 10 * (distanceMeters > 3600 && distanceMeters <= 4400 ? 0.09 : 0.05);
    return { lat: 37 + i * 0.00009, lng: -122, distanceMeters, elevationMeters };
  });
})();

function trackAt(watts: number) {
  return Array.from({ length: 6001 }, (_, d) => ({ distanceMeters: d, timestampMs: d * 1000, power: watts }));
}

describe("generateRealisticPlan", () => {
  it("builds a plan within its ceilings from the fallback when the rider has no history", () => {
    const plan = generateRealisticPlan({ referencePolyline: POLYLINE, ftpWatts: 250, goalDurationMs: 30 * 60_000 });
    assert.ok(plan.zones.length > 0);
    assert.equal(plan.effortsWithPower, 0);
    plan.zones.forEach((zone, i) => assert.ok(zone.targetPowerWatts <= plan.realistic.ceilings[i]!.ceilingWatts));
    assert.deepEqual(plan.rawZones.map((zone) => zone.startDistanceMeters), plan.zones.map((zone) => zone.startDistanceMeters));
  });

  it("uses past efforts as ceilings where the rider has ridden", () => {
    const plan = generateRealisticPlan({
      referencePolyline: POLYLINE,
      ftpWatts: 250,
      goalDurationMs: 30 * 60_000,
      history: { attempts: [{ track: trackAt(240) }], riderWeightKg: 72 },
    });
    assert.equal(plan.effortsWithPower, 1);
    assert.ok(plan.realistic.ceilings.every((ceiling) => ceiling.source === "history"));
    assert.ok(plan.zones.every((zone) => zone.targetPowerWatts <= Math.floor(240 * 1.04)));
  });

  it("is deterministic", () => {
    const input = { referencePolyline: POLYLINE, ftpWatts: 250, goalDurationMs: 30 * 60_000, history: { attempts: [{ track: trackAt(235) }], riderWeightKg: 70 } };
    assert.deepEqual(generateRealisticPlan(input), generateRealisticPlan(input));
  });

  it("leaves the old generator untouched (buildBaselinePacingPlan still produces the raw plan)", () => {
    const wire: any = buildBaselinePacingPlan({ id: "x", segmentFingerprint: "f", referencePolyline: POLYLINE, ftpWatts: 250, targetDurationMs: 30 * 60_000, createdAtMs: 0 });
    const plan = generateRealisticPlan({ referencePolyline: POLYLINE, ftpWatts: 250, goalDurationMs: 30 * 60_000 });
    assert.deepEqual(wire.zones.map((zone: any) => zone.targetPowerWatts), plan.rawZones.map((zone) => zone.targetPowerWatts));
  });
});
