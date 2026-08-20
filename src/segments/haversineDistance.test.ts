import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { haversineDistanceMeters } from "./haversineDistance.ts";

describe("haversineDistanceMeters", () => {
  it("returns 0 for identical points", () => {
    assert.equal(haversineDistanceMeters({ lat: 37.0, lng: -122.0 }, { lat: 37.0, lng: -122.0 }), 0);
  });

  it("matches the one-degree-of-longitude-at-the-equator reference distance (~111.2km)", () => {
    // At the equator, a degree of longitude spans the same ~111.2km as a degree of latitude.
    const distance = haversineDistanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    assert.ok(Math.abs(distance - 111_195) < 200, `expected ~111195m, got ${distance}m`);
  });

  it("is symmetric", () => {
    const a = { lat: 37.0, lng: -122.0 };
    const b = { lat: 37.01, lng: -122.02 };
    assert.equal(haversineDistanceMeters(a, b), haversineDistanceMeters(b, a));
  });

  it("matches the one-degree-of-latitude reference distance (~111.2km) closely", () => {
    const distance = haversineDistanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    assert.ok(Math.abs(distance - 111_195) < 200, `expected ~111195m, got ${distance}m`);
  });
});
