import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampRangeEnd,
  clampRangeStart,
  MIN_SEGMENT_RANGE_GAP_METERS,
} from "./clampSegmentRange.ts";

describe("clampRangeStart", () => {
  it("passes through a candidate within range", () => {
    assert.equal(clampRangeStart(50, 100), 50);
  });

  it("clamps to 0 when the candidate is negative", () => {
    assert.equal(clampRangeStart(-20, 100), 0);
  });

  it("never lets start reach end -- stops MIN_SEGMENT_RANGE_GAP_METERS short", () => {
    assert.equal(clampRangeStart(95, 100), 100 - MIN_SEGMENT_RANGE_GAP_METERS);
    assert.equal(clampRangeStart(1_000, 100), 100 - MIN_SEGMENT_RANGE_GAP_METERS);
  });
});

describe("clampRangeEnd", () => {
  it("passes through a candidate within range", () => {
    assert.equal(clampRangeEnd(80, 0, 100), 80);
  });

  it("clamps to totalDistanceMeters when the candidate overshoots", () => {
    assert.equal(clampRangeEnd(1_000, 0, 100), 100);
  });

  it("never lets end reach start -- stays MIN_SEGMENT_RANGE_GAP_METERS ahead", () => {
    assert.equal(clampRangeEnd(5, 0, 100), MIN_SEGMENT_RANGE_GAP_METERS);
    assert.equal(clampRangeEnd(-50, 0, 100), MIN_SEGMENT_RANGE_GAP_METERS);
  });
});
