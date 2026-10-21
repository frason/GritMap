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

  it("falls back to watts when no finish time can be predicted", () => {
    const lines = describePlanFeasibility({ realistic: { ...base, achievedMeanWatts: 244.4, feasible: false }, goalDurationMs: 2_400_000 })!;
    assert.match(lines.detail, /averages about 244 W, and your goal needs about 253 W/);
  });

  it("does not quote a negligible gap as a time", () => {
    const lines = describePlanFeasibility({ realistic: { ...base, achievedMeanWatts: 252, feasible: false }, goalDurationMs: 2_400_000, predictedFinishMs: 2_405_000 })!;
    assert.match(lines.detail, /averages about 252 W/);
  });
});
