import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeAnchorPowerWatts, pctFtpForDuration, POWER_DURATION_ANCHORS } from "./powerDurationAnchor.ts";

describe("pctFtpForDuration", () => {
  it("returns the exact table value at each anchor duration", () => {
    for (const anchor of POWER_DURATION_ANCHORS) {
      assert.equal(pctFtpForDuration(anchor.durationMinutes), anchor.pctFtp);
    }
  });

  it("interpolates strictly between two anchors, log-linearly", () => {
    const value = pctFtpForDuration(40); // between the 30min (1.02) and 60min (1.00) anchors
    assert.ok(value < 1.02 && value > 1.0);

    const t = (Math.log(40) - Math.log(30)) / (Math.log(60) - Math.log(30));
    const expected = 1.02 + t * (1.0 - 1.02);
    assert.ok(Math.abs(value - expected) < 1e-9);
  });

  it("clamps below the shortest anchor and above the longest, without extrapolating", () => {
    assert.equal(pctFtpForDuration(1), 1.2);
    assert.equal(pctFtpForDuration(600), 0.85);
  });

  it("throws for a non-positive or non-finite duration", () => {
    assert.throws(() => pctFtpForDuration(0), RangeError);
    assert.throws(() => pctFtpForDuration(-10), RangeError);
    assert.throws(() => pctFtpForDuration(Number.NaN), RangeError);
  });
});

describe("computeAnchorPowerWatts", () => {
  it("lands close to 100-103% FTP for a ~39-40 minute goal, matching FTP's own definition", () => {
    const sub39 = computeAnchorPowerWatts(280, 39 * 60_000);
    const old4030 = computeAnchorPowerWatts(280, 40.5 * 60_000);
    assert.ok(sub39 >= 280 * 1.0 && sub39 <= 280 * 1.03);
    assert.ok(old4030 >= 280 * 1.0 && old4030 <= 280 * 1.03);
  });

  it("scales linearly with FTP for a fixed duration", () => {
    const low = computeAnchorPowerWatts(200, 20 * 60_000);
    const high = computeAnchorPowerWatts(400, 20 * 60_000);
    assert.ok(Math.abs(high - low * 2) < 1e-9);
  });

  it("throws for a non-positive or non-finite ftpWatts or targetDurationMs", () => {
    assert.throws(() => computeAnchorPowerWatts(0, 60_000), RangeError);
    assert.throws(() => computeAnchorPowerWatts(-280, 60_000), RangeError);
    assert.throws(() => computeAnchorPowerWatts(280, 0), RangeError);
    assert.throws(() => computeAnchorPowerWatts(280, Number.NaN), RangeError);
  });
});
