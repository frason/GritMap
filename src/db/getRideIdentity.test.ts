import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { getRideIdentity, listRideIdentities } from "./getRideIdentity.ts";

describe("getRideIdentity / listRideIdentities", () => {
  it("returns undefined for a ride that doesn't exist", () => {
    using database = migratedDatabase();
    assert.equal(getRideIdentity(database, "missing"), undefined);
  });

  it("reads a single ride's identity with activityId/deviceId present", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-a", "file-a", {
      activityId: "activity-a",
      deviceId: "device-a",
      startTimestampMs: 1_000,
      durationMs: 5_000,
    });

    assert.deepEqual(getRideIdentity(database, "ride-a"), {
      rideId: "ride-a",
      contentHash: hashFor("file-a"),
      activityId: "activity-a",
      deviceId: "device-a",
      startTimestampMs: 1_000,
      durationMs: 5_000,
    });
  });

  it("omits activityId/deviceId entirely when NULL, rather than including them as null", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-b", "file-b", { startTimestampMs: 2_000, durationMs: 3_000 });

    const identity = getRideIdentity(database, "ride-b");
    assert.deepEqual(identity, {
      rideId: "ride-b",
      contentHash: hashFor("file-b"),
      startTimestampMs: 2_000,
      durationMs: 3_000,
    });
    assert.ok(identity && !("activityId" in identity));
    assert.ok(identity && !("deviceId" in identity));
  });

  it("throws for a ride missing required duplicate-identity timing", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-untimed", "file-untimed", {});
    assert.throws(() => getRideIdentity(database, "ride-untimed"), /missing required/);
  });

  it("lists every ride's identity, for comparing a candidate against the whole collection", () => {
    using database = migratedDatabase();
    insertRide(database, "ride-1", "file-1", {
      deviceId: "device-x",
      startTimestampMs: 1_000,
      durationMs: 1_000,
    });
    insertRide(database, "ride-2", "file-2", {
      activityId: "activity-y",
      startTimestampMs: 2_000,
      durationMs: 2_000,
    });

    const identities = listRideIdentities(database);
    assert.equal(identities.length, 2);
    assert.deepEqual(
      identities.map((identity) => identity.rideId).sort(),
      ["ride-1", "ride-2"],
    );
  });

  it("returns an empty list for an empty database", () => {
    using database = migratedDatabase();
    assert.deepEqual(listRideIdentities(database), []);
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
  identity: { activityId?: string; deviceId?: string; startTimestampMs?: number; durationMs?: number },
): void {
  database
    .prepare(
      `INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
       VALUES (?, ?, ?, ?)`,
    )
    .run(fileId, hashFor(fileId), `${fileId}.fit`, 1_000);
  database
    .prepare(
      `INSERT INTO rides (
        id, imported_file_id, parser_version, created_at_ms, updated_at_ms,
        activity_id, device_id, start_timestamp_ms, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      rideId,
      fileId,
      1,
      1_000,
      1_000,
      identity.activityId ?? null,
      identity.deviceId ?? null,
      identity.startTimestampMs ?? null,
      identity.durationMs ?? null,
    );
}

function hashFor(seed: string): string {
  return seed.padEnd(64, "0").slice(0, 64);
}
