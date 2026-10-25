import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clampProgress, progressAccessibilityValue } from "./progress.ts";

describe("clampProgress", () => {
  it("keeps in-range values and pulls the rest into 0 to 1", () => {
    assert.equal(clampProgress(0.4), 0.4);
    assert.equal(clampProgress(-2), 0);
    assert.equal(clampProgress(3), 1);
  });

  it("treats a missing number as no progress", () => {
    assert.equal(clampProgress(Number.NaN), 0);
    assert.equal(clampProgress(Number.POSITIVE_INFINITY), 0);
  });
});

describe("progressAccessibilityValue", () => {
  it("reports whole percent", () => {
    assert.deepEqual(progressAccessibilityValue(0.784), { min: 0, max: 100, now: 78 });
    assert.deepEqual(progressAccessibilityValue(2), { min: 0, max: 100, now: 100 });
  });
});
