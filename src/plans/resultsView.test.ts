import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { gapToBestLabel, resultsPoints } from "./resultsView.ts";

describe("resultsPoints", () => {
  it("places efforts by date and time, faster higher up, and ranks them", () => {
    const points = resultsPoints([
      { attemptId: "b", startTimestampMs: 2_000, durationMs: 600_000 },
      { attemptId: "a", startTimestampMs: 1_000, durationMs: 700_000 },
      { attemptId: "c", startTimestampMs: 3_000, durationMs: 650_000 },
    ]);
    assert.deepEqual(points.map((p) => p.attemptId), ["a", "b", "c"]);
    assert.deepEqual(points.map((p) => p.x), [0, 0.5, 1]);
    assert.deepEqual(points.map((p) => p.y), [1, 0, 0.5]);
    assert.deepEqual(points.map((p) => p.rank), [3, 1, 2]);
    assert.deepEqual(points.map((p) => p.isBest), [false, true, false]);
  });

  it("centres a lone effort and efforts that tie", () => {
    const [only] = resultsPoints([{ attemptId: "a", startTimestampMs: 5, durationMs: 100 }]);
    assert.equal(only?.x, 0.5);
    assert.equal(only?.y, 0.5);
    assert.equal(only?.isBest, true);
  });

  it("returns nothing for no efforts", () => {
    assert.deepEqual(resultsPoints([]), []);
  });
});

describe("gapToBestLabel", () => {
  const format = (ms: number) => `${Math.round(ms / 1000)}s`;
  it("says Best for the best, and the gap otherwise", () => {
    assert.equal(gapToBestLabel(100_000, 100_000, format), "Best");
    assert.equal(gapToBestLabel(142_000, 100_000, format), "+42s off your best");
    assert.equal(gapToBestLabel(1, undefined, format), undefined);
  });
});
