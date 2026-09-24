import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nearestTrackPointByLatLng } from "./nearestTrackPoint.ts";

describe("nearestTrackPointByLatLng", () => {
  it("finds the geographically closest point", () => {
    const points = [
      { lat: 0, lng: 0, distanceMeters: 0 },
      { lat: 1, lng: 1, distanceMeters: 100 },
      { lat: 2, lng: 2, distanceMeters: 200 },
    ];
    assert.equal(nearestTrackPointByLatLng(points, { lat: 1.1, lng: 1.1 })?.distanceMeters, 100);
  });

  it("returns undefined for an empty track", () => {
    assert.equal(nearestTrackPointByLatLng([], { lat: 0, lng: 0 }), undefined);
  });

  it("breaks exact ties by keeping the first point seen", () => {
    const points = [
      { lat: 0, lng: 0, distanceMeters: 0 },
      { lat: 0, lng: 0, distanceMeters: 10 },
    ];
    assert.equal(nearestTrackPointByLatLng(points, { lat: 0, lng: 0 })?.distanceMeters, 0);
  });
});
