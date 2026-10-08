import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { listSegments } from "./listSegments.ts";

describe("listSegments", () => {
  it("returns an empty list when no segments exist", () => {
    using database = migratedDatabase();
    assert.deepEqual(listSegments(database), []);
  });

  it("lists segments newest-first", () => {
    using database = migratedDatabase();
    insertSegment(database, "segment-old", "Old", 1_000);
    insertSegment(database, "segment-new", "New", 5_000);

    const segments = listSegments(database);
    assert.deepEqual(
      segments.map((s) => s.segmentId),
      ["segment-new", "segment-old"],
    );
    assert.equal(segments[0]?.name, "New");
    assert.equal(segments[0]?.corridorMeters, 30);
  });

  it("reports each segment's length and how many efforts count, without crossing segments", () => {
    using database = migratedDatabase();
    insertSegment(database, "segment-a", "A", 1_000);
    insertSegment(database, "segment-b", "B", 2_000);
    insertSegment(database, "segment-empty", "No points", 3_000);
    for (const [segmentId, distance] of [["segment-a", 0], ["segment-a", 800], ["segment-b", 0], ["segment-b", 300]] as const) {
      database
        .prepare("INSERT INTO segment_reference_points (segment_id, point_index, latitude, longitude, distance_meters) VALUES (?, ?, 0, 0, ?)")
        .run(segmentId, distance === 0 ? 0 : 1, distance);
    }
    database.prepare("INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms) VALUES ('f', ?, 'a.fit', 1)").run("a".repeat(64));
    database.prepare("INSERT INTO rides (id, imported_file_id, parser_version, created_at_ms, updated_at_ms) VALUES ('r', 'f', 1, 1, 1)").run();
    for (const point of [0, 1, 2, 3]) {
      database.prepare("INSERT INTO ride_points (ride_id, point_index, timestamp_ms) VALUES ('r', ?, ?)").run(point, 1_000 + point);
    }
    const attempt = database.prepare(
      `INSERT INTO segment_attempts (id, segment_id, ride_id, start_point_index, end_point_index, start_timestamp_ms, end_timestamp_ms, matcher_version, confidence_score, decision, manually_approved, created_at_ms)
       VALUES (?, 'segment-a', 'r', 0, 1, 1000, 1001, 1, 0.9, ?, ?, 1)`,
    );
    attempt.run("acc", "accept", 0);
    attempt.run("approved", "borderline", 1);
    attempt.run("pending", "borderline", 0); // not counted until the rider approves it

    const byId = Object.fromEntries(listSegments(database).map((s) => [s.segmentId, s]));
    assert.equal(byId["segment-a"]!.distanceMeters, 800);
    assert.equal(byId["segment-a"]!.effortCount, 2);
    assert.equal(byId["segment-b"]!.distanceMeters, 300);
    assert.equal(byId["segment-b"]!.effortCount, 0);
    assert.equal("distanceMeters" in byId["segment-empty"]!, false);
  });
});

function migratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  return database;
}

function insertSegment(database: DatabaseSync, id: string, name: string, createdAtMs: number): void {
  database
    .prepare(
      `INSERT INTO segments (
        id, name, corridor_meters, required_coverage, schema_version, fingerprint, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, name, 30, 0.9, 1, `fp-${id}`, createdAtMs);
}
