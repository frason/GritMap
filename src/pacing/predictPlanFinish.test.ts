import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ActualTrackPoint } from "./computePlanVsActual.ts";
import { predictFinishTime } from "./predictFinishTime.ts";
import { predictPlanFinish } from "./predictPlanFinish.ts";
import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";

const LENGTH = 3_000;
const POLYLINE: SegmentReferencePoint[] = [];
for (let d = 0; d <= LENGTH; d += 10) POLYLINE.push({ lat: 0, lng: 0, distanceMeters: d, elevationMeters: (d / LENGTH) * 210 }); // 7%
const ZONES = [
  { startDistanceMeters: 0, endDistanceMeters: 1_000, targetPowerWatts: 280 },
  { startDistanceMeters: 1_000, endDistanceMeters: 2_000, targetPowerWatts: 300 },
  { startDistanceMeters: 2_000, endDistanceMeters: 3_000, targetPowerWatts: 320 },
];
const WEIGHT = 80;

/** A rider's effort that holds the plan's watts but takes `slowness` times as long as the model says. */
function effort(slowness: number, powerScale = 1): { track: ActualTrackPoint[]; durationMs: number } {
  const model = predictFinishTime(ZONES, POLYLINE, { riderWeightKg: WEIGHT })!;
  const durationMs = model.durationMs * slowness;
  const seconds = Math.round(durationMs / 1_000);
  const track: ActualTrackPoint[] = [];
  for (let s = 0; s <= seconds; s += 1) {
    const distanceMeters = (s / seconds) * LENGTH;
    const zone = ZONES[Math.min(2, Math.floor(distanceMeters / 1_000))]!;
    track.push({ distanceMeters, timestampMs: 1_000_000 + s * 1_000, power: zone.targetPowerWatts * powerScale });
  }
  return { track, durationMs: seconds * 1_000 };
}

describe("predictPlanFinish", () => {
  it("falls back to the model alone, labelled an estimate, with no past efforts", () => {
    const prediction = predictPlanFinish({ zones: ZONES, referencePolyline: POLYLINE, riderWeightKg: WEIGHT })!;
    assert.equal(prediction.basis, "estimate");
    assert.equal(prediction.attemptsUsed, 0);
    assert.equal(prediction.durationMs, prediction.modelDurationMs);
  });

  it("scales the model by how much slower the rider's own effort was than it predicted", () => {
    const model = predictFinishTime(ZONES, POLYLINE, { riderWeightKg: WEIGHT })!.durationMs;
    const prediction = predictPlanFinish({
      zones: ZONES,
      referencePolyline: POLYLINE,
      riderWeightKg: WEIGHT,
      attempts: [effort(1.07)],
    })!;
    assert.equal(prediction.basis, "calibrated");
    assert.equal(prediction.attemptsUsed, 1);
    assert.ok(Math.abs(prediction.durationMs / model - 1.07) < 0.01, `${prediction.durationMs / model}`);
  });

  it("calibrates from a ride at different power than the plan, because the model is run on the ridden watts", () => {
    // Rider held 10% less than the plan and took the correspondingly longer time (model time at that
    // power x 1.05): the factor must be 1.05, not the inflated ratio against the plan's own time.
    const slowPower = predictFinishTime(
      ZONES.map((zone) => ({ ...zone, targetPowerWatts: zone.targetPowerWatts * 0.9 })),
      POLYLINE,
      { riderWeightKg: WEIGHT },
    )!.durationMs;
    const seconds = Math.round((slowPower * 1.05) / 1_000);
    const track: ActualTrackPoint[] = [];
    for (let s = 0; s <= seconds; s += 1) {
      const distanceMeters = (s / seconds) * LENGTH;
      track.push({ distanceMeters, timestampMs: 1_000_000 + s * 1_000, power: ZONES[Math.min(2, Math.floor(distanceMeters / 1_000))]!.targetPowerWatts * 0.9 });
    }
    const prediction = predictPlanFinish({
      zones: ZONES,
      referencePolyline: POLYLINE,
      riderWeightKg: WEIGHT,
      attempts: [{ track, durationMs: seconds * 1_000 }],
    })!;
    assert.ok(Math.abs(prediction.durationMs / prediction.modelDurationMs - 1.05) < 0.015);
  });

  it("uses the median of several efforts and reports their spread", () => {
    const prediction = predictPlanFinish({
      zones: ZONES,
      referencePolyline: POLYLINE,
      riderWeightKg: WEIGHT,
      attempts: [effort(1.04), effort(1.08), effort(1.06)],
    })!;
    assert.equal(prediction.attemptsUsed, 3);
    assert.ok(Math.abs(prediction.durationMs / prediction.modelDurationMs - 1.06) < 0.01);
    assert.ok(prediction.spreadPct! > 3 && prediction.spreadPct! < 5);
  });

  it("ignores efforts without power data and efforts whose factor is implausible", () => {
    const noPower = effort(1.07);
    noPower.track = noPower.track.map(({ power: _drop, ...rest }) => rest);
    const absurd = effort(2.0);
    const prediction = predictPlanFinish({
      zones: ZONES,
      referencePolyline: POLYLINE,
      riderWeightKg: WEIGHT,
      attempts: [noPower, absurd],
    })!;
    assert.equal(prediction.basis, "estimate");
  });

  it("makes no prediction for a route without elevation data", () => {
    const flat = POLYLINE.map(({ elevationMeters: _drop, ...rest }) => rest) as SegmentReferencePoint[];
    assert.equal(predictPlanFinish({ zones: ZONES, referencePolyline: flat, riderWeightKg: WEIGHT }), undefined);
  });
});
