import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { segmentInsight } from "./segmentInsights.ts";

const format = (ms: number) => `${Math.round(ms / 1000)}s`;
const effort = (attemptId: string, startTimestampMs: number, durationMs: number) => ({ attemptId, startTimestampMs, durationMs });

describe("segmentInsight", () => {
  it("has nothing to say without counted efforts", () => {
    assert.equal(segmentInsight({ efforts: [], format }), undefined);
  });

  it("a first effort is compared only with the goal", () => {
    const insight = segmentInsight({ efforts: [effort("a", 1, 100_000)], goalMs: 90_000, format });
    assert.deepEqual(insight?.lines, ["10s over your goal", "Your first effort here"]);
    assert.equal(insight?.attemptId, "a");
  });

  it("calls out a new personal best without repeating it as a trend", () => {
    const insight = segmentInsight({ efforts: [effort("a", 1, 100_000), effort("b", 2, 90_000)], goalMs: 95_000, format });
    assert.deepEqual(insight?.lines, ["5s under your goal", "New personal best, 10s faster than before"]);
  });

  it("shows the gap to the best and the trend when the latest is slower", () => {
    const insight = segmentInsight({ efforts: [effort("a", 1, 80_000), effort("b", 2, 90_000), effort("c", 3, 85_000)], format });
    assert.deepEqual(insight?.lines, ["5s off your best", "Faster than your previous effort by 5s"]);
  });

  it("uses dates, not input order, to find the latest", () => {
    const insight = segmentInsight({ efforts: [effort("late", 9, 100_000), effort("early", 1, 120_000)], format });
    assert.equal(insight?.attemptId, "late");
  });

  it("says when the latest matches the best", () => {
    const insight = segmentInsight({ efforts: [effort("a", 1, 100_000), effort("b", 2, 100_000)], format });
    assert.deepEqual(insight?.lines, ["Matches your best"]);
  });
});
