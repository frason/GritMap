import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MATCHER_VERSION, type RidePoint, type SegmentDefinition } from "./matchSegment.ts";
import {
  InMemoryMatchDiagnosticStore,
  InMemorySegmentAttemptStore,
  runMatcherAndPersist,
} from "./persistMatches.ts";

const METERS_PER_DEGREE = 111_195;

describe("persistMatches", () => {
  it("persists an accepted traversal as a segment_attempts row with confidence and version", () => {
    const stores = newStores();
    const summary = runMatcherAndPersist(lineRide(0, 100, 10), "ride-1", segment(), stores);

    assert.equal(summary.attemptsCreated, 1);
    const attempts = stores.attempts.all();
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].decision, "accept");
    assert.equal(attempts[0].matcherVersion, MATCHER_VERSION);
    assert.ok(attempts[0].confidence > 0.9);
    assert.equal(attempts[0].rideId, "ride-1");
    assert.equal(attempts[0].segmentId, "segment-1");
    // References the ride by index/timestamp, not by copying GPS points.
    assert.equal(typeof attempts[0].startPointIndex, "number");
    assert.equal(typeof attempts[0].startTimestampMs, "number");

    const diagnostics = stores.diagnostics.all();
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].attemptId, attempts[0].id);
    assert.equal(diagnostics[0].matcherVersion, MATCHER_VERSION);
  });

  it("persists a borderline traversal as an attempt with diagnostics", () => {
    const stores = newStores();
    const ride = [ridePoint(0, 0, 0), ridePoint(50, 0, 10_000), ridePoint(100, 0, 20_000)];
    const summary = runMatcherAndPersist(ride, "ride-1", segment(8), stores);

    assert.equal(summary.attemptsCreated, 1);
    assert.equal(stores.attempts.all()[0].decision, "borderline");
  });

  it("does not create a segment_attempts row for a rejected candidate, but does write diagnostics", () => {
    const stores = newStores();
    const summary = runMatcherAndPersist(lineRide(100, 0, -10), "ride-1", segment(), stores);

    assert.equal(summary.attemptsCreated, 0);
    assert.equal(stores.attempts.all().length, 0);
    assert.equal(stores.diagnostics.all().length, 1);
    assert.equal(stores.diagnostics.all()[0].decision, "reject");
    assert.equal(stores.diagnostics.all()[0].attemptId, null);
    assert.equal(stores.diagnostics.all()[0].directionOrderOk, false);
  });

  it("does not duplicate rows when the matcher runs twice on the same ride/segment", () => {
    const stores = newStores();
    const ride = lineRide(0, 100, 10);

    const first = runMatcherAndPersist(ride, "ride-1", segment(), stores);
    const second = runMatcherAndPersist(ride, "ride-1", segment(), stores);

    assert.equal(first.attemptsCreated, 1);
    assert.equal(second.attemptsCreated, 0);
    assert.equal(second.attemptsUpdated, 1);
    assert.equal(stores.attempts.all().length, 1);
    assert.equal(stores.diagnostics.all().length, 1);
  });

  it("keeps distinct traversals within the same ride as separate attempts", () => {
    const stores = newStores();
    const first = lineRide(0, 100, 10);
    const connector = [ridePoint(150, 50, 12_000), ridePoint(-50, 50, 13_000)];
    const second = lineRide(0, 100, 10, 14_000);
    runMatcherAndPersist([...first, ...connector, ...second], "ride-1", segment(), stores);

    assert.equal(stores.attempts.all().length, 2);
  });
});

function newStores() {
  return { attempts: new InMemorySegmentAttemptStore(), diagnostics: new InMemoryMatchDiagnosticStore() };
}

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
