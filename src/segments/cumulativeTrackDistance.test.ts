import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeCumulativeTrackDistance, nearestByDistance } from "./cumulativeTrackDistance.ts";
import type { RideTrackPoint } from "../db/getRideTrack.ts";

const METERS_PER_DEGREE = 111_195;

function trackPoint(pointIndex: number, xMeters: number, elevationMeters?: number): RideTrackPoint {
  return {
    pointIndex,
    timestampMs: pointIndex * 1_000,
    lat: 0,
    lng: xMeters / METERS_PER_DEGREE,
    ...(elevationMeters === undefined ? {} : { elevationMeters }),
  };
}

describe("computeCumulativeTrackDistance", () => {
  it("returns an empty array for no points", () => {
    assert.deepEqual(computeCumulativeTrackDistance([]), []);
  });

  it("starts at 0 and accumulates true haversine distance along a straight line", () => {
    const points = [trackPoint(0, 0), trackPoint(1, 10), trackPoint(2, 30)];
    const result = computeCumulativeTrackDistance(points);
    assert.equal(result[0]?.distanceMeters, 0);
    assert.ok(Math.abs(result[1]!.distanceMeters - 10) < 0.5);
    assert.ok(Math.abs(result[2]!.distanceMeters - 30) < 0.5);
  });

  it("preserves pointIndex from the source track (not array position)", () => {
    const points = [trackPoint(5, 0), trackPoint(9, 10)];
    const result = computeCumulativeTrackDistance(points);
    assert.deepEqual(
      result.map((p) => p.pointIndex),
      [5, 9],
    );
  });

  it("carries elevation through unchanged", () => {
    const points = [trackPoint(0, 0, 100), trackPoint(1, 10)];
    const result = computeCumulativeTrackDistance(points);
    assert.equal(result[0]?.elevationMeters, 100);
    assert.ok(!("elevationMeters" in result[1]!));
  });
});

describe("nearestByDistance", () => {
  it("returns undefined for an empty array", () => {
    assert.equal(nearestByDistance([], 50), undefined);
  });

  it("finds the closest point by cumulative distance", () => {
    const indexed = computeCumulativeTrackDistance([
      trackPoint(0, 0),
      trackPoint(1, 10),
      trackPoint(2, 20),
      trackPoint(3, 30),
    ]);
    assert.equal(nearestByDistance(indexed, 22)?.pointIndex, 2);
    assert.equal(nearestByDistance(indexed, 0)?.pointIndex, 0);
    assert.equal(nearestByDistance(indexed, 1_000)?.pointIndex, 3);
  });
});
