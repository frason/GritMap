import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations, migrations } from "./migrations.ts";
import { getRideIdentity } from "./getRideIdentity.ts";

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
    assert.equal(Number(database.prepare("PRAGMA user_version").get()?.user_version), 4);

    assertColumns(database, "imported_files", [
      "id",
      "sha256",
      "original_filename",
      "imported_at_ms",
      "retained_file_uri",
      "file_size_bytes",
    ]);

    assertColumns(database, "rides", [
      "id",
      "imported_file_id",
      "parser_version",
      "start_timestamp_ms",
      "end_timestamp_ms",
      "created_at_ms",
      "updated_at_ms",
      "activity_id",
      "device_id",
      "duration_ms",
      "original_timezone_offset_minutes",
      "fit_metadata_json",
      "total_distance_meters",
      "total_ascent_meters",
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
    assert.deepEqual(
      columnDefinitions(database, "imported_files", ["retained_file_uri", "file_size_bytes"]),
      [
        { name: "retained_file_uri", type: "TEXT", notnull: 0 },
        { name: "file_size_bytes", type: "INTEGER", notnull: 0 },
      ],
    );
    assert.deepEqual(
      columnDefinitions(database, "rides", [
        "activity_id",
        "device_id",
        "duration_ms",
        "original_timezone_offset_minutes",
        "fit_metadata_json",
      ]),
      [
        { name: "activity_id", type: "TEXT", notnull: 0 },
        { name: "device_id", type: "TEXT", notnull: 0 },
        { name: "duration_ms", type: "INTEGER", notnull: 0 },
        { name: "original_timezone_offset_minutes", type: "INTEGER", notnull: 0 },
        { name: "fit_metadata_json", type: "TEXT", notnull: 0 },
      ],
    );
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

  it("upgrades populated version-1 data without loss or fabricated metadata", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database, migrations.slice(0, 1));
    insertRide(database, "legacy-ride", "legacy-file");

    applyMigrations(database);

    assert.equal(Number(database.prepare("PRAGMA user_version").get()?.user_version), 4);
    assert.deepEqual({ ...database.prepare(`
      SELECT rides.id, imported_files.original_filename,
             imported_files.retained_file_uri, imported_files.file_size_bytes,
             rides.activity_id, rides.device_id, rides.duration_ms,
             rides.original_timezone_offset_minutes, rides.fit_metadata_json
      FROM rides
      JOIN imported_files ON imported_files.id = rides.imported_file_id
      WHERE rides.id = 'legacy-ride'
    `).get() }, {
      id: "legacy-ride",
      original_filename: "legacy-file.fit",
      retained_file_uri: null,
      file_size_bytes: null,
      activity_id: null,
      device_id: null,
      duration_ms: null,
      original_timezone_offset_minutes: null,
      fit_metadata_json: null,
    });
    assert.equal(pointsForRide(database, "legacy-ride"), 3);
  });

  it("converts nullable stored identifiers to absent RideIdentity properties", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-null-ids", "file-null-ids");
    database.prepare(`
      UPDATE rides
      SET duration_ms = ?, activity_id = NULL, device_id = NULL
      WHERE id = ?
    `).run(2_000, "ride-null-ids");

    assert.deepEqual(getRideIdentity(database, "ride-null-ids"), {
      rideId: "ride-null-ids",
      contentHash: hashFor("file-null-ids"),
      startTimestampMs: 1_000,
      durationMs: 2_000,
    });
    assert.equal(getRideIdentity(database, "missing-ride"), undefined);
  });

  it("uses the device and timing index for duplicate-candidate lookup", () => {
    using database = migratedDatabase();
    const index = database.prepare(`
      SELECT sql FROM sqlite_master
      WHERE type = 'index' AND name = 'idx_rides_device_timing'
    `).get();
    assert.ok(index);

    const plan = database.prepare(`
      EXPLAIN QUERY PLAN
      SELECT id FROM rides
      WHERE device_id = ?
        AND start_timestamp_ms BETWEEN ? AND ?
        AND duration_ms BETWEEN ? AND ?
    `).all("device-1", 0, 10_000, 0, 10_000);
    assert.ok(
      plan.some((row) => String(row.detail).includes("idx_rides_device_timing")),
      JSON.stringify(plan),
    );
  });

  it("replaces file and ride identity metadata transactionally while preserving ride id", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-replace", "file-replace");

    database.exec("BEGIN IMMEDIATE");
    database.prepare(`
      UPDATE imported_files
      SET sha256 = ?, original_filename = ?, retained_file_uri = ?, file_size_bytes = ?
      WHERE id = ?
    `).run("b".repeat(64), "replacement.fit", "file:///rides/replacement.fit", 12_345, "file-replace");
    database.prepare(`
      UPDATE rides
      SET parser_version = ?, start_timestamp_ms = ?, end_timestamp_ms = ?,
          activity_id = ?, device_id = ?, duration_ms = ?,
          original_timezone_offset_minutes = ?, fit_metadata_json = ?, updated_at_ms = ?
      WHERE id = ?
    `).run(
      2,
      10_000,
      25_000,
      "activity-new",
      "device-new",
      15_000,
      -420,
      JSON.stringify({ devices: [{ serialNumber: "device-new" }] }),
      30_000,
      "ride-replace",
    );
    database.exec("COMMIT");

    assert.deepEqual(getRideIdentity(database, "ride-replace"), {
      rideId: "ride-replace",
      contentHash: "b".repeat(64),
      activityId: "activity-new",
      deviceId: "device-new",
      startTimestampMs: 10_000,
      durationMs: 15_000,
    });
    assert.deepEqual({ ...database.prepare(`
      SELECT rides.id, imported_files.original_filename,
             imported_files.retained_file_uri, imported_files.file_size_bytes,
             rides.original_timezone_offset_minutes, rides.fit_metadata_json
      FROM rides
      JOIN imported_files ON imported_files.id = rides.imported_file_id
      WHERE rides.id = 'ride-replace'
    `).get() }, {
      id: "ride-replace",
      original_filename: "replacement.fit",
      retained_file_uri: "file:///rides/replacement.fit",
      file_size_bytes: 12_345,
      original_timezone_offset_minutes: -420,
      fit_metadata_json: '{"devices":[{"serialNumber":"device-new"}]}',
    });
  });

  it("adds nullable, non-negative ride summary columns defaulting to NULL on upgrade", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database, migrations.slice(0, 2));
    insertRide(database, "ride-pre-v3", "file-pre-v3");

    applyMigrations(database);

    assert.equal(Number(database.prepare("PRAGMA user_version").get()?.user_version), 4);
    assert.deepEqual({ ...database.prepare(`
      SELECT total_distance_meters, total_ascent_meters FROM rides WHERE id = 'ride-pre-v3'
    `).get() }, { total_distance_meters: null, total_ascent_meters: null });

    assert.deepEqual(
      columnDefinitions(database, "rides", ["total_distance_meters", "total_ascent_meters"]),
      [
        { name: "total_distance_meters", type: "REAL", notnull: 0 },
        { name: "total_ascent_meters", type: "REAL", notnull: 0 },
      ],
    );

    database
      .prepare("UPDATE rides SET total_distance_meters = ?, total_ascent_meters = ? WHERE id = ?")
      .run(1_234.5, 88.2, "ride-pre-v3");
    assert.throws(
      () =>
        database
          .prepare("UPDATE rides SET total_distance_meters = ? WHERE id = ?")
          .run(-1, "ride-pre-v3"),
      /CHECK constraint failed/,
    );
  });

  it("allows two segments to share a fingerprint (geometry-only identity, no UNIQUE)", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-fp", "file-fp");
    database
      .prepare(
        `INSERT INTO segments (
          id, name, corridor_meters, required_coverage, schema_version, fingerprint,
          source_ride_id, source_start_point_index, source_end_point_index, created_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("segment-fp-a", "A", 30, 0.9, 1, "same-fingerprint", "ride-fp", 0, 2, 4_000);
    database
      .prepare(
        `INSERT INTO segments (
          id, name, corridor_meters, required_coverage, schema_version, fingerprint,
          source_ride_id, source_start_point_index, source_end_point_index, created_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("segment-fp-b", "B", 30, 0.9, 1, "same-fingerprint", "ride-fp", 0, 2, 4_000);

    assert.equal(count(database, "segments"), 2);
  });

  it("upgrades populated v3 segment/attempt/diagnostic data to v4 without loss, and keeps FKs/cascades working", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database, migrations.slice(0, 3));
    insertRide(database, "ride-pre-v4", "file-pre-v4");
    insertSegment(database, "segment-pre-v4", "ride-pre-v4");
    insertAttempt(database, "attempt-pre-v4", "segment-pre-v4", "ride-pre-v4");

    applyMigrations(database);

    assert.equal(Number(database.prepare("PRAGMA user_version").get()?.user_version), 4);
    assert.equal(count(database, "segments"), 1);
    assert.equal(count(database, "segment_reference_points"), 2);
    assert.equal(count(database, "segment_attempts"), 1);
    assert.equal(count(database, "match_diagnostics"), 1);
    assert.deepEqual({ ...database.prepare("SELECT * FROM segments WHERE id = 'segment-pre-v4'").get() }, {
      id: "segment-pre-v4",
      name: "segment-pre-v4",
      corridor_meters: 30,
      required_coverage: 0.9,
      schema_version: 1,
      fingerprint: "fingerprint-segment-pre-v4",
      source_ride_id: "ride-pre-v4",
      source_start_point_index: 0,
      source_end_point_index: 2,
      created_at_ms: 4_000,
    });
    assert.equal(Number(database.prepare("PRAGMA foreign_keys").get()?.foreign_keys), 1);
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);

    // Cascades must still work post-migration, not just on a freshly created v4 database.
    database.prepare("DELETE FROM segments WHERE id = ?").run("segment-pre-v4");
    assert.equal(count(database, "segment_reference_points"), 0);
    assert.equal(count(database, "segment_attempts"), 0);
    assert.equal(count(database, "match_diagnostics"), 0);
    assert.equal(rowExists(database, "rides", "ride-pre-v4"), true);
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

function columnDefinitions(database: DatabaseSync, table: string, names: string[]) {
  return database
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .filter((row) => names.includes(String(row.name)))
    .map((row) => ({
      name: String(row.name),
      type: String(row.type),
      notnull: Number(row.notnull),
    }));
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
