import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describePlanPrediction } from "./describePlanPrediction.ts";

const estimate = { durationMs: 2_412_000, basis: "estimate" as const, modelDurationMs: 2_412_000, attemptsUsed: 0 };
const calibrated = { durationMs: 2_412_000, basis: "calibrated" as const, modelDurationMs: 2_250_000, attemptsUsed: 3, spreadPct: 2 };

describe("describePlanPrediction", () => {
  it("states the time and says an estimate is an estimate", () => {
    const lines = describePlanPrediction({ prediction: estimate });
    assert.equal(lines.headline, "Predicted finish about 40:12");
    assert.match(lines.basis, /estimate from your weight and the route/i);
    assert.equal(lines.goal, undefined);
    assert.equal(lines.coachTarget, undefined);
  });

  it("says how many efforts a calibrated prediction rests on", () => {
    assert.match(describePlanPrediction({ prediction: calibrated }).basis, /last 3 efforts/);
    assert.match(describePlanPrediction({ prediction: { ...calibrated, attemptsUsed: 1 } }).basis, /last 1 effort on/);
  });

  it("compares with the goal: slower, faster, or right on", () => {
    assert.equal(
      describePlanPrediction({ prediction: estimate, goalDurationMs: 39 * 60_000 }).goal,
      "Your goal is 39:00: this plan is predicted 1:12 slower.",
    );
    assert.equal(
      describePlanPrediction({ prediction: estimate, goalDurationMs: 41 * 60_000 }).goal,
      "Your goal is 41:00: this plan is predicted 0:48 faster.",
    );
    assert.equal(
      describePlanPrediction({ prediction: estimate, goalDurationMs: 2_405_000 }).goal,
      "Right on your 40:05 goal.",
    );
  });

  it("repeats the coach's own target when the plan carried one", () => {
    assert.equal(
      describePlanPrediction({ prediction: estimate, coachTargetSeconds: 2_340 }).coachTarget,
      "The plan's own target is 39:00.",
    );
  });
});
