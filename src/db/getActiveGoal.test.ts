import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { getActiveGoal, getSegmentGoal, listSegmentGoals } from "./getActiveGoal.ts";
import { setActiveGoal, setSegmentGoal } from "./setActiveGoal.ts";
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

describe("getActiveGoal", () => {
  it("returns undefined when no goal has ever been set", () => {
    const { database } = migratedDatabase();
    assert.equal(getActiveGoal(database), undefined);
  });

  it("treats a real null row (what expo-sqlite's getFirstSync() actually returns for no match, unlike node:sqlite's undefined) as not-found", () => {
    const fakeDatabase = { prepare: () => ({ get: () => null }) };
    assert.equal(getActiveGoal(fakeDatabase), undefined);
  });

  it("returns what setActiveGoal saved", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw);
    setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: 39 * 60_000, nowMs: 1_000 });
    assert.deepEqual(getActiveGoal(database), { segmentId: "segment-1", targetDurationMs: 39 * 60_000, updatedAtMs: 1_000 });
  });

  it("each segment keeps its own goal; the latest setActiveGoal is Home's headline", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw, "segment-1");
    insertSegment(raw, "segment-2");
    setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: 2_000_000, nowMs: 1_000 });
    setActiveGoal(database, { segmentId: "segment-2", targetDurationMs: 3_000_000, nowMs: 2_000 });
    assert.deepEqual(getActiveGoal(database), { segmentId: "segment-2", targetDurationMs: 3_000_000, updatedAtMs: 2_000 });
    assert.deepEqual(getSegmentGoal(database, "segment-1"), { segmentId: "segment-1", targetDurationMs: 2_000_000, updatedAtMs: 1_000 });
    assert.equal(getSegmentGoal(database, "segment-3"), undefined);
    assert.deepEqual(listSegmentGoals(database).map((goal) => goal.segmentId), ["segment-2", "segment-1"]);
  });

  it("setSegmentGoal does not move the headline, except to fill an empty one", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw, "segment-1");
    insertSegment(raw, "segment-2");
    setSegmentGoal(database, { segmentId: "segment-1", targetDurationMs: 2_000_000, nowMs: 1_000 });
    assert.equal(getActiveGoal(database)?.segmentId, "segment-1");
    setSegmentGoal(database, { segmentId: "segment-2", targetDurationMs: 3_000_000, nowMs: 2_000 });
    assert.equal(getActiveGoal(database)?.segmentId, "segment-1");
    assert.equal(getSegmentGoal(database, "segment-2")?.targetDurationMs, 3_000_000);
  });

  it("falls back to the newest goal when the headline segment is deleted", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw, "segment-1");
    insertSegment(raw, "segment-2");
    setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: 2_000_000, nowMs: 1_000 });
    setSegmentGoal(database, { segmentId: "segment-2", targetDurationMs: 3_000_000, nowMs: 2_000 });
    raw.prepare("DELETE FROM segments WHERE id = 'segment-1'").run();
    assert.equal(getActiveGoal(database)?.segmentId, "segment-2");
  });

  it("rejects setting a goal for a segment that doesn't exist", () => {
    const { database } = migratedDatabase();
    assert.throws(() =>
      setActiveGoal(database, { segmentId: "no-such-segment", targetDurationMs: 1_000, nowMs: 1_000 }),
    );
  });

  it("cascades: deleting the goal segment removes the goal", () => {
    const { raw, database } = migratedDatabase();
    insertSegment(raw);
    setActiveGoal(database, { segmentId: "segment-1", targetDurationMs: 1_000, nowMs: 1_000 });
    raw.prepare("DELETE FROM segments WHERE id = 'segment-1'").run();
    assert.equal(getActiveGoal(database), undefined);
  });
});
