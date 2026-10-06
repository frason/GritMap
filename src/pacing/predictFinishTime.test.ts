import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  MAX_SPEED_METERS_PER_SECOND,
  calibrationFactor,
  combineCalibrationFactors,
  predictFinishTime,
  solveSpeedMetersPerSecond,
} from "./predictFinishTime.ts";
import { resolveSegmentPlan } from "./resolveSegmentPlan.ts";
import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";

const RIDER = { riderWeightKg: 75 };

function road(totalMeters: number, riseMeters: number): SegmentReferencePoint[] {
  const points: SegmentReferencePoint[] = [];
  for (let d = 0; d <= totalMeters; d += 10) {
    points.push({ lat: 0, lng: 0, distanceMeters: d, elevationMeters: (d / totalMeters) * riseMeters });
  }
  return points;
}

describe("solveSpeedMetersPerSecond", () => {
  it("lands where pedal power balances gravity, rolling resistance and drag", () => {
    // 8% climb at 300 W, 75 kg rider: about 4 m/s (15 km/h) -- gravity dominates, drag is negligible.
    const v = solveSpeedMetersPerSecond(300, 0.08, RIDER);
    assert.ok(v > 3.8 && v < 4.3, String(v));

    // Independent residual check: v * (m g (sin + crr cos) + 0.5 rho CdA v^2) == eta * P.
    const mass = 75 + 9.5;
    const slope = Math.atan(0.08);
    const force = mass * 9.80665 * (Math.sin(slope) + 0.005 * Math.cos(slope)) + 0.5 * 1.2 * 0.36 * v * v;
    assert.ok(Math.abs(v * force - 0.975 * 300) < 0.01);
  });

  it("is faster with more power and slower on steeper grades", () => {
    assert.ok(solveSpeedMetersPerSecond(320, 0.05, RIDER) > solveSpeedMetersPerSecond(280, 0.05, RIDER));
    assert.ok(solveSpeedMetersPerSecond(280, 0.08, RIDER) < solveSpeedMetersPerSecond(280, 0.03, RIDER));
  });

  it("is faster for a lighter rider on a climb", () => {
    assert.ok(solveSpeedMetersPerSecond(280, 0.07, { riderWeightKg: 65 }) > solveSpeedMetersPerSecond(280, 0.07, { riderWeightKg: 90 }));
  });

  it("caps a descent instead of returning an unbounded speed, and floors a stall", () => {
    assert.equal(solveSpeedMetersPerSecond(200, -0.12, RIDER), MAX_SPEED_METERS_PER_SECOND);
    assert.equal(solveSpeedMetersPerSecond(0, 0.1, RIDER), 0.8);
  });
});

describe("predictFinishTime", () => {
  it("a steady plan on a steady climb takes length / speed", () => {
    const polyline = road(2_000, 140); // 7% average
    const zones = [{ startDistanceMeters: 0, endDistanceMeters: 2_000, targetPowerWatts: 300 }];
    const prediction = predictFinishTime(zones, polyline, RIDER)!;
    const expected = (2_000 / solveSpeedMetersPerSecond(300, 0.07, RIDER)) * 1_000;
    assert.equal(prediction.hasElevation, true);
    assert.ok(Math.abs(prediction.durationMs - expected) / expected < 0.01, `${prediction.durationMs} vs ${expected}`);
  });

  it("more power is faster; a heavier rider is slower", () => {
    const polyline = road(3_000, 180);
    const at = (watts: number, kg: number) =>
      predictFinishTime([{ startDistanceMeters: 0, endDistanceMeters: 3_000, targetPowerWatts: watts }], polyline, { riderWeightKg: kg })!.durationMs;
    assert.ok(at(320, 75) < at(280, 75));
    assert.ok(at(280, 90) > at(280, 70));
  });

  it("flags a route with no elevation data instead of pretending the grade is known", () => {
    const flatless = road(1_000, 0).map(({ elevationMeters: _drop, ...rest }) => rest) as SegmentReferencePoint[];
    const prediction = predictFinishTime([{ startDistanceMeters: 0, endDistanceMeters: 1_000, targetPowerWatts: 250 }], flatless, RIDER)!;
    assert.equal(prediction.hasElevation, false);
  });

  it("returns undefined for an empty plan", () => {
    assert.equal(predictFinishTime([], road(1_000, 50), RIDER), undefined);
  });

  it("agrees with the plan generator: the 39:00 Diablo plan predicts within 3% of 39:00 for a 92.5 kg rider", async () => {
    const fixture = JSON.parse(
      await readFile("apps/karoo/samples/Diablo.Northgate-to-Junction.40m30.guidance-package.json", "utf8"),
    ) as { segment: { referencePolyline: SegmentReferencePoint[] } };
    const polyline = fixture.segment.referencePolyline;
    const resolved = resolveSegmentPlan({ ftpWatts: 280, goalDurationMs: 39 * 60_000, referencePolyline: polyline });
    assert.equal(resolved.kind, "generated");
    if (resolved.kind !== "generated") return;
    const prediction = predictFinishTime(resolved.zones, polyline, { riderWeightKg: 92.5 })!;
    const goalMs = 39 * 60_000;
    assert.ok(Math.abs(prediction.durationMs / goalMs - 1) < 0.03, `${prediction.durationMs / 60_000} min`);
  });
});

describe("calibration", () => {
  it("is actual time over model time", () => {
    assert.equal(calibrationFactor(2_700_000, 2_500_000), 1.08);
    assert.equal(calibrationFactor(0, 100), undefined);
    assert.equal(calibrationFactor(100, Number.NaN), undefined);
  });

  it("takes the median of several efforts and reports their spread", () => {
    const combined = combineCalibrationFactors([1.05, 1.09, 1.07])!;
    assert.equal(combined.factor, 1.07);
    assert.ok(Math.abs(combined.spreadPct - ((1.09 - 1.05) / 1.07) * 100) < 1e-9);
    assert.equal(combineCalibrationFactors([1.2, 1.0])!.factor, 1.1);
  });

  it("rejects implausible factors rather than letting a bad effort skew the prediction", () => {
    assert.equal(combineCalibrationFactors([0.5, 2.0]), undefined);
    assert.equal(combineCalibrationFactors([0.5, 1.05])!.factor, 1.05);
    assert.equal(combineCalibrationFactors([]), undefined);
  });
});
