import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "../db/migrations.ts";
import type { SyncDatabase } from "../db/types.ts";
import { loadRideSegmentLines } from "./loadRideSegmentLines.ts";

function toSync(database: DatabaseSync): SyncDatabase {
  return {
    exec: (sql) => database.exec(sql),
    prepare: (sql) => {
      const statement = database.prepare(sql);
      return {
        get: (...params) => statement.get(...(params as never[])),
        run: (...params) => statement.run(...(params as never[])),
        all: (...params) => statement.all(...(params as never[])),
      };
    },
    runMany: () => {},
  };
}

function seed(database: DatabaseSync): void {
  database.exec(`
    INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms) VALUES ('f', '${"a".repeat(64)}', 'r.fit', 1);
    INSERT INTO rides (id, imported_file_id, parser_version, start_timestamp_ms, end_timestamp_ms, created_at_ms, updated_at_ms)
      VALUES ('r', 'f', 1, 0, 100000, 1, 1);
    INSERT INTO segments (id, name, corridor_meters, required_coverage, schema_version, fingerprint, created_at_ms)
      VALUES ('s', 'Seg', 30, 0.9, 1, 'fp', 1);
  `);
  const point = database.prepare("INSERT INTO ride_points (ride_id, point_index, timestamp_ms, latitude, longitude) VALUES ('r', ?, ?, ?, ?)");
  for (let i = 0; i < 40; i += 1) point.run(i, i * 1000, i === 5 ? null : 10 + i * 0.001, i === 5 ? null : 20);
}

function attempt(database: DatabaseSync, id: string, start: number, end: number, decision: string, approved: number): void {
  database
    .prepare(
      `INSERT INTO segment_attempts (id, segment_id, ride_id, start_point_index, end_point_index, start_timestamp_ms, end_timestamp_ms,
         matcher_version, confidence_score, decision, manually_approved, created_at_ms)
       VALUES (?, 's', 'r', ?, ?, ?, ?, 2, 0.9, ?, ?, 1)`,
    )
    .run(id, start, end, start * 1000, end * 1000, decision, approved);
}

describe("loadRideSegmentLines", () => {
  it("returns the ride's own points for each counted effort, thinned, skipping fixes without GPS", () => {
    using raw = new DatabaseSync(":memory:");
    applyMigrations(raw);
    seed(raw);
    attempt(raw, "a1", 2, 30, "accept", 0);
    attempt(raw, "a2", 32, 38, "borderline", 1);
    attempt(raw, "a3", 0, 1, "borderline", 0);

    const lines = loadRideSegmentLines(toSync(raw), "r");

    assert.equal(lines.length, 2);
    assert.equal(lines[0]!.length, 16);
    assert.equal(lines[0]![0]!.lat, 10 + 2 * 0.001);
    assert.equal(lines[0]![15]!.lat, 10 + 30 * 0.001);
    assert.equal(lines[1]!.length, 7);
  });

  it("returns nothing for a ride without efforts", () => {
    using raw = new DatabaseSync(":memory:");
    applyMigrations(raw);
    seed(raw);
    assert.deepEqual(loadRideSegmentLines(toSync(raw), "r"), []);
  });
});
