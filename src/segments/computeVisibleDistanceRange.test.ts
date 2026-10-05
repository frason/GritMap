import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeVisibleDistanceRange } from "./computeVisibleDistanceRange.ts";

const FULL_BOUNDS = { west: -123, south: 36, east: -121, north: 38 };

describe("computeVisibleDistanceRange", () => {
  it("returns the min/max distance of points inside the bounds", () => {
    const points = [
      { lat: 37.0, lng: -122.0, distanceMeters: 0 },
      { lat: 37.1, lng: -122.1, distanceMeters: 500 },
      { lat: 37.2, lng: -122.2, distanceMeters: 1000 },
    ];
    assert.deepEqual(computeVisibleDistanceRange(points, FULL_BOUNDS), {
      minDistanceMeters: 0,
      maxDistanceMeters: 1000,
    });
  });

  it("excludes points outside the bounds", () => {
    const points = [
      { lat: 37.0, lng: -122.0, distanceMeters: 0 },
      { lat: 37.1, lng: -122.1, distanceMeters: 500 },
      { lat: 37.2, lng: -122.2, distanceMeters: 1000 },
    ];
    // Only the first two points fall inside this tighter box.
    const tightBounds = { west: -122.15, south: 36.9, east: -121.9, north: 37.15 };
    assert.deepEqual(computeVisibleDistanceRange(points, tightBounds), {
      minDistanceMeters: 0,
      maxDistanceMeters: 500,
    });
  });

  it("returns undefined when no point falls inside the bounds", () => {
    const points = [{ lat: 37.0, lng: -122.0, distanceMeters: 0 }];
    const elsewhere = { west: 10, south: 10, east: 11, north: 11 };
    assert.equal(computeVisibleDistanceRange(points, elsewhere), undefined);
  });

  it("returns undefined for an empty points list", () => {
    assert.equal(computeVisibleDistanceRange([], FULL_BOUNDS), undefined);
  });

  it("treats the bounds as inclusive at the exact edges", () => {
    const points = [{ lat: 37.0, lng: -122.0, distanceMeters: 42 }];
    const exactBounds = { west: -122.0, south: 37.0, east: -122.0, north: 37.0 };
    assert.deepEqual(computeVisibleDistanceRange(points, exactBounds), {
      minDistanceMeters: 42,
      maxDistanceMeters: 42,
    });
  });
});
