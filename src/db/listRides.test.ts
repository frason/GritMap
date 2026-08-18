import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { listRides } from "./listRides.ts";

describe("listRides", () => {
  it("returns an empty list for an empty database", () => {
    using database = migratedDatabase();
    assert.deepEqual(listRides(database), []);
  });

  it("lists rides newest-first with the v3 summary columns", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-old", "file-old", {
      startTimestampMs: 1_000,
      durationMs: 500,
      totalDistanceMeters: 100,
    });
    insertRide(database, "ride-new", "file-new", {
      startTimestampMs: 5_000,
      durationMs: 500,
      totalDistanceMeters: 200,
    });

    const rides = listRides(database);
    assert.deepEqual(
      rides.map((r) => r.rideId),
      ["ride-new", "ride-old"],
    );
    assert.equal(rides[0]?.totalDistanceMeters, 200);
    assert.equal(rides[0]?.originalFilename, "file-new.fit");
  });

  it("omits totalDistanceMeters entirely (not as null) when the column is NULL", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-no-distance", "file-x", {
      startTimestampMs: 1_000,
      durationMs: 500,
    });

    const [ride] = listRides(database);
    assert.ok(ride && !("totalDistanceMeters" in ride));
  });
});

function migratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  return database;
}

function insertRide(
  database: DatabaseSync,
  rideId: string,
  fileId: string,
  fields: { startTimestampMs?: number; durationMs?: number; totalDistanceMeters?: number },
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
        start_timestamp_ms, duration_ms, total_distance_meters
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
    );
}
