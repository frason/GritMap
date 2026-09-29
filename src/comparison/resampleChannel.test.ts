import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { interpolateChannel, interpolateTimestamp, preparePoints } from "./resampleChannel.ts";

describe("preparePoints", () => {
  it("sorts by distance, then by timestamp for ties", () => {
    const points = preparePoints([
      { distanceMeters: 20, timestampMs: 1_000 },
      { distanceMeters: 0, timestampMs: 500 },
      { distanceMeters: 10, timestampMs: 2_000 },
      { distanceMeters: 10, timestampMs: 900 },
    ]);
    assert.deepEqual(
      points.map((p) => [p.distanceMeters, p.timestampMs]),
      [
        [0, 500],
        [10, 900],
        [10, 2_000],
        [20, 1_000],
      ],
    );
  });

  it("rejects a negative or non-finite distance", () => {
    assert.throws(() => preparePoints([{ distanceMeters: -1, timestampMs: 0 }]));
    assert.throws(() => preparePoints([{ distanceMeters: Number.NaN, timestampMs: 0 }]));
  });

  it("rejects a non-finite timestamp", () => {
    assert.throws(() => preparePoints([{ distanceMeters: 0, timestampMs: Number.NaN }]));
  });
});

describe("interpolateChannel", () => {
  const points = preparePoints([
    { distanceMeters: 0, timestampMs: 0, power: 200 },
    { distanceMeters: 100, timestampMs: 10_000, power: 300 },
  ]);

  it("returns the exact value at a matching sample point", () => {
    assert.equal(interpolateChannel(points, 0, "power", 30_000), 200);
    assert.equal(interpolateChannel(points, 100, "power", 30_000), 300);
  });

  it("linearly interpolates between two points", () => {
    assert.equal(interpolateChannel(points, 50, "power", 30_000), 250);
  });

  it("returns null outside the observed range (no extrapolation)", () => {
    assert.equal(interpolateChannel(points, -10, "power", 30_000), null);
    assert.equal(interpolateChannel(points, 200, "power", 30_000), null);
  });

  it("returns null across a gap wider than maxGapMs", () => {
    const gappy = preparePoints([
      { distanceMeters: 0, timestampMs: 0, power: 200 },
      { distanceMeters: 100, timestampMs: 40_000, power: 300 }, // 40s gap
    ]);
    assert.equal(interpolateChannel(gappy, 50, "power", 30_000), null);
  });

  it("ignores points where the channel is absent", () => {
    const sparse = preparePoints([
      { distanceMeters: 0, timestampMs: 0, power: 200 },
      { distanceMeters: 50, timestampMs: 5_000 }, // no power recorded here
      { distanceMeters: 100, timestampMs: 10_000, power: 300 },
    ]);
    // Interpolates straight across the point missing this channel, using the two that have it.
    assert.equal(interpolateChannel(sparse, 50, "power", 30_000), 250);
  });

  it("returns null for a channel that's absent from every point", () => {
    assert.equal(interpolateChannel(points, 50, "heartRate", 30_000), null);
  });
});

describe("interpolateTimestamp", () => {
  it("linearly interpolates elapsed time between two points", () => {
    const points = preparePoints([
      { distanceMeters: 0, timestampMs: 1_000 },
      { distanceMeters: 100, timestampMs: 11_000 },
    ]);
    assert.equal(interpolateTimestamp(points, 50, 30_000), 6_000);
  });
});
