import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { setActiveGoal } from "./setActiveGoal.ts";
import type { SyncDatabase } from "./types.ts";

function toTestSyncDatabase(database: DatabaseSync): SyncDatabase {
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
    runMany: (sql, paramsList) => {
      const statement = database.prepare(sql);
      for (const params of paramsList) statement.run(...(params as never[]));
    },
  };
}

function migratedDatabase(): { raw: DatabaseSync; database: SyncDatabase } {
  const raw = new DatabaseSync(":memory:");
  const database = toTestSyncDatabase(raw);
  applyMigrations(database);
  return { raw, database };
}

function insertSegment(raw: DatabaseSync, segmentId = "segment-1"): void {
  raw
    .prepare(
      `INSERT INTO segments (id, name, corridor_meters, required_coverage, schema_version, fingerprint, created_at_ms)
       VALUES (?, 'Test segment', 30, 0.9, 1, ?, 1000)`,
    )
    .run(segmentId, `fingerprint-${segmentId}`);
}

describe("setActiveGoal", () => {
  it("rejects a non-positive target duration", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw);
    assert.throws(() =>
      setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: 0, nowMs: 1_000 }),
    );
    assert.throws(() =>
      setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: -5, nowMs: 1_000 }),
    );
  });

  it("rejects a non-finite target duration", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw);
    assert.throws(() =>
      setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: Number.NaN, nowMs: 1_000 }),
    );
  });
});
