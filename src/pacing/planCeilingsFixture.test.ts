import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildFixture } from "./planCeilingsFixture.ts";

describe("shared plan-ceilings fixture (docs/fixtures/plan-ceilings-synthetic.json)", () => {
  it("equals what the phone's planner generates today", () => {
    const committed = JSON.parse(readFileSync("docs/fixtures/plan-ceilings-synthetic.json", "utf8"));
    assert.deepEqual(committed, JSON.parse(JSON.stringify(buildFixture())));
  });

  it("keeps the optional transfer fixture aligned with generated targets and assumptions", () => {
    const { input, result, config } = buildFixture();
    const wire = JSON.parse(readFileSync("docs/fixtures/plan-ceilings-transfer-v1.json", "utf8")).baselinePacingPlan;
    assert.equal(wire.ftpWatts, input.ftpWatts);
    assert.equal(wire.targetFinishTimeSeconds, input.goalDurationSeconds);
    assert.deepEqual(wire.zones.map((zone: { targetPowerWatts: number; ceilingPowerWatts: number }) => ({
      targetPowerWatts: zone.targetPowerWatts, ceilingPowerWatts: zone.ceilingPowerWatts,
    })), result.zones.map(zone => ({ targetPowerWatts: zone.targetPowerWatts, ceilingPowerWatts: zone.ceilingPowerWatts })));
    assert.deepEqual(wire.replan, {
      schemaVersion: 1,
      criticalPowerWatts: result.assumptions.criticalPowerWatts,
      wPrimeJoules: result.assumptions.wPrimeJoules,
      wPrimeReserveFraction: config.wPrimeReserveFraction,
      maxStepWatts: config.maxStepWatts,
      hardMaxStepWatts: config.hardMaxStepWatts,
      stepLimitMinGradePct: config.stepLimitMinGradePct,
    });
  });

  it("holds the rules a Karoo replanner must respect", () => {
    const { result, config } = buildFixture();
    result.zones.forEach((zone, i) => {
      assert.ok(zone.targetPowerWatts <= zone.ceilingPowerWatts, `zone ${i} within ceiling`);
      if (i > 0) assert.ok(Math.abs(zone.targetPowerWatts - result.zones[i - 1]!.targetPowerWatts) <= config.hardMaxStepWatts);
    });
    assert.ok(result.feasible);
  });
});
