import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { getRideTrack } from "./getRideTrack.ts";

const NOW = 1_700_000_000_000;

describe("getRideTrack", () => {
  it("returns an empty list for a ride with no points", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-1");
    assert.deepEqual(getRideTrack(database, "ride-1"), []);
  });

  it("returns GPS-present points in point_index order with timestampMs always present", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-1");
    insertPoint(database, "ride-1", 2, { timestampMs: NOW + 2_000, lat: 37.002, lng: -122 });
    insertPoint(database, "ride-1", 0, { timestampMs: NOW, lat: 37.0, lng: -122 });
    insertPoint(database, "ride-1", 1, { timestampMs: NOW + 1_000, lat: 37.001, lng: -122 });

    const track = getRideTrack(database, "ride-1");
    assert.deepEqual(
      track.map((p) => p.pointIndex),
      [0, 1, 2],
    );
    assert.equal(track[0]?.timestampMs, NOW);
    assert.equal(track[0]?.lat, 37.0);
    assert.equal(track[0]?.lng, -122);
  });

  it("excludes points with no GPS fix", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-1");
    insertPoint(database, "ride-1", 0, { timestampMs: NOW, lat: 37.0, lng: -122 });
    insertPoint(database, "ride-1", 1, { timestampMs: NOW + 1_000, lat: null, lng: null });
    insertPoint(database, "ride-1", 2, { timestampMs: NOW + 2_000, lat: 37.002, lng: -122 });

    const track = getRideTrack(database, "ride-1");
    assert.deepEqual(
      track.map((p) => p.pointIndex),
      [0, 2],
    );
  });

  it("omits distanceMeters/elevationMeters entirely (not as null) when absent", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-1");
    insertPoint(database, "ride-1", 0, { timestampMs: NOW, lat: 37.0, lng: -122 });

    const [point] = getRideTrack(database, "ride-1");
    assert.ok(point && !("distanceMeters" in point) && !("elevationMeters" in point));
  });

  it("includes distanceMeters/elevationMeters when present", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-1");
    insertPoint(database, "ride-1", 0, {
      timestampMs: NOW,
      lat: 37.0,
      lng: -122,
      distanceMeters: 12.5,
      elevationMeters: 305,
    });

    const [point] = getRideTrack(database, "ride-1");
    assert.equal(point?.distanceMeters, 12.5);
    assert.equal(point?.elevationMeters, 305);
  });

  it("only returns points for the requested ride", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-1");
    insertRide(database, "ride-2", "file-2");
    insertPoint(database, "ride-1", 0, { timestampMs: NOW, lat: 37.0, lng: -122 });
    insertPoint(database, "ride-2", 0, { timestampMs: NOW, lat: 40.0, lng: -73 });

    assert.equal(getRideTrack(database, "ride-1").length, 1);
    assert.equal(getRideTrack(database, "ride-1")[0]?.lat, 37.0);
  });
});

function migratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  return database;
}

function insertRide(database: DatabaseSync, rideId: string, fileId = "file-1"): void {
  database
    .prepare(
      `INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
       VALUES (?, ?, ?, ?)`,
    )
    .run(fileId, fileId.padEnd(64, "0").slice(0, 64), `${fileId}.fit`, NOW);
  database
    .prepare(
      `INSERT INTO rides (id, imported_file_id, parser_version, created_at_ms, updated_at_ms)
       VALUES (?, ?, 1, ?, ?)`,
    )
    .run(rideId, fileId, NOW, NOW);
}

function insertPoint(
  database: DatabaseSync,
  rideId: string,
  pointIndex: number,
  fields: {
    timestampMs: number;
    lat: number | null;
    lng: number | null;
    distanceMeters?: number;
    elevationMeters?: number;
  },
): void {
  database
    .prepare(
      `INSERT INTO ride_points (
        ride_id, point_index, timestamp_ms, latitude, longitude, distance_meters,
        elevation_meters
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      rideId,
      pointIndex,
      fields.timestampMs,
      fields.lat,
      fields.lng,
      fields.distanceMeters ?? null,
      fields.elevationMeters ?? null,
    );
}
