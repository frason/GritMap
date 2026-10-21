import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SegmentDetail } from "../db/getSegmentDetail.ts";
import type { SavedSegmentPlan } from "../db/segmentPlans.ts";
import { buildBaselinePacingPlan } from "../pacing/buildBaselinePacingPlan.ts";
import { buildTransferBaselinePlan, REALISTIC_PLAN_MODEL_VERSION } from "./buildTransferParts.ts";

// A synthetic 5 km climb with a steep pitch late in it. No real ride data.
function segment(): SegmentDetail {
  let elevationMeters = 100;
  const referencePolyline = Array.from({ length: 501 }, (_, i) => {
    const distanceMeters = i * 10;
    if (i > 0) elevationMeters += 10 * (distanceMeters > 3000 && distanceMeters <= 3800 ? 0.1 : 0.05);
    return { lat: 37 + i * 0.00009, lng: -122, distanceMeters, elevationMeters };
  });
  return { segmentId: "s1", name: "Synthetic Wall", corridorMeters: 30, requiredCoveragePct: 0.9, schemaVersion: 1, fingerprint: "fp", createdAtMs: 1, referencePolyline };
}

const rider = { ftpWatts: 250 };
const track = (watts: number) => Array.from({ length: 5001 }, (_, d) => ({ distanceMeters: d, timestampMs: d * 1000, power: watts }));

describe("buildTransferBaselinePlan", () => {
  it("without history builds the plain plan, exactly as before", () => {
    const result = buildTransferBaselinePlan({ segment: segment(), rider, targetDurationMs: 30 * 60_000, packageId: "p", nowMs: 5 });
    assert.ok(result.ok);
    const expected = buildBaselinePacingPlan({ id: "p", segmentFingerprint: "fp", referencePolyline: segment().referencePolyline, ftpWatts: 250, targetDurationMs: 30 * 60_000, createdAtMs: 5 });
    assert.deepEqual(result.ok && result.baselinePacingPlan, expected);
  });

  it("with history sends the realistic plan: labelled, within what the rider has held, same wire shape", () => {
    const result = buildTransferBaselinePlan({
      segment: segment(),
      rider,
      targetDurationMs: 30 * 60_000,
      packageId: "p",
      nowMs: 5,
      planHistory: { attempts: [{ track: track(230) }], riderWeightKg: 70 },
    });
    assert.ok(result.ok);
    const plan: any = result.ok && result.baselinePacingPlan;
    assert.equal(plan.generator.modelVersion, REALISTIC_PLAN_MODEL_VERSION);
    assert.equal(plan.generator.type, "phone-ai");
    assert.equal(plan.targetFinishTimeSeconds, 1800);
    assert.deepEqual(Object.keys(plan).sort(), ["createdAtMs", "ftpWatts", "generator", "id", "schemaVersion", "segmentFingerprint", "targetFinishTimeSeconds", "zones"]);
    for (const zone of plan.zones) {
      assert.ok(zone.targetPowerWatts <= Math.floor(230 * 1.04), `target ${zone.targetPowerWatts}`);
      assert.deepEqual(Object.keys(zone).sort(), ["classification", "endDistanceMeters", "icon", "instruction", "startDistanceMeters", "targetPowerWatts"]);
    }
    for (let i = 1; i < plan.zones.length; i += 1) assert.ok(Math.abs(plan.zones[i].targetPowerWatts - plan.zones[i - 1].targetPowerWatts) <= 80);
  });

  it("with empty history still makes the plan realistic from the fallback ceilings", () => {
    const result = buildTransferBaselinePlan({ segment: segment(), rider, targetDurationMs: 30 * 60_000, packageId: "p", nowMs: 5, planHistory: { attempts: [] } });
    assert.ok(result.ok);
    assert.equal((result.ok && (result.baselinePacingPlan as any).generator.modelVersion), REALISTIC_PLAN_MODEL_VERSION);
  });

  it("never rewrites an imported plan, even when history is given", () => {
    const imported: SavedSegmentPlan = {
      id: "imp",
      segmentId: "s1",
      source: "human-coach",
      profileVersion: 1,
      ftpWatts: 250,
      createdAtMs: 1,
      zones: [{ startDistanceMeters: 0, endDistanceMeters: 5_000, targetPowerWatts: 400, classification: "PUSH", instruction: "Push" }],
    };
    const result = buildTransferBaselinePlan({
      segment: segment(),
      rider,
      targetDurationMs: undefined,
      importedPlan: imported,
      packageId: "p",
      nowMs: 5,
      planHistory: { attempts: [{ track: track(200) }] },
    });
    assert.ok(result.ok);
    assert.equal(result.ok && (result.baselinePacingPlan as any).zones[0].targetPowerWatts, 400);
    assert.equal(result.ok && (result.baselinePacingPlan as any).generator.type, "manual");
  });

  it("still asks for a goal when there is neither a goal nor an imported plan", () => {
    const result = buildTransferBaselinePlan({ segment: segment(), rider, targetDurationMs: undefined, packageId: "p", nowMs: 5, planHistory: { attempts: [] } });
    assert.deepEqual(result, { ok: false, message: "Set a goal time first." });
  });
});
