import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { getActiveGoal } from "./getActiveGoal.ts";
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

describe("staged goal (next goal plus a long-term goal)", () => {
  it("stores a long-term goal beside the next goal and reads both back", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw);
    setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: 2_460_000, longTermDurationMs: 2_340_000, nowMs: 1_000 });
    assert.deepEqual(getActiveGoal(database), { segmentId: "segment-1", targetDurationMs: 2_460_000, longTermDurationMs: 2_340_000 });
  });

  it("a single goal has no long-term goal, exactly as before", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw);
    setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: 2_400_000, nowMs: 1_000 });
    assert.deepEqual(getActiveGoal(database), { segmentId: "segment-1", targetDurationMs: 2_400_000 });
  });

  it("re-saving the next goal on the same segment keeps the long-term goal; null removes it", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw);
    setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: 2_460_000, longTermDurationMs: 2_340_000, nowMs: 1_000 });
    setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: 2_425_000, nowMs: 2_000 });
    assert.equal(getActiveGoal(database)?.longTermDurationMs, 2_340_000);
    assert.equal(getActiveGoal(database)?.targetDurationMs, 2_425_000);
    setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: 2_425_000, longTermDurationMs: null, nowMs: 3_000 });
    assert.deepEqual(getActiveGoal(database), { segmentId: "segment-1", targetDurationMs: 2_425_000 });
  });

  it("moving the goal to another segment drops the old long-term goal", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw, "segment-1");
    insertSegment(raw, "segment-2");
    setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: 2_460_000, longTermDurationMs: 2_340_000, nowMs: 1_000 });
    setActiveGoal(database, { segmentId: "segment-2", targetDurationMs: 900_000, nowMs: 2_000 });
    assert.deepEqual(getActiveGoal(database), { segmentId: "segment-2", targetDurationMs: 900_000 });
  });

  it("rejects a non-positive long-term goal", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw);
    assert.throws(() => setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: 2_400_000, longTermDurationMs: 0, nowMs: 1 }));
  });

  it("an existing single goal row keeps working after the migration", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw);
    raw.prepare("INSERT INTO active_goal (id, segment_id, target_duration_ms, updated_at_ms) VALUES ('singleton', 'segment-1', 2400000, 5)").run();
    assert.deepEqual(getActiveGoal(database), { segmentId: "segment-1", targetDurationMs: 2_400_000 });
  });
});

