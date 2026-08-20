import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { deleteSegment } from "./deleteSegment.ts";

describe("deleteSegment", () => {
  it("removes the segment and cascades to its reference points, leaving the source ride intact", () => {
    using database = migratedDatabase();
    database
      .prepare(
        `INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
         VALUES ('file-1', ?, 'r.fit', 1000)`,
      )
      .run("a".repeat(64));
    database
      .prepare(
        `INSERT INTO rides (id, imported_file_id, parser_version, created_at_ms, updated_at_ms)
         VALUES ('ride-1', 'file-1', 1, 1000, 1000)`,
      )
      .run();
    database
      .prepare(
        `INSERT INTO segments (
          id, name, corridor_meters, required_coverage, schema_version, fingerprint,
          source_ride_id, created_at_ms
        ) VALUES ('segment-1', 'X', 30, 0.9, 1, 'fp', 'ride-1', 1000)`,
      )
      .run();
    database
      .prepare(
        `INSERT INTO segment_reference_points (segment_id, point_index, latitude, longitude, distance_meters)
         VALUES ('segment-1', 0, 0, 0, 0)`,
      )
      .run();

    deleteSegment(database, "segment-1");

    assert.equal(
      (database.prepare("SELECT count(*) AS count FROM segments").get() as { count: number }).count,
      0,
    );
    assert.equal(
      (
        database.prepare("SELECT count(*) AS count FROM segment_reference_points").get() as {
          count: number;
        }
      ).count,
      0,
    );
    assert.equal(
      (database.prepare("SELECT count(*) AS count FROM rides").get() as { count: number }).count,
      1,
    );
  });

  it("is a no-op for a nonexistent segment id", () => {
    using database = migratedDatabase();
    deleteSegment(database, "missing");
  });
});

function migratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  return database;
}
