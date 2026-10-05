import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chooseZoneLengthMeters,
  computeAdaptiveZoneGrades,
  computeZoneGrades,
  QUARTER_MILE_METERS,
} from "./computeZoneGrades.ts";
import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";

function point(distanceMeters: number, elevationMeters?: number): SegmentReferencePoint {
  return {
    lat: 0,
    lng: 0,
    distanceMeters,
    ...(elevationMeters === undefined ? {} : { elevationMeters }),
  };
}

describe("computeZoneGrades", () => {
  it("returns [] for an empty polyline", () => {
    assert.deepEqual(computeZoneGrades([]), []);
  });

  it("produces 3 zero-grade zones for a flat polyline exactly 3 quarter-miles long", () => {
    const total = QUARTER_MILE_METERS * 3;
    const points: SegmentReferencePoint[] = [];
    for (let d = 0; d <= total; d += 10) points.push(point(Math.min(d, total), 100));
    if (points[points.length - 1]!.distanceMeters !== total) points.push(point(total, 100));

    const zones = computeZoneGrades(points);
    assert.equal(zones.length, 3);
    for (const zone of zones) assert.equal(zone.gradePct, 0);
    assert.equal(zones[0]!.startDistanceMeters, 0);
    assert.equal(zones[2]!.endDistanceMeters, total);
  });

  it("ends the final zone at the exact total distance when it isn't a multiple of the zone length", () => {
    const total = 900; // between 2 and 3 quarter-miles; final remainder is 94.25m (>= 10m, not merged)
    const points = [point(0, 100), point(total, 100)];
    const zones = computeZoneGrades(points);
    assert.equal(zones.length, 3);
    assert.equal(zones[2]!.startDistanceMeters, QUARTER_MILE_METERS * 2);
    assert.equal(zones[2]!.endDistanceMeters, total);
  });

  it("merges a trailing remainder shorter than the resample interval into the previous zone", () => {
    const total = QUARTER_MILE_METERS * 2 + 5; // 5m remainder, under the 10m threshold
    const points = [point(0, 100), point(total, 100)];
    const zones = computeZoneGrades(points);
    assert.equal(zones.length, 2);
    assert.equal(zones[1]!.startDistanceMeters, QUARTER_MILE_METERS);
    assert.equal(zones[1]!.endDistanceMeters, total);
  });

  it("dilutes grade toward 0 in proportion to missing elevation coverage", () => {
    const fullCoverage = computeZoneGrades(
      [point(0, 0), point(50, 5), point(100, 10)],
      100,
    );
    const halfCoverage = computeZoneGrades(
      [point(0, 0), point(50, 5), point(100)], // last point's elevation is missing
      100,
    );
    assert.equal(fullCoverage.length, 1);
    assert.equal(halfCoverage.length, 1);
    assert.equal(fullCoverage[0]!.gradePct, 10); // 10m rise over 100m
    assert.equal(halfCoverage[0]!.gradePct, 5); // only the first (fully-covered) half counted
  });

  it("returns exactly 0 grade for a zone with no elevation data at all", () => {
    const zones = computeZoneGrades([point(0), point(50), point(100)], 100);
    assert.equal(zones.length, 1);
    assert.equal(zones[0]!.gradePct, 0);
  });

  it("splits a leg's rise proportionally when it straddles a zone boundary, without double-counting", () => {
    // One leg from 0 to 100 (rise 20, i.e. 20% grade), chunked into 2 zones of 50m each --
    // each zone should get exactly half the rise (10), not the leg's full rise twice.
    const zones = computeZoneGrades([point(0, 0), point(100, 20)], 50);
    assert.equal(zones.length, 2);
    assert.equal(zones[0]!.gradePct, 20);
    assert.equal(zones[1]!.gradePct, 20);
    const totalRise =
      (zones[0]!.gradePct / 100) * (zones[0]!.endDistanceMeters - zones[0]!.startDistanceMeters) +
      (zones[1]!.gradePct / 100) * (zones[1]!.endDistanceMeters - zones[1]!.startDistanceMeters);
    assert.ok(Math.abs(totalRise - 20) < 1e-9);
  });
});

describe("chooseZoneLengthMeters", () => {
  it("uses 100m zones for short segments", () => {
    assert.equal(chooseZoneLengthMeters(400), 100);
    assert.equal(chooseZoneLengthMeters(805), 100); // half a mile -> ~8 zones
  });

  it("scales up through 200m, quarter mile, and half mile as the segment grows", () => {
    assert.equal(chooseZoneLengthMeters(3_219), 200); // 2 miles
    assert.equal(chooseZoneLengthMeters(10_427), 402.336); // Diablo-length climb
    assert.equal(chooseZoneLengthMeters(40_000), 804.672); // very long -> capped at half mile
  });

  it("falls back to the smallest length for a degenerate distance", () => {
    assert.equal(chooseZoneLengthMeters(0), 100);
    assert.equal(chooseZoneLengthMeters(Number.NaN), 100);
  });
});

describe("computeAdaptiveZoneGrades", () => {
  it("chunks a half-mile segment into 100m zones", () => {
    const zones = computeAdaptiveZoneGrades([point(0, 100), point(805, 140)]);
    assert.equal(zones.length, 8); // 100m zones; the 5m remainder merges into the last one
    assert.equal(zones[0]!.endDistanceMeters, 100);
    assert.equal(zones.at(-1)!.endDistanceMeters, 805);
  });

  it("merges a sliver remainder into the previous zone for longer zones too", () => {
    // 402.336m zones: a 30m remainder is under 10% of the zone length, so it merges.
    const zones = computeZoneGrades([point(0, 0), point(402.336 * 3 + 30, 0)], 402.336);
    assert.equal(zones.length, 3);
    assert.equal(zones[2]!.endDistanceMeters, 402.336 * 3 + 30);
  });
});
