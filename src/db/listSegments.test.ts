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
