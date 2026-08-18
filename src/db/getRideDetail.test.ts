import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { getRideDetail } from "./getRideDetail.ts";

describe("getRideDetail", () => {
  it("returns undefined for a ride that doesn't exist", () => {
    using database = migratedDatabase();
    assert.equal(getRideDetail(database, "missing"), undefined);
  });

  it("reads a ride's detail including point count and summary columns", () => {
    using database = migratedDatabase();
    insertRideWithPoints(database, "ride-a", "file-a", 3, {
      startTimestampMs: 1_000,
      durationMs: 2_000,
      totalDistanceMeters: 120,
      totalAscentMeters: 10,
    });

    assert.deepEqual(getRideDetail(database, "ride-a"), {
      rideId: "ride-a",
      originalFilename: "file-a.fit",
      pointCount: 3,
      startTimestampMs: 1_000,
      durationMs: 2_000,
      totalDistanceMeters: 120,
      totalAscentMeters: 10,
    });
  });

  it("omits missing summary fields rather than including them as null", () => {
    using database = migratedDatabase();
    insertRideWithPoints(database, "ride-b", "file-b", 0, {});

    const detail = getRideDetail(database, "ride-b");
    assert.ok(detail);
    assert.equal(detail.pointCount, 0);
    assert.ok(!("startTimestampMs" in detail));
    assert.ok(!("totalAscentMeters" in detail));
  });
});

function migratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  return database;
}

function insertRideWithPoints(
  database: DatabaseSync,
  rideId: string,
  fileId: string,
  pointCount: number,
  fields: {
    startTimestampMs?: number;
    durationMs?: number;
    totalDistanceMeters?: number;
    totalAscentMeters?: number;
  },
): void {
  database
    .prepare(
      `INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
       VALUES (?, ?, ?, ?)`,
    )
    .run(fileId, fileId.padEnd(64, "0").slice(0, 64), `${fileId}.fit`, 1_000);
  database
    .prepare(
      `INSERT INTO rides (
        id, imported_file_id, parser_version, created_at_ms, updated_at_ms,
        start_timestamp_ms, duration_ms, total_distance_meters, total_ascent_meters
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      rideId,
      fileId,
      1,
      1_000,
      1_000,
      fields.startTimestampMs ?? null,
      fields.durationMs ?? null,
      fields.totalDistanceMeters ?? null,
      fields.totalAscentMeters ?? null,
    );

  const insertPoint = database.prepare(
    `INSERT INTO ride_points (ride_id, point_index, timestamp_ms) VALUES (?, ?, ?)`,
  );
  for (let i = 0; i < pointCount; i += 1) {
    insertPoint.run(rideId, i, 1_000 + i);
  }
}
