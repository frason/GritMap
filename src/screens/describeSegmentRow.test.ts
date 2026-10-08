import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeSegmentRow } from "./describeSegmentRow.ts";

describe("describeSegmentRow", () => {
  it("gives distance and effort count, in plain words", () => {
    assert.equal(describeSegmentRow({ distanceMeters: 1_609.344, effortCount: 3 }), "1.0 mi · 3 efforts");
    assert.equal(describeSegmentRow({ distanceMeters: 1_609.344, effortCount: 1 }), "1.0 mi · 1 effort");
  });

  it("says when there are no efforts, and copes with no distance", () => {
    assert.equal(describeSegmentRow({ distanceMeters: 800, effortCount: 0 }), "0.5 mi · No efforts yet");
    assert.equal(describeSegmentRow({ effortCount: 2 }), "2 efforts");
  });

  it("never shows an internal term", () => {
    assert.doesNotMatch(describeSegmentRow({ distanceMeters: 800, effortCount: 0 }), /corridor/i);
  });
});
