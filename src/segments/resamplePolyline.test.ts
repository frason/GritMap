import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resamplePolyline } from "./resamplePolyline.ts";

const METERS_PER_DEGREE = 111_195;

describe("resamplePolyline", () => {
  it("returns an empty array for no points", () => {
    assert.deepEqual(resamplePolyline([], 10), []);
  });

  it("returns a single point at distance 0 for one input point", () => {
    const result = resamplePolyline([{ lat: 37.0, lng: -122.0, elevationMeters: 100 }], 10);
    assert.deepEqual(result, [{ lat: 37.0, lng: -122.0, distanceMeters: 0, elevationMeters: 100 }]);
  });

  it("resamples a straight 100m line every 10m, starting at 0 and ending exactly at the endpoint", () => {
    // A straight line along the equator, 100m long (1 degree of longitude == METERS_PER_DEGREE).
    const start = { lat: 0, lng: 0 };
    const end = { lat: 0, lng: 100 / METERS_PER_DEGREE };
    const result = resamplePolyline([start, end], 10);

    assert.equal(result.length, 11);
    assert.equal(result[0]?.distanceMeters, 0);
    // Last emitted distance must be within float tolerance of the true total (~100m), not
    // silently truncated to the last exact-multiple station.
    const total = result[result.length - 1]!.distanceMeters;
    assert.ok(Math.abs(total - 100) < 1, `expected ~100m total, got ${total}`);
    for (let i = 1; i < result.length; i += 1) {
      assert.ok(result[i]!.distanceMeters > result[i - 1]!.distanceMeters, "distances must strictly increase");
    }
  });

  it("emits the exact final endpoint (no duplicate) when the total is not an exact multiple of the interval", () => {
    const start = { lat: 0, lng: 0 };
    const end = { lat: 0, lng: 25 / METERS_PER_DEGREE };
    const result = resamplePolyline([start, end], 10);

    // Stations at 0, 10, 20, then the exact endpoint (~25m) -- 4 points, not 5.
    assert.equal(result.length, 4);
    assert.deepEqual(
      result.map((p) => Math.round(p.distanceMeters * 10) / 10),
      [0, 10, 20, 25],
    );
  });

  it("does not duplicate the final point when the total is an exact multiple of the interval", () => {
    const start = { lat: 0, lng: 0 };
    const end = { lat: 0, lng: 20 / METERS_PER_DEGREE };
    const result = resamplePolyline([start, end], 10);

    assert.equal(result.length, 3);
    assert.deepEqual(
      result.map((p) => Math.round(p.distanceMeters * 10) / 10),
      [0, 10, 20],
    );
  });

  it("interpolates elevation linearly when both bracketing points have it", () => {
    const start = { lat: 0, lng: 0, elevationMeters: 100 };
    const end = { lat: 0, lng: 20 / METERS_PER_DEGREE, elevationMeters: 120 };
    const result = resamplePolyline([start, end], 10);

    assert.equal(result[0]?.elevationMeters, 100);
    assert.ok(result[1]?.elevationMeters !== undefined && Math.abs(result[1].elevationMeters - 110) < 1);
    assert.equal(result[2]?.elevationMeters, 120);
  });

  it("omits elevation when either bracketing point lacks it", () => {
    const start = { lat: 0, lng: 0, elevationMeters: 100 };
    const end = { lat: 0, lng: 20 / METERS_PER_DEGREE }; // no elevation
    const result = resamplePolyline([start, end], 10);

    for (const point of result) {
      assert.ok(!("elevationMeters" in point) || point.elevationMeters === undefined);
    }
  });

  it("handles a zero-length leg (duplicate consecutive point) without producing NaN", () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0 }, // duplicate fix, zero-length leg
      { lat: 0, lng: 20 / METERS_PER_DEGREE },
    ];
    const result = resamplePolyline(points, 10);

    for (const point of result) {
      assert.ok(Number.isFinite(point.lat) && Number.isFinite(point.lng));
    }
    assert.equal(result[0]?.distanceMeters, 0);
    assert.ok(Math.abs(result[result.length - 1]!.distanceMeters - 20) < 1);
  });

  it("handles a selection shorter than the interval by emitting start and exact end only", () => {
    const start = { lat: 0, lng: 0 };
    const end = { lat: 0, lng: 5 / METERS_PER_DEGREE };
    const result = resamplePolyline([start, end], 10);

    assert.equal(result.length, 2);
    assert.equal(result[0]?.distanceMeters, 0);
    assert.ok(Math.abs(result[1]!.distanceMeters - 5) < 1);
  });
});
