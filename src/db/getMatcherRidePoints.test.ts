import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { getMatcherRidePoints } from "./getMatcherRidePoints.ts";

const NOW = 1_700_000_000_000;

describe("getMatcherRidePoints", () => {
  it("returns every point in point_index order, including a non-GPS gap", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    database.exec(`
      INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
      VALUES ('file-1', '${"a".repeat(64)}', 'ride.fit', ${NOW});
      INSERT INTO rides (
        id, imported_file_id, parser_version, start_timestamp_ms, end_timestamp_ms,
        created_at_ms, updated_at_ms
      ) VALUES ('ride-1', 'file-1', 1, ${NOW}, ${NOW + 3_000}, ${NOW}, ${NOW});
    `);
    const insertPoint = database.prepare(`
      INSERT INTO ride_points (ride_id, point_index, timestamp_ms, latitude, longitude)
      VALUES ('ride-1', ?, ?, ?, ?)
    `);
    insertPoint.run(0, NOW, 37.1, -122.1);
    insertPoint.run(1, NOW + 1_000, null, null); // dropped GPS fix mid-ride
    insertPoint.run(2, NOW + 2_000, 37.2, -122.2);

    const points = getMatcherRidePoints(database, "ride-1");

    assert.deepEqual(points, [
      { timestampMs: NOW, lat: 37.1, lng: -122.1 },
      { timestampMs: NOW + 1_000 },
      { timestampMs: NOW + 2_000, lat: 37.2, lng: -122.2 },
    ]);
  });

  it("returns an empty array for a ride with no points", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    database.exec(`
      INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
      VALUES ('file-1', '${"a".repeat(64)}', 'ride.fit', ${NOW});
      INSERT INTO rides (
        id, imported_file_id, parser_version, start_timestamp_ms, end_timestamp_ms,
        created_at_ms, updated_at_ms
      ) VALUES ('ride-1', 'file-1', 1, ${NOW}, ${NOW}, ${NOW}, ${NOW});
    `);

    assert.deepEqual(getMatcherRidePoints(database, "ride-1"), []);
  });
});
