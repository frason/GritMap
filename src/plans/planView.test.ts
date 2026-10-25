import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGoalStages, buildSectionRows, classificationTone, formatSectionRange, goalProgress, lastSentLabel, planSourceLabel } from "./planView.ts";

describe("planView", () => {
  it("maps classifications to intensity tones", () => {
    assert.equal(classificationTone("REST"), "rest");
    assert.equal(classificationTone("HOLD"), "hold");
    assert.equal(classificationTone("PUSH"), "push");
  });

  it("formats section ranges in miles", () => {
    assert.equal(formatSectionRange(0, 804.672), "0.0–0.5 mi");
  });

  it("numbers sections from 1 with tone labels", () => {
    const rows = buildSectionRows([
      { startDistanceMeters: 0, endDistanceMeters: 1609.344, targetPowerWatts: 240, classification: "HOLD" },
      { startDistanceMeters: 1609.344, endDistanceMeters: 3218.688, targetPowerWatts: 300, classification: "PUSH" },
    ]);
    assert.deepEqual(rows.map((r) => [r.number, r.watts, r.tone, r.toneLabel]), [[1, 240, "hold", "Hold"], [2, 300, "push", "Push"]]);
  });

  it("goal progress is 1 at or past the goal and a ratio before it", () => {
    assert.equal(goalProgress(undefined, 600_000), undefined);
    assert.equal(goalProgress(590_000, 600_000), 1);
    assert.equal(goalProgress(1_200_000, 600_000), 0.5);
  });

  it("builds stages in order and skips what is missing", () => {
    assert.deepEqual(buildGoalStages({ nextGoalMs: 600_000 }).map((s) => s.key), ["next"]);
    assert.deepEqual(buildGoalStages({ bestMs: 650_000, nextGoalMs: 600_000, longTermMs: 540_000 }).map((s) => s.key), ["best", "next", "long-term"]);
    assert.equal(buildGoalStages({ nextGoalMs: 600_000 })[0]!.label, "Goal");
  });

  it("labels last sent only when something was sent", () => {
    assert.equal(lastSentLabel(undefined), undefined);
    assert.match(lastSentLabel(new Date(2026, 9, 5, 12).getTime())!, /^Last sent Oct 5$/);
  });

  it("labels the plan source", () => {
    assert.equal(planSourceLabel({ origin: "generated" }), "GritMap plan");
    assert.equal(planSourceLabel({ origin: "imported", source: "human-coach", authorLabel: "Sam" }), "Coach plan · Sam");
    assert.equal(planSourceLabel({ origin: "imported", source: "self" }), "Your plan");
  });
});
