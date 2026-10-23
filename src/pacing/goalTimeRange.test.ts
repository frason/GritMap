import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { goalTimeRange } from "./goalTimeRange.ts";

// A synthetic 3 km climb. No real ride data.
function polyline(withElevation = true) {
  let elevationMeters = 100;
  return Array.from({ length: 301 }, (_, i) => {
    const distanceMeters = i * 10;
    if (i > 0) elevationMeters += 10 * 0.06;
    return { lat: 37 + i * 0.00009, lng: -122, distanceMeters, ...(withElevation ? { elevationMeters } : {}) };
  });
}

describe("goalTimeRange", () => {
  it("gives a typical time at FTP and an easiest time (the flat-plan floor) that is slower", () => {
    const range = goalTimeRange({ referencePolyline: polyline(), ftpWatts: 250, riderWeightKg: 70 })!;
    assert.ok(range.typicalMs > 5 * 60_000 && range.typicalMs < 20 * 60_000, `typical ${range.typicalMs}`);
    assert.ok(range.easiestMs > range.typicalMs * 1.2);
  });

  it("a stronger rider is faster", () => {
    const weak = goalTimeRange({ referencePolyline: polyline(), ftpWatts: 200, riderWeightKg: 70 })!;
    const strong = goalTimeRange({ referencePolyline: polyline(), ftpWatts: 300, riderWeightKg: 70 })!;
    assert.ok(strong.typicalMs < weak.typicalMs);
  });

  it("is undefined without weight, without elevation or with no FTP", () => {
    assert.equal(goalTimeRange({ referencePolyline: polyline(), ftpWatts: 250, riderWeightKg: undefined }), undefined);
    assert.equal(goalTimeRange({ referencePolyline: polyline(false), ftpWatts: 250, riderWeightKg: 70 }), undefined);
    assert.equal(goalTimeRange({ referencePolyline: polyline(), ftpWatts: 0, riderWeightKg: 70 }), undefined);
  });
});
