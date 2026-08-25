import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "../db/migrations.ts";
import { runMatcherForRide, runMatcherForSegment } from "./runMatcher.ts";

const NOW = 1_700_000_000_000;
const METERS_PER_DEGREE = 111_195;

describe("runMatcherForRide / runMatcherForSegment", () => {
  it("runMatcherForRide finds and persists a match against an existing segment", () => {
    using database = createDatabase();
    insertSegment(database, "segment-1", "Test segment");
    insertRide(database, "ride-1", straightLinePoints());

    const summary = runMatcherForRide(database, sequentialIds("attempt"), "ride-1", NOW + 60_000);

    assert.equal(summary.inserted, 1);
    assert.equal(count(database, "segment_attempts"), 1);
    assert.equal(count(database, "match_diagnostics"), 1);
    const stored = database.prepare(
      "SELECT segment_id, ride_id, decision FROM segment_attempts",
    ).get();
    assert.deepEqual({ ...stored }, {
      segment_id: "segment-1",
      ride_id: "ride-1",
      decision: "accept",
    });
  });

  it("runMatcherForRide scans every segment, not just the first", () => {
    using database = createDatabase();
    insertSegment(database, "segment-1", "First");
    insertSegment(database, "segment-2", "Second");
    insertRide(database, "ride-1", straightLinePoints());

    const summary = runMatcherForRide(database, sequentialIds("attempt"), "ride-1", NOW + 60_000);

    assert.equal(summary.inserted, 2);
    assert.equal(count(database, "segment_attempts"), 2);
  });

  it("runMatcherForRide persists nothing for a ride that never enters the corridor", () => {
    using database = createDatabase();
    insertSegment(database, "segment-1", "Test segment");
    insertRide(database, "ride-1", farAwayPoints());

    const summary = runMatcherForRide(database, sequentialIds("attempt"), "ride-1", NOW + 60_000);

    assert.deepEqual(summary, { inserted: 0, updated: 0, duplicate: 0, removed: 0, rejected: 0 });
    assert.equal(count(database, "segment_attempts"), 0);
  });

  it("runMatcherForRide is idempotent on a second run", () => {
    using database = createDatabase();
    insertSegment(database, "segment-1", "Test segment");
    insertRide(database, "ride-1", straightLinePoints());

    runMatcherForRide(database, sequentialIds("attempt-a"), "ride-1", NOW + 60_000);
    const second = runMatcherForRide(database, sequentialIds("attempt-b"), "ride-1", NOW + 90_000);

    assert.equal(second.duplicate, 1);
    assert.equal(count(database, "segment_attempts"), 1);
  });

  it("runMatcherForSegment finds and persists a match against an existing ride", () => {
    using database = createDatabase();
    insertRide(database, "ride-1", straightLinePoints());
    insertSegment(database, "segment-1", "Test segment");

    const summary = runMatcherForSegment(
      database,
      sequentialIds("attempt"),
      "segment-1",
      NOW + 60_000,
    );

    assert.equal(summary.inserted, 1);
    assert.equal(count(database, "segment_attempts"), 1);
  });

  it("runMatcherForSegment scans every ride, not just the first", () => {
    using database = createDatabase();
    insertRide(database, "ride-1", straightLinePoints());
    insertRide(database, "ride-2", straightLinePoints());
    insertSegment(database, "segment-1", "Test segment");

    const summary = runMatcherForSegment(
      database,
      sequentialIds("attempt"),
      "segment-1",
      NOW + 60_000,
    );

    assert.equal(summary.inserted, 2);
    assert.equal(count(database, "segment_attempts"), 2);
  });

  it("runMatcherForSegment matches the ride the segment was itself defined from", () => {
    // insertSegment.ts's sourceRideId is informational only -- the matcher makes no
    // exception for a segment's own source ride, and neither should this wiring.
    using database = createDatabase();
    insertRide(database, "ride-1", straightLinePoints());
    insertSegment(database, "segment-1", "Test segment", "ride-1");

    const summary = runMatcherForSegment(
      database,
      sequentialIds("attempt"),
      "segment-1",
      NOW + 60_000,
    );

    assert.equal(summary.inserted, 1);
  });

  it("both functions no-op safely for an unknown id", () => {
    using database = createDatabase();

    assert.deepEqual(
      runMatcherForRide(database, sequentialIds("a"), "missing-ride", NOW),
      { inserted: 0, updated: 0, duplicate: 0, removed: 0, rejected: 0 },
    );
    assert.deepEqual(
      runMatcherForSegment(database, sequentialIds("b"), "missing-segment", NOW),
      { inserted: 0, updated: 0, duplicate: 0, removed: 0, rejected: 0 },
    );
  });
});

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  return database;
}

function insertRide(database: DatabaseSync, rideId: string, points: readonly RideFixturePoint[]): void {
  database.prepare(`
    INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
    VALUES (?, ?, ?, ?)
  `).run(`file-${rideId}`, rideId.padEnd(64, "a"), `${rideId}.fit`, NOW);
  database.prepare(`
    INSERT INTO rides (
      id, imported_file_id, parser_version, start_timestamp_ms, end_timestamp_ms,
      created_at_ms, updated_at_ms
    ) VALUES (?, ?, 1, ?, ?, ?, ?)
  `).run(rideId, `file-${rideId}`, NOW, NOW + points.length * 1_000, NOW, NOW);

  const insertPoint = database.prepare(`
    INSERT INTO ride_points (ride_id, point_index, timestamp_ms, latitude, longitude)
    VALUES (?, ?, ?, ?, ?)
  `);
  points.forEach((point, index) => {
    insertPoint.run(rideId, index, NOW + index * 1_000, point.lat, point.lng);
  });
}

function insertSegment(
  database: DatabaseSync,
  segmentId: string,
  name: string,
  sourceRideId: string | null = null,
): void {
  database.prepare(`
    INSERT INTO segments (
      id, name, corridor_meters, required_coverage, schema_version, fingerprint,
      source_ride_id, created_at_ms
    ) VALUES (?, ?, 30, 0.9, 1, ?, ?, ?)
  `).run(segmentId, name, `${segmentId}-fingerprint`, sourceRideId, NOW);

  const insertPoint = database.prepare(`
    INSERT INTO segment_reference_points (segment_id, point_index, latitude, longitude, distance_meters)
    VALUES (?, ?, ?, ?, ?)
  `);
  referenceMeters().forEach((meters, index) => {
    insertPoint.run(segmentId, index, 0, meters / METERS_PER_DEGREE, meters);
  });
}

interface RideFixturePoint {
  lat: number;
  lng: number;
}

function referenceMeters(): number[] {
  return [0, 25, 50, 75, 100];
}

/** Exactly overlays the reference polyline -- guaranteed full coverage, zero deviation. */
function straightLinePoints(): RideFixturePoint[] {
  return referenceMeters().map((meters) => ({ lat: 0, lng: meters / METERS_PER_DEGREE }));
}

/** Never enters any segment's 30m corridor. */
function farAwayPoints(): RideFixturePoint[] {
  return referenceMeters().map((meters) => ({
    lat: 5_000 / METERS_PER_DEGREE,
    lng: meters / METERS_PER_DEGREE,
  }));
}

function sequentialIds(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${(counter += 1)}`;
}

function count(database: DatabaseSync, table: string): number {
  return Number(database.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.count);
}
