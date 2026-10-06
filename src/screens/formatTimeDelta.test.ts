import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatTimeDelta } from "./formatTimeDelta.ts";

describe("formatTimeDelta", () => {
  it("signs and pads", () => {
    assert.equal(formatTimeDelta(12_000), "+0:12");
    assert.equal(formatTimeDelta(-65_000), "-1:05");
    assert.equal(formatTimeDelta(125_400), "+2:05");
  });
  it("reads as even under half a second", () => {
    assert.equal(formatTimeDelta(0), "even");
    assert.equal(formatTimeDelta(-400), "even");
    assert.equal(formatTimeDelta(499), "even");
    assert.equal(formatTimeDelta(500), "+0:01");
  });
});
