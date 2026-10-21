import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describePlanFeasibility } from "./describePlanFeasibility.ts";

const base = { requiredMeanWatts: 253, achievedMeanWatts: 253, trimmedZoneIndices: [] as number[] };

describe("describePlanFeasibility", () => {
  it("says nothing when the plan met the goal and nothing was cut", () => {
    assert.equal(describePlanFeasibility({ realistic: { ...base, feasible: true }, goalDurationMs: 2_400_000 }), undefined);
  });

  it("says targets were held back, and the goal still holds, when trimmed zones were made up for", () => {
    const lines = describePlanFeasibility({ realistic: { ...base, feasible: true, trimmedZoneIndices: [12, 18] }, goalDurationMs: 2_400_000 })!;
    assert.equal(lines.tone, "info");
    assert.match(lines.detail, /2 sections were kept within what you have held/);
    assert.match(lines.detail, /40:00 goal still holds/);
    const one = describePlanFeasibility({ realistic: { ...base, feasible: true, trimmedZoneIndices: [12] }, goalDurationMs: 2_400_000 })!;
    assert.match(one.detail, /One section was kept/);
  });

  it("names the best achievable time and the gap when the goal is out of reach", () => {
    const lines = describePlanFeasibility({
      realistic: { ...base, achievedMeanWatts: 244, feasible: false },
      goalDurationMs: 2_400_000,
      predictedFinishMs: 2_495_000,
    })!;
    assert.equal(lines.tone, "warning");
    assert.equal(lines.headline, "Your 40:00 goal looks out of reach for now.");
    assert.match(lines.detail, /about 41:35, 1:35 slower than your goal/);
    assert.match(lines.detail, /never asks for more power than you have held/);
  });

  it("says the goal is out of reach when the power adds up but the predicted time is well over the goal", () => {
    const lines = describePlanFeasibility({ realistic: { ...base, feasible: true }, goalDurationMs: 2_400_000, predictedFinishMs: 2_706_000 })!;
    assert.equal(lines.tone, "warning");
    assert.match(lines.detail, /about 45:06, 5:06 slower than your goal/);
  });

  it("stays quiet when the predicted time is within 2% of the goal", () => {
    assert.equal(describePlanFeasibility({ realistic: { ...base, feasible: true }, goalDurationMs: 2_400_000, predictedFinishMs: 2_440_000 }), undefined);
  });

  it("when a finish is predicted it decides: power short but the finish is on goal says nothing about being out of reach", () => {
    const lines = describePlanFeasibility({ realistic: { ...base, achievedMeanWatts: 240, feasible: false }, goalDurationMs: 2_400_000, predictedFinishMs: 2_390_000 });
    assert.equal(lines, undefined);
  });

  it("words an out-of-reach goal relative to the rider's own best when the plan beats it", () => {
    const lines = describePlanFeasibility({
      realistic: { ...base, feasible: false },
      goalDurationMs: 2_340_000,
      predictedFinishMs: 2_472_000,
      bestEffortMs: 2_487_000,
    })!;
    assert.equal(lines.tone, "info");
    assert.equal(lines.headline, "Your 39:00 goal is a stretch for now, but your best is within reach.");
    assert.match(lines.detail, /about 41:12, 0:15 faster than your best of 41:27/);
  });

  it("mentions the rider's best when the plan cannot beat it", () => {
    const lines = describePlanFeasibility({
      realistic: { ...base, feasible: false },
      goalDurationMs: 2_340_000,
      predictedFinishMs: 2_520_000,
      bestEffortMs: 2_487_000,
    })!;
    assert.equal(lines.tone, "warning");
    assert.match(lines.detail, /about 42:00, 3:00 slower than your goal\. Your best so far is 41:27\./);
  });

  it("falls back to watts when no finish time can be predicted", () => {
    const lines = describePlanFeasibility({ realistic: { ...base, achievedMeanWatts: 244.4, feasible: false }, goalDurationMs: 2_400_000 })!;
    assert.match(lines.detail, /averages about 244 W, and your goal needs about 253 W/);
  });

  it("does not call a goal out of reach when the predicted finish is within a few seconds of it", () => {
    assert.equal(describePlanFeasibility({ realistic: { ...base, achievedMeanWatts: 252, feasible: false }, goalDurationMs: 2_400_000, predictedFinishMs: 2_405_000 }), undefined);
  });
});
