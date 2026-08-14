import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";

const CORE_TABLES = [
  "imported_files",
  "rides",
  "ride_points",
  "segments",
  "segment_reference_points",
  "segment_attempts",
  "match_diagnostics",
];

describe("SQLite migrations", () => {
  it("creates all seven core tables with expected columns on a fresh database", () => {
    using database = migratedDatabase();
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row.name));

    for (const table of CORE_TABLES) assert.ok(tables.includes(table), `missing ${table}`);
    assert.equal(Number(database.prepare("PRAGMA user_version").get()?.user_version), 1);

    assertColumns(database, "rides", [
      "id",
      "imported_file_id",
      "parser_version",
      "start_timestamp_ms",
      "end_timestamp_ms",
      "created_at_ms",
      "updated_at_ms",
    ]);
    assertColumns(database, "ride_points", [
      "ride_id",
      "point_index",
      "timestamp_ms",
      "latitude",
      "longitude",
      "distance_meters",
      "elevation_meters",
      "power_watts",
      "heart_rate_bpm",
      "cadence_rpm",
      "speed_meters_per_second",
      "temperature_celsius",
    ]);
    assertColumns(database, "segment_attempts", [
      "id",
      "segment_id",
      "ride_id",
      "start_point_index",
      "end_point_index",
      "start_timestamp_ms",
      "end_timestamp_ms",
      "matcher_version",
      "confidence_score",
      "decision",
      "manually_approved",
      "created_at_ms",
    ]);
  });

  it("inserts a complete FK-respecting ride, segment, attempt, and diagnostic graph", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-a", "file-a");
    insertSegment(database, "segment-a", "ride-a");
    insertAttempt(database, "attempt-a", "segment-a", "ride-a");

    assert.equal(count(database, "rides"), 1);
    assert.equal(count(database, "ride_points"), 3);
    assert.equal(count(database, "segments"), 1);
    assert.equal(count(database, "segment_reference_points"), 2);
    assert.equal(count(database, "segment_attempts"), 1);
    assert.equal(count(database, "match_diagnostics"), 1);
  });

  it("cascades ride deletion to owned points, attempts, and diagnostics only", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-delete", "file-delete");
    insertSegment(database, "segment-delete-ride", "ride-delete");
    insertAttempt(database, "attempt-delete-ride", "segment-delete-ride", "ride-delete");

    insertRide(database, "ride-control", "file-control");
    insertSegment(database, "segment-control", "ride-control");
    insertAttempt(database, "attempt-control", "segment-control", "ride-control");

    database.prepare("DELETE FROM rides WHERE id = ?").run("ride-delete");

    assert.equal(rowExists(database, "rides", "ride-delete"), false);
    assert.equal(pointsForRide(database, "ride-delete"), 0);
    assert.equal(rowExists(database, "segment_attempts", "attempt-delete-ride"), false);
    assert.equal(diagnosticExists(database, "attempt-delete-ride"), false);
    assert.equal(rowExists(database, "segments", "segment-delete-ride"), true);

    assert.equal(rowExists(database, "rides", "ride-control"), true);
    assert.equal(pointsForRide(database, "ride-control"), 3);
    assert.equal(rowExists(database, "segments", "segment-control"), true);
    assert.equal(rowExists(database, "segment_attempts", "attempt-control"), true);
    assert.equal(diagnosticExists(database, "attempt-control"), true);
  });

  it("cascades segment deletion narrowly while preserving its source ride and points", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-shared", "file-shared");
    insertSegment(database, "segment-delete", "ride-shared");
    insertAttempt(database, "attempt-delete", "segment-delete", "ride-shared");
    insertSegment(database, "segment-keep", "ride-shared");
    insertAttempt(database, "attempt-keep", "segment-keep", "ride-shared");

    database.prepare("DELETE FROM segments WHERE id = ?").run("segment-delete");

    assert.equal(rowExists(database, "segments", "segment-delete"), false);
    assert.equal(rowExists(database, "segment_attempts", "attempt-delete"), false);
    assert.equal(diagnosticExists(database, "attempt-delete"), false);
    assert.equal(rowExists(database, "rides", "ride-shared"), true);
    assert.equal(pointsForRide(database, "ride-shared"), 3);
    assert.equal(rowExists(database, "segments", "segment-keep"), true);
    assert.equal(rowExists(database, "segment_attempts", "attempt-keep"), true);
    assert.equal(diagnosticExists(database, "attempt-keep"), true);
  });

  it("enables foreign keys and rejects an attempt for a nonexistent ride", () => {
    using database = migratedDatabase();
    assert.equal(Number(database.prepare("PRAGMA foreign_keys").get()?.foreign_keys), 1);
    insertRide(database, "ride-source", "file-source");
    insertSegment(database, "segment-source", "ride-source");

    assert.throws(
      () =>
        database
          .prepare(
            `INSERT INTO segment_attempts (
              id, segment_id, ride_id, start_point_index, end_point_index,
              start_timestamp_ms, end_timestamp_ms, matcher_version,
              confidence_score, decision, manually_approved, created_at_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            "bad-attempt",
            "segment-source",
            "missing-ride",
            0,
            2,
            1_000,
            3_000,
            1,
            0.9,
            "accept",
            0,
            4_000,
          ),
      /FOREIGN KEY constraint failed/,
    );
  });
});

function migratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  return database;
}

function insertRide(database: DatabaseSync, rideId: string, fileId: string): void {
  database
    .prepare(
      `INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
       VALUES (?, ?, ?, ?)`,
    )
    .run(fileId, hashFor(fileId), `${fileId}.fit`, 1_000);
  database
    .prepare(
      `INSERT INTO rides (
        id, imported_file_id, parser_version, start_timestamp_ms, end_timestamp_ms,
        created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(rideId, fileId, 1, 1_000, 3_000, 4_000, 4_000);

  const insertPoint = database.prepare(
    `INSERT INTO ride_points (
      ride_id, point_index, timestamp_ms, latitude, longitude, distance_meters,
      elevation_meters, power_watts, heart_rate_bpm
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertPoint.run(rideId, 0, 1_000, 37.1, -122.1, 0, 100, 200, 120);
  insertPoint.run(rideId, 1, 2_000, 37.2, -122.2, 10, 101, null, 121);
  insertPoint.run(rideId, 2, 3_000, 37.3, -122.3, 20, 102, 0, 122);
}

function insertSegment(database: DatabaseSync, segmentId: string, sourceRideId: string): void {
  database
    .prepare(
      `INSERT INTO segments (
        id, name, corridor_meters, required_coverage, schema_version, fingerprint,
        source_ride_id, source_start_point_index, source_end_point_index, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      segmentId,
      segmentId,
      30,
      0.9,
      1,
      `fingerprint-${segmentId}`,
      sourceRideId,
      0,
      2,
      4_000,
    );
  const insertReference = database.prepare(
    `INSERT INTO segment_reference_points (
      segment_id, point_index, latitude, longitude, distance_meters, elevation_meters
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  insertReference.run(segmentId, 0, 37.1, -122.1, 0, 100);
  insertReference.run(segmentId, 1, 37.3, -122.3, 20, 102);
}

function insertAttempt(
  database: DatabaseSync,
  attemptId: string,
  segmentId: string,
  rideId: string,
): void {
  database
    .prepare(
      `INSERT INTO segment_attempts (
        id, segment_id, ride_id, start_point_index, end_point_index,
        start_timestamp_ms, end_timestamp_ms, matcher_version, confidence_score,
        decision, manually_approved, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(attemptId, segmentId, rideId, 0, 2, 1_000, 3_000, 1, 0.98, "accept", 0, 4_000);
  database
    .prepare(
      `INSERT INTO match_diagnostics (
        attempt_id, coverage_pct, max_deviation_meters, median_deviation_meters,
        max_backward_meters, max_gap_ms, gps_gap_count, confidence_score,
        reasons_json, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(attemptId, 1, 2.4, 0.8, 0, 1_000, 0, 0.98, "[]", 4_000);
}

function assertColumns(database: DatabaseSync, table: string, expected: string[]): void {
  const actual = database
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => String(row.name));
  assert.deepEqual(actual, expected);
}

function count(database: DatabaseSync, table: string): number {
  return Number(database.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.count);
}

function rowExists(database: DatabaseSync, table: string, id: string): boolean {
  return Number(database.prepare(`SELECT count(*) AS count FROM ${table} WHERE id = ?`).get(id)?.count) === 1;
}

function diagnosticExists(database: DatabaseSync, attemptId: string): boolean {
  return Number(
    database
      .prepare("SELECT count(*) AS count FROM match_diagnostics WHERE attempt_id = ?")
      .get(attemptId)?.count,
  ) === 1;
}

function pointsForRide(database: DatabaseSync, rideId: string): number {
  return Number(
    database
      .prepare("SELECT count(*) AS count FROM ride_points WHERE ride_id = ?")
      .get(rideId)?.count,
  );
}

function hashFor(seed: string): string {
  return seed.padEnd(64, "0").slice(0, 64);
}
