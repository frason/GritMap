import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ComparisonSample } from "../comparison/compareAttempts.ts";
import { computeZoneBreakdown } from "./computeZoneBreakdown.ts";

function sample(overrides: Partial<ComparisonSample>): ComparisonSample {
  return {
    distanceMeters: 0,
    timeGapMs: null,
    primaryPower: null,
    comparisonPower: null,
    primaryHeartRate: null,
    comparisonHeartRate: null,
    primaryElevation: null,
    comparisonElevation: null,
    ...overrides,
  };
}

describe("computeZoneBreakdown", () => {
  it("omits power/heartRate entirely when no threshold is set", () => {
    const result = computeZoneBreakdown([sample({ primaryPower: 200 })], {});
    assert.deepEqual(result.primary, {});
    assert.deepEqual(result.comparison, {});
  });

  it("returns an empty array when the threshold is set but there's no data for that channel", () => {
    const result = computeZoneBreakdown([sample({})], { ftpWatts: 250 });
    assert.deepEqual(result.primary.power, []);
    assert.equal(result.primary.heartRate, undefined);
  });

  it("splits time evenly across zones when samples are evenly split", () => {
    const samples = [
      sample({ primaryPower: 250 * 0.5 }), // zone 1
      sample({ primaryPower: 250 * 0.5 }), // zone 1
      sample({ primaryPower: 250 * 1.0 }), // zone 4
    ];
    const result = computeZoneBreakdown(samples, { ftpWatts: 250 });
    assert.deepEqual(result.primary.power, [
      { zone: 1, percent: (2 / 3) * 100 },
      { zone: 4, percent: (1 / 3) * 100 },
    ]);
  });

  it("computes primary and comparison independently", () => {
    const samples = [
      sample({ primaryPower: 250 * 0.5, comparisonPower: 250 * 1.2 }),
    ];
    const result = computeZoneBreakdown(samples, { ftpWatts: 250 });
    assert.deepEqual(result.primary.power, [{ zone: 1, percent: 100 }]);
    assert.deepEqual(result.comparison.power, [{ zone: 5, percent: 100 }]);
  });

  it("ignores null samples rather than treating them as a zone", () => {
    const samples = [
      sample({ primaryPower: 250 * 0.5 }),
      sample({ primaryPower: null }),
    ];
    const result = computeZoneBreakdown(samples, { ftpWatts: 250 });
    assert.deepEqual(result.primary.power, [{ zone: 1, percent: 100 }]);
  });

  it("computes power and heart rate breakdowns independently", () => {
    const samples = [sample({ primaryPower: 250 * 1.0, primaryHeartRate: 190 * 0.55 })];
    const result = computeZoneBreakdown(samples, { ftpWatts: 250, maxHeartRateBpm: 190 });
    assert.deepEqual(result.primary.power, [{ zone: 4, percent: 100 }]);
    assert.deepEqual(result.primary.heartRate, [{ zone: 1, percent: 100 }]);
  });
});
