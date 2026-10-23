import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describePlanFeasibility } from "./describePlanFeasibility.ts";

const base = { requiredMeanWatts: 253, achievedMeanWatts: 253, trimmedZoneIndices: [] as number[] };

describe("describePlanFeasibility", () => {
  it("says nothing when the plan met the goal and nothing was cut", () => {
    assert.equal(describePlanFeasibility({ realistic: { ...base, feasible: true }, goalDurationMs: 2_400_000 }), undefined);
  });

  it("says targets were held back, and the goal still holds, when trimmed zones were made up for", () => {
    const lines = describePlanFeasibility({ realistic: { ...base, feasible: true, trimmedZoneIndices: [12, 18] }, goalDurationMs: 2_400_000, hasHistory: true })!;
    assert.equal(lines.tone, "info");
    assert.match(lines.detail, /2 sections were kept within what you have held/);
    assert.match(lines.detail, /40:00 goal still holds\. GritMap plans no more power than you have held on this climb; it grows as you set new bests\./);
    const one = describePlanFeasibility({ realistic: { ...base, feasible: true, trimmedZoneIndices: [12] }, goalDurationMs: 2_400_000, hasHistory: true })!;
    assert.match(one.detail, /One section was kept/);
  });

  it("names the best achievable time and the gap when the goal is out of reach", () => {
    const lines = describePlanFeasibility({
      realistic: { ...base, achievedMeanWatts: 244, feasible: false },
      goalDurationMs: 2_400_000,
      predictedFinishMs: 2_495_000,
      hasHistory: true,
    })!;
    assert.equal(lines.tone, "warning");
    assert.equal(lines.headline, "Your 40:00 goal looks out of reach for now.");
    assert.match(lines.detail, /about 41:35, 1:35 slower than your goal/);
    assert.match(lines.detail, /plans no more power than you have held on this climb, or than your effort budget allows\. That grows as you set new bests\./);
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
      goalDurationMs: 2_280_000,
      predictedFinishMs: 2_412_000,
      bestEffortMs: 2_427_000,
    })!;
    assert.equal(lines.tone, "info");
    assert.equal(lines.headline, "Your 38:00 goal is a stretch for now, but your best is within reach.");
    assert.match(lines.detail, /about 40:12, 0:15 faster than your best of 40:27/);
  });

  it("mentions the rider's best when the plan cannot beat it", () => {
    const lines = describePlanFeasibility({
      realistic: { ...base, feasible: false },
      goalDurationMs: 2_280_000,
      predictedFinishMs: 2_520_000,
      bestEffortMs: 2_427_000,
    })!;
    assert.equal(lines.tone, "warning");
    assert.match(lines.detail, /about 42:00, 4:00 slower than your goal\. Your best so far is 40:27\./);
  });

  it("falls back to watts when no finish time can be predicted", () => {
    const lines = describePlanFeasibility({ realistic: { ...base, achievedMeanWatts: 244.4, feasible: false }, goalDurationMs: 2_400_000, hasHistory: true })!;
    assert.match(lines.detail, /averages about 244 W, and your goal needs about 253 W/);
  });

  it("does not call a goal out of reach when the predicted finish is within a few seconds of it", () => {
    assert.equal(describePlanFeasibility({ realistic: { ...base, achievedMeanWatts: 252, feasible: false }, goalDurationMs: 2_400_000, predictedFinishMs: 2_405_000 }), undefined);
  });
});

describe("describePlanFeasibility without history, and for an easy goal", () => {
  it("says nothing about 'held back' when the rider has no history (the limits are general, not their own)", () => {
    assert.equal(
      describePlanFeasibility({ realistic: { ...base, feasible: true, trimmedZoneIndices: [3, 4, 5] }, goalDurationMs: 2_400_000 }),
      undefined,
    );
  });

  it("still says 'held back' when history ceilings exist", () => {
    const lines = describePlanFeasibility({ realistic: { ...base, feasible: true, trimmedZoneIndices: [3] }, goalDurationMs: 2_400_000, hasHistory: true })!;
    assert.equal(lines.headline, "Some targets were held back.");
  });

  it("does not claim the rider has held power on a climb they have not ridden, when the goal is out of reach", () => {
    const lines = describePlanFeasibility({
      realistic: { ...base, feasible: false },
      goalDurationMs: 2_400_000,
      predictedFinishMs: 2_700_000,
    })!;
    assert.doesNotMatch(lines.detail, /have held on this climb/);
    assert.match(lines.detail, /GritMap will tighten this plan once you have ridden the segment\./);
  });

  it("warns when the goal is easier than a normal effort, ahead of anything else", () => {
    const lines = describePlanFeasibility({
      realistic: { ...base, feasible: true, trimmedZoneIndices: [1, 2] },
      goalDurationMs: 480_000,
      hasHistory: true,
      goalBelowNormalEffort: true,
    })!;
    assert.equal(lines.tone, "warning");
    assert.equal(lines.headline, "This goal is easier than a normal effort, so the plan is flat.");
    assert.equal(lines.detail, "Try a faster goal to get a plan that changes with the climb.");
  });
});

