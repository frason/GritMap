import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeSegmentElevationStats } from "./computeSegmentElevationStats.ts";
import type { SegmentReferencePoint } from "./resamplePolyline.ts";

function point(distanceMeters: number, elevationMeters?: number): SegmentReferencePoint {
  return {
    lat: 0,
    lng: 0,
    distanceMeters,
    ...(elevationMeters === undefined ? {} : { elevationMeters }),
  };
}

describe("computeSegmentElevationStats", () => {
  it("returns undefined for an empty polyline", () => {
    assert.equal(computeSegmentElevationStats([]), undefined);
  });

  it("returns undefined when no point has elevation data", () => {
    assert.equal(computeSegmentElevationStats([point(0), point(500), point(1000)]), undefined);
  });

  it("returns 0 gain and 0 grade for a flat segment", () => {
    assert.deepEqual(computeSegmentElevationStats([point(0, 100), point(1000, 100)]), {
      elevationGainMeters: 0,
      averageGradePercent: 0,
    });
  });

  it("computes gain and grade for a monotonic climb", () => {
    assert.deepEqual(computeSegmentElevationStats([point(0, 100), point(1000, 150)]), {
      elevationGainMeters: 50,
      averageGradePercent: 5,
    });
  });

  it("accumulates only positive deltas -- a descent doesn't subtract from the total", () => {
    const stats = computeSegmentElevationStats([point(0, 100), point(500, 90), point(1000, 150)]);
    // 100->90 is a descent (ignored), 90->150 is a +60 climb -- not the naive net rise of 50.
    assert.equal(stats?.elevationGainMeters, 60);
  });

  it("never fabricates a jump across a gap in elevation data", () => {
    const stats = computeSegmentElevationStats([point(0, 100), point(500), point(1000, 200)]);
    // The gap at 500m resets the delta chain -- 100 -> (missing) -> 200 contributes nothing.
    assert.equal(stats?.elevationGainMeters, 0);
  });

  it("returns 0 grade (not NaN) for a single zero-length point", () => {
    assert.deepEqual(computeSegmentElevationStats([point(0, 100)]), {
      elevationGainMeters: 0,
      averageGradePercent: 0,
    });
  });
});
