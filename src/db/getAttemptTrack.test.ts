import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { getAttemptTrack } from "./getAttemptTrack.ts";

const NOW = 1_700_000_000_000;

describe("getAttemptTrack", () => {
  it("re-bases distance to zero at the attempt's own start point", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedRide(database, [
      { distanceMeters: 100, power: 200 },
      { distanceMeters: 110, power: 210 },
      { distanceMeters: 120, power: 220 },
      { distanceMeters: 130, power: 230 },
    ]);

    const track = getAttemptTrack(database, "ride-1", 1, 3);

    assert.deepEqual(
      track.map((p) => p.distanceMeters),
      [0, 10, 20],
    );
    assert.deepEqual(
      track.map((p) => p.power),
      [210, 220, 230],
    );
  });

  it("excludes rows with no distance sample and omits absent optional channels", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedRide(database, [
      { distanceMeters: 0, power: 200 },
      { distanceMeters: null, power: 205 }, // dropped distance sample mid-ride
      { distanceMeters: 20, heartRate: 140 }, // no power at this point
    ]);

    const track = getAttemptTrack(database, "ride-1", 0, 2);

    assert.equal(track.length, 2);
    assert.deepEqual(track[0], { distanceMeters: 0, timestampMs: NOW, power: 200 });
    assert.deepEqual(track[1], {
      distanceMeters: 20,
      timestampMs: NOW + 2_000,
      heartRate: 140,
    });
  });

  it("returns an empty array when no point in range has a distance sample", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedRide(database, [{ distanceMeters: null }]);

    assert.deepEqual(getAttemptTrack(database, "ride-1", 0, 0), []);
  });
});

interface FixturePoint {
  distanceMeters: number | null;
  power?: number;
  heartRate?: number;
  elevationMeters?: number;
}

function seedRide(database: DatabaseSync, points: FixturePoint[]): void {
  database.exec(`
    INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
    VALUES ('file-1', '${"a".repeat(64)}', 'ride.fit', ${NOW});
    INSERT INTO rides (
      id, imported_file_id, parser_version, start_timestamp_ms, end_timestamp_ms,
      created_at_ms, updated_at_ms
    ) VALUES ('ride-1', 'file-1', 1, ${NOW}, ${NOW + points.length * 1_000}, ${NOW}, ${NOW});
  `);
  const insertPoint = database.prepare(`
    INSERT INTO ride_points (
      ride_id, point_index, timestamp_ms, latitude, longitude, distance_meters,
      power_watts, heart_rate_bpm, elevation_meters
    ) VALUES ('ride-1', ?, ?, 0, 0, ?, ?, ?, ?)
  `);
  points.forEach((point, index) => {
    insertPoint.run(
      index,
      NOW + index * 1_000,
      point.distanceMeters,
      point.power ?? null,
      point.heartRate ?? null,
      point.elevationMeters ?? null,
    );
  });
}
