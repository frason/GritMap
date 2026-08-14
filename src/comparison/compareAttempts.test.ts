import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compareAttempts,
  type RidePoint,
  type SegmentAttempt,
} from "./compareAttempts.ts";

const BASE_TIME = 1_700_000_000_000;

describe("compareAttempts", () => {
  it("resamples a clean comparison and calculates cumulative elapsed-time gap", () => {
    const primary = attempt("primary", [
      point(0, 0, 100, 120, 10),
      point(20, 20_000, 200, 140, 20),
      point(40, 40_000, 300, 160, 30),
    ]);
    const comparison = attempt("comparison", [
      point(0, 0, 90, 110, 12),
      point(20, 16_000, 170, 130, 22),
      point(40, 32_000, 250, 150, 32),
    ]);

    const result = compareAttempts(primary, comparison);

    assert.deepEqual(
      result.map((sample) => sample.distanceMeters),
      [0, 10, 20, 30, 40],
    );
    assert.deepEqual(result[1], {
      distanceMeters: 10,
      timeGapMs: 2_000,
      primaryPower: 150,
      comparisonPower: 130,
      primaryHeartRate: 130,
      comparisonHeartRate: 120,
      primaryElevation: 15,
      comparisonElevation: 17,
    });
    assert.equal(result[4].timeGapMs, 8_000);
  });

  it("represents a sensor dropout longer than 30 seconds as explicit null gaps", () => {
    const primary = attempt("primary", [
      point(0, 0, 100, 120, 10),
      point(10, 10_000, undefined, 125, 11),
      point(20, 20_000, undefined, 130, 12),
      point(30, 40_001, 200, 135, 13),
    ]);
    const comparison = attempt("comparison", [
      point(0, 0, 90, 115, 9),
      point(10, 10_000, 100, 120, 10),
      point(20, 20_000, 110, 125, 11),
      point(30, 30_000, 120, 130, 12),
    ]);

    const result = compareAttempts(primary, comparison);

    assert.equal(result[1].primaryPower, null);
    assert.equal(result[2].primaryPower, null);
    assert.equal(result[1].comparisonPower, 100);
    assert.equal(result[1].primaryHeartRate, 125);
    assert.notEqual(result[1].timeGapMs, null);
  });

  it("stops the shared axis at the shorter attempt without extrapolating", () => {
    const primary = attempt("primary", [point(0, 0), point(25, 25_000)]);
    const comparison = attempt("comparison", [point(0, 0), point(40, 40_000)]);

    const result = compareAttempts(primary, comparison);

    assert.deepEqual(
      result.map((sample) => sample.distanceMeters),
      [0, 10, 20],
    );
    assert.equal(result.some((sample) => sample.distanceMeters > 25), false);
  });

  it("does not interpolate wall-clock time across a ride-point gap over 30 seconds", () => {
    const primary = attempt("primary", [point(0, 0), point(20, 30_001)]);
    const comparison = attempt("comparison", [point(0, 0), point(20, 20_000)]);

    const result = compareAttempts(primary, comparison);

    assert.equal(result[1].timeGapMs, null);
  });
});

function attempt(id: string, points: RidePoint[]): SegmentAttempt {
  return {
    id,
    segmentId: "segment-1",
    rideId: `ride-${id}`,
    startTimestampMs: BASE_TIME,
    endTimestampMs: points.at(-1)?.timestampMs ?? BASE_TIME,
    points,
  };
}

function point(
  distanceMeters: number,
  elapsedMs: number,
  power?: number,
  heartRate?: number,
  elevationMeters?: number,
): RidePoint {
  return {
    distanceMeters,
    timestampMs: BASE_TIME + elapsedMs,
    power,
    heartRate,
    elevationMeters,
  };
}
