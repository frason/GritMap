import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { settleStop, sheetHeights, stepStop } from "./sheetSnap.ts";

describe("sheetSnap", () => {
  const heights = sheetHeights(800);
  it("has three stops: peek, half, nearly full", () => {
    assert.deepEqual(heights, { peek: 112, half: 400, full: 720 });
  });
  it("settles to the nearest stop on a slow release", () => {
    assert.equal(settleStop(150, 0, heights), "peek");
    assert.equal(settleStop(380, 0.1, heights), "half");
    assert.equal(settleStop(700, 0, heights), "full");
  });
  it("a fast flick moves one stop in its direction", () => {
    assert.equal(settleStop(400, 1, heights), "full");
    assert.equal(settleStop(400, -1, heights), "peek");
    assert.equal(settleStop(720, 1, heights), "full");
  });
  it("steps for accessibility actions and stops at the ends", () => {
    assert.equal(stepStop("half", "up"), "full");
    assert.equal(stepStop("full", "up"), "full");
    assert.equal(stepStop("peek", "down"), "peek");
  });
  it("never lets the peek exceed a tiny container", () => {
    const small = sheetHeights(100);
    assert.ok(small.peek <= small.full);
  });
});
