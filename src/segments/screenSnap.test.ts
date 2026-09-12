import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nearestScreenSnapCandidate, sampleForHandleSnapping } from "./screenSnap.ts";

describe("sampleForHandleSnapping", () => {
  it("returns every point unchanged when already at or under the cap", () => {
    const points = [
      { lat: 0, lng: 0, distanceMeters: 0 },
      { lat: 1, lng: 1, distanceMeters: 10 },
    ];
    assert.deepEqual(sampleForHandleSnapping(points, 5), points);
  });

  it("always includes the first and last point", () => {
    const points = Array.from({ length: 1_000 }, (_, i) => ({
      lat: i,
      lng: i,
      distanceMeters: i * 10,
    }));
    const sampled = sampleForHandleSnapping(points, 50);
    assert.equal(sampled[0], points[0]);
    assert.equal(sampled.at(-1), points.at(-1));
  });

  it("never returns more than maxPoints", () => {
    const points = Array.from({ length: 1_000 }, (_, i) => ({
      lat: i,
      lng: i,
      distanceMeters: i * 10,
    }));
    assert.ok(sampleForHandleSnapping(points, 50).length <= 50);
  });

  it("is roughly evenly spaced by array position", () => {
    const points = Array.from({ length: 100 }, (_, i) => ({
      lat: 0,
      lng: 0,
      distanceMeters: i,
    }));
    const sampled = sampleForHandleSnapping(points, 10);
    const distances = sampled.map((p) => p.distanceMeters);
    for (let i = 1; i < distances.length; i += 1) {
      assert.ok(distances[i]! > distances[i - 1]!, "sampled points must be strictly increasing");
    }
  });

  it("handles maxPoints of 1 by returning just the last point", () => {
    const points = [
      { lat: 0, lng: 0, distanceMeters: 0 },
      { lat: 1, lng: 1, distanceMeters: 10 },
      { lat: 2, lng: 2, distanceMeters: 20 },
    ];
    assert.deepEqual(sampleForHandleSnapping(points, 1), [points[2]]);
  });

  it("handles an empty input", () => {
    assert.deepEqual(sampleForHandleSnapping([], 10), []);
  });
});

describe("nearestScreenSnapCandidate", () => {
  it("finds the closest candidate by screen-space Euclidean distance", () => {
    const candidates = [
      { x: 0, y: 0, distanceMeters: 0 },
      { x: 100, y: 0, distanceMeters: 100 },
      { x: 200, y: 0, distanceMeters: 200 },
    ];
    assert.deepEqual(nearestScreenSnapCandidate(candidates, { x: 90, y: 5 }), {
      x: 100,
      y: 0,
      distanceMeters: 100,
    });
  });

  it("returns undefined for an empty candidate list", () => {
    assert.equal(nearestScreenSnapCandidate([], { x: 0, y: 0 }), undefined);
  });

  it("breaks exact ties by keeping the first candidate seen", () => {
    const candidates = [
      { x: 0, y: 0, distanceMeters: 10 },
      { x: 10, y: 0, distanceMeters: 20 },
    ];
    assert.equal(nearestScreenSnapCandidate(candidates, { x: 5, y: 0 })?.distanceMeters, 10);
  });
});
