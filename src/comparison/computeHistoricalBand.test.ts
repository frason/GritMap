import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeHistoricalBand } from "./computeHistoricalBand.ts";
import type { SegmentAttempt } from "./compareAttempts.ts";

function attempt(id: string, powerAtEachSample: number[]): SegmentAttempt {
  return {
    id,
    segmentId: "segment-1",
    rideId: `ride-${id}`,
    startTimestampMs: 0,
    endTimestampMs: powerAtEachSample.length * 1_000,
    points: powerAtEachSample.map((power, index) => ({
      distanceMeters: index * 10,
      timestampMs: index * 1_000,
      power,
    })),
  };
}

describe("computeHistoricalBand", () => {
  it("returns an empty array given no attempts", () => {
    assert.deepEqual(computeHistoricalBand([], "missing", "power"), []);
  });

  it("throws if currentAttemptId isn't one of the given attempts", () => {
    assert.throws(() => computeHistoricalBand([attempt("a", [200, 200])], "missing", "power"));
  });

  it("throws if attempts belong to different segments", () => {
    const a = attempt("a", [200]);
    const b = { ...attempt("b", [200]), segmentId: "segment-2" };
    assert.throws(() => computeHistoricalBand([a, b], "a", "power"));
  });

  it("computes min/max across attempts and carries the current attempt's own value", () => {
    const low = attempt("low", [100, 100, 100]);
    const mid = attempt("mid", [200, 200, 200]);
    const high = attempt("high", [300, 300, 300]);

    const band = computeHistoricalBand([low, mid, high], "mid", "power");

    assert.equal(band.length, 3);
    for (const sample of band) {
      assert.equal(sample.min, 100);
      assert.equal(sample.max, 300);
      assert.equal(sample.current, 200);
    }
  });

  it("stops the band at the shortest attempt's distance, without extrapolating", () => {
    const short = attempt("short", [200, 200]); // 0, 10m
    const long = attempt("long", [200, 200, 200, 200]); // 0, 10, 20, 30m

    const band = computeHistoricalBand([short, long], "long", "power");

    assert.deepEqual(
      band.map((s) => s.distanceMeters),
      [0, 10],
    );
  });

  it("a single attempt produces a zero-width band equal to its own value, with itself as current", () => {
    const only = attempt("only", [150, 250]);
    const band = computeHistoricalBand([only], "only", "power");
    assert.deepEqual(band, [
      { distanceMeters: 0, min: 150, max: 150, current: 150 },
      { distanceMeters: 10, min: 250, max: 250, current: 250 },
    ]);
  });

  it("treats a gap wider than maxInterpolationGapMs as missing (null), not zero", () => {
    const gappy: SegmentAttempt = {
      id: "gappy",
      segmentId: "segment-1",
      rideId: "ride-gappy",
      startTimestampMs: 0,
      endTimestampMs: 40_000,
      points: [
        { distanceMeters: 0, timestampMs: 0, power: 200 },
        { distanceMeters: 100, timestampMs: 40_000, power: 300 }, // 40s gap > default 30s
      ],
    };
    const band = computeHistoricalBand([gappy], "gappy", "power");
    const midSample = band.find((s) => s.distanceMeters === 50);
    assert.deepEqual(midSample, { distanceMeters: 50, min: null, max: null, current: null });
  });

  it("rejects a non-positive stepMeters", () => {
    assert.throws(() =>
      computeHistoricalBand([attempt("a", [200])], "a", "power", { stepMeters: 0 }),
    );
  });
});
