import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchSegment, type RidePoint, type SegmentDefinition } from "./matchSegment.ts";

const METERS_PER_DEGREE = 111_195;

describe("matchSegment", () => {
  it("accepts a clean forward traversal", () => {
    assert.equal(matchSegment(lineRide(0, 100, 10), segment())[0]?.decision, "accept");
  });

  it("rejects a completed reverse traversal", () => {
    const result = matchSegment(lineRide(100, 0, -10), segment());
    assert.equal(result.length, 1);
    assert.equal(result[0].decision, "reject");
    assert.deepEqual(result[0].reasons, ["reverse-traversal"]);
  });

  it("rejects endpoints connected by a materially different route", () => {
    const ride = [
      ridePoint(0, 0, 0),
      ridePoint(10, 0, 1_000),
      ridePoint(20, 100, 2_000),
      ridePoint(80, 100, 3_000),
      ridePoint(90, 0, 4_000),
      ridePoint(100, 0, 5_000),
    ];
    const result = matchSegment(ride, segment());
    assert.equal(result[0]?.decision, "reject");
    assert.ok(result[0]?.reasons.includes("different-route"));
  });

  it("marks an otherwise clean traversal with a >30 second GPS gap borderline", () => {
    const ride = lineRide(0, 100, 10);
    for (let index = 6; index < ride.length; index += 1) ride[index].timestampMs += 31_000;
    const result = matchSegment(ride, segment());
    assert.equal(result[0]?.decision, "borderline");
    assert.ok(result[0]?.reasons.includes("gps-gap"));
  });

  it("marks a sparse but same-route traversal below 90% coverage borderline", () => {
    const ride = [ridePoint(0, 0, 0), ridePoint(50, 0, 10_000), ridePoint(100, 0, 20_000)];
    const result = matchSegment(ride, segment(8));
    assert.equal(result[0]?.decision, "borderline");
    assert.ok(result[0]?.coveragePct < 0.9);
    assert.ok(result[0]?.reasons.includes("insufficient-coverage"));
  });

  it("keeps two separate forward traversals while deduplicating nearby candidate starts", () => {
    const first = lineRide(0, 100, 10);
    const connector = [ridePoint(150, 50, 12_000), ridePoint(-50, 50, 13_000)];
    const second = lineRide(0, 100, 10, 14_000);
    const result = matchSegment([...first, ...connector, ...second], segment());
    const accepted = result.filter((candidate) => candidate.decision === "accept");
    assert.equal(accepted.length, 2);
    assert.ok(accepted[0].endPointIndex < accepted[1].startPointIndex);
  });
});

function segment(corridorMeters = 30): SegmentDefinition {
  return {
    id: "segment-1",
    corridorMeters,
    requiredCoveragePct: 0.9,
    referencePolyline: Array.from({ length: 11 }, (_, index) => ({
      lat: 0,
      lng: degrees(index * 10),
      distanceMeters: index * 10,
    })),
  };
}

function lineRide(start: number, end: number, step: number, timeOffset = 0): RidePoint[] {
  const points: RidePoint[] = [];
  let index = 0;
  for (let meters = start; step > 0 ? meters <= end : meters >= end; meters += step) {
    points.push(ridePoint(meters, 0, timeOffset + index * 1_000));
    index += 1;
  }
  return points;
}

function ridePoint(xMeters: number, yMeters: number, timestampMs: number): RidePoint {
  return { lat: degrees(yMeters), lng: degrees(xMeters), timestampMs };
}

function degrees(meters: number): number {
  return meters / METERS_PER_DEGREE;
}
