import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { segmentCardPlan } from "./segmentCardView.ts";

describe("segmentCardPlan", () => {
  it("says what is missing", () => {
    assert.equal(segmentCardPlan({ kind: "needs-ftp" }).line, "Set your FTP to get a plan");
    assert.deepEqual(segmentCardPlan({ kind: "needs-goal" }), { tones: [], line: "No plan yet · set a goal" });
  });
  it("gives a tone per section and the goal and prediction", () => {
    const card = segmentCardPlan({
      kind: "plan", origin: "generated", sourceLabel: "GritMap plan", needsWeight: false,
      zones: [{ startDistanceMeters: 0, endDistanceMeters: 1, targetPowerWatts: 200, classification: "HOLD" }, { startDistanceMeters: 1, endDistanceMeters: 2, targetPowerWatts: 300, classification: "PUSH" }],
      sections: [], summary: { sectionCount: 2, averageWatts: 250, percentOfFtp: 90, minWatts: 200, maxWatts: 300 },
      goal: { nextMs: 600_000, stages: [] },
      prediction: { durationMs: 605_000, lines: { headline: "", basis: "" } },
    });
    assert.deepEqual(card.tones, ["hold", "push"]);
    assert.equal(card.line, "Goal 10:00 · Predicted 10:05");
  });
});
