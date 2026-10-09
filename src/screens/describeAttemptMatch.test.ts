import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeAttemptStatus, describeMatchDetails, describeMatchReason } from "./describeAttemptMatch.ts";
import { averageOf, describeChannelAverages, describeOverallGap } from "./describeComparison.ts";

describe("describeAttemptMatch", () => {
  it("explains every reason the matcher can give in plain words, with no internal terms", () => {
    for (const reason of ["insufficient-coverage", "implausible-gap-speed", "backward-progress", "different-route", "reverse-traversal"]) {
      const text = describeMatchReason(reason);
      assert.doesNotMatch(text, /coverage|deviation|matcher|-/i, reason);
      assert.ok(text.length > 30);
    }
  });

  it("makes an unknown reason readable instead of showing the raw code", () => {
    assert.equal(describeMatchReason("odd-thing"), "Odd thing.");
  });

  it("names the three states", () => {
    assert.equal(describeAttemptStatus("borderline", false).label, "Needs your review");
    assert.equal(describeAttemptStatus("accept", false).label, "Matched");
    assert.equal(describeAttemptStatus("borderline", true).label, "Approved by you");
    assert.equal(describeAttemptStatus("borderline", true).tone, "success");
  });

  it("renames the diagnostics and explains each", () => {
    const details = describeMatchDetails({ confidenceScore: 0.874, coveragePct: 0.93, maxDeviationMeters: 41.4, medianDeviationMeters: 6.2, maxBackwardMeters: 0, gpsGapCount: 2, maxGapMs: 95_000 });
    const labels = details.map((detail) => detail.label);
    assert.deepEqual(labels, ["Match", "Route followed", "Furthest off the route", "Usually off the route by", "Backtracking", "GPS dropouts", "Longest dropout"]);
    assert.equal(details[0]!.value, "87%");
    assert.equal(details[2]!.value, "41 m");
    assert.equal(details[6]!.value, "1 min 35 s");
    for (const detail of details) {
      assert.doesNotMatch(`${detail.label} ${detail.meaning}`, /coverage|deviation|matcher/i);
    }
  });

  it("leaves out the typical-distance row when there is no median", () => {
    const details = describeMatchDetails({ confidenceScore: 1, coveragePct: 1, maxDeviationMeters: 3, maxBackwardMeters: 0, gpsGapCount: 0, maxGapMs: 0 });
    assert.equal(details.some((detail) => detail.label === "Usually off the route by"), false);
  });
});

describe("describeComparison", () => {
  it("says who was ahead", () => {
    assert.equal(describeOverallGap(41 * 60_000, 44 * 60_000), "You finished 3:00 ahead of the other effort.");
    assert.equal(describeOverallGap(45 * 60_000 + 5_000, 44 * 60_000), "You finished 1:05 behind the other effort.");
    assert.equal(describeOverallGap(44 * 60_000 + 200, 44 * 60_000), "You finished level with the other effort.");
  });

  it("averages only real values", () => {
    assert.equal(averageOf([null, null]), undefined);
    assert.equal(averageOf([100, null, 200]), 150);
  });

  it("summarises a channel for a screen reader, including missing data", () => {
    assert.equal(describeChannelAverages({ name: "Power", unit: "W", primary: 250, comparison: 244.6 }), "Power averaged 250 W for this effort and 245 W for the other.");
    assert.match(describeChannelAverages({ name: "Heart rate", unit: "bpm", primary: 150, comparison: undefined })!, /the other has no data/);
    assert.equal(describeChannelAverages({ name: "Power", unit: "W", primary: undefined, comparison: undefined }), undefined);
  });
});
