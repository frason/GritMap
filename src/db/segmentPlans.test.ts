import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import type { ParsedCoachPlan } from "../pacing/coachPlan.ts";
import { applyMigrations } from "./migrations.ts";
import {
  deactivateSegmentPlan,
  getActiveSegmentPlan,
  isSegmentPlanOutdated,
  markSegmentPlanSent,
  saveSegmentPlan,
} from "./segmentPlans.ts";

function migrated(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  database.exec("PRAGMA foreign_keys = ON");
  return database;
}

function insertSegment(database: DatabaseSync, id: string): void {
  database
    .prepare(
      `INSERT INTO segments (id, name, corridor_meters, required_coverage, schema_version, fingerprint, created_at_ms)
       VALUES (?, 'Seg', 30, 0.9, 1, ?, 1000)`,
    )
    .run(id, `fp-${id}`);
}

function plan(overrides: Partial<ParsedCoachPlan> = {}): ParsedCoachPlan {
  return {
    source: "human-coach",
    authorLabel: "Sam",
    segmentFingerprint: "ab".repeat(32),
    targetFinishTimeSeconds: 2_340,
    zones: [
      { startDistanceMeters: 0, endDistanceMeters: 500, targetPowerWatts: 250, classification: "HOLD", instruction: "Hold" },
      { startDistanceMeters: 500, endDistanceMeters: 1_000, targetPowerWatts: 290, classification: "PUSH", instruction: "Push" },
    ],
    ...overrides,
  };
}

const save = (database: DatabaseSync, id: string, p: ParsedCoachPlan, nowMs = 5_000, segmentId = "s1") =>
  saveSegmentPlan(database, { id, segmentId, plan: p, profileVersion: 3, ftpWatts: 280, nowMs });

describe("segment plans", () => {
  it("round-trips a saved plan, omitting absent optional fields", () => {
    const database = migrated();
    insertSegment(database, "s1");
    save(database, "plan-1", plan());
    assert.deepEqual(getActiveSegmentPlan(database, "s1"), {
      id: "plan-1",
      segmentId: "s1",
      source: "human-coach",
      authorLabel: "Sam",
      profileVersion: 3,
      ftpWatts: 280,
      targetFinishSeconds: 2_340,
      zones: plan().zones,
      createdAtMs: 5_000,
    });

    save(database, "plan-2", { source: "self", segmentFingerprint: "ab".repeat(32), zones: plan().zones });
    const second = getActiveSegmentPlan(database, "s1")!;
    assert.equal(second.id, "plan-2");
    assert.equal("authorLabel" in second, false);
    assert.equal("targetFinishSeconds" in second, false);
  });

  it("returns undefined for a segment with no active plan, including a real null row", () => {
    const database = migrated();
    insertSegment(database, "s1");
    assert.equal(getActiveSegmentPlan(database, "s1"), undefined);
    assert.equal(getActiveSegmentPlan({ ...database, exec: () => {}, prepare: () => ({ get: () => null, run: () => {} }) }, "s1"), undefined);
  });

  it("a new save retires the previous plan: one active, the old one kept inactive", () => {
    const database = migrated();
    insertSegment(database, "s1");
    save(database, "plan-1", plan());
    save(database, "plan-2", plan({ source: "ai-coach" }), 6_000);

    assert.equal(getActiveSegmentPlan(database, "s1")!.id, "plan-2");
    const rows = database.prepare("SELECT id, is_active FROM segment_plans ORDER BY created_at_ms").all();
    assert.deepEqual(rows.map((row) => ({ ...row })), [
      { id: "plan-1", is_active: 0 },
      { id: "plan-2", is_active: 1 },
    ]);
  });

  it("keeps plans per segment independent", () => {
    const database = migrated();
    insertSegment(database, "s1");
    insertSegment(database, "s2");
    save(database, "plan-1", plan(), 5_000, "s1");
    save(database, "plan-2", plan(), 5_000, "s2");
    assert.equal(getActiveSegmentPlan(database, "s1")!.id, "plan-1");
    assert.equal(getActiveSegmentPlan(database, "s2")!.id, "plan-2");
  });

  it("rolls the whole save back when the insert fails, leaving the old plan active", () => {
    const database = migrated();
    insertSegment(database, "s1");
    save(database, "plan-1", plan());
    assert.throws(() => save(database, "plan-1", plan(), 6_000)); // duplicate primary key
    assert.equal(getActiveSegmentPlan(database, "s1")!.id, "plan-1");
  });

  it("rejects a plan for a segment that does not exist", () => {
    const database = migrated();
    assert.throws(() => save(database, "plan-1", plan(), 5_000, "missing"), /FOREIGN KEY/);
  });

  it("deactivating falls back to no active plan but keeps the row", () => {
    const database = migrated();
    insertSegment(database, "s1");
    save(database, "plan-1", plan());
    deactivateSegmentPlan(database, "s1");
    assert.equal(getActiveSegmentPlan(database, "s1"), undefined);
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM segment_plans").get()!.n, 1);
  });

  it("records when a plan was sent", () => {
    const database = migrated();
    insertSegment(database, "s1");
    save(database, "plan-1", plan());
    markSegmentPlanSent(database, "plan-1", 9_000);
    assert.equal(getActiveSegmentPlan(database, "s1")!.lastSentAtMs, 9_000);
  });

  it("deleting the segment deletes its plans", () => {
    const database = migrated();
    insertSegment(database, "s1");
    save(database, "plan-1", plan());
    database.prepare("DELETE FROM segments WHERE id = 's1'").run();
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM segment_plans").get()!.n, 0);
  });

  it("rejects an unknown source at the database level", () => {
    const database = migrated();
    insertSegment(database, "s1");
    assert.throws(() => save(database, "plan-1", plan({ source: "robot" as never })), /CHECK constraint/);
  });
});

describe("isSegmentPlanOutdated", () => {
  it("is outdated only when FTP has moved", () => {
    assert.equal(isSegmentPlanOutdated({ ftpWatts: 280 }, 280), false);
    assert.equal(isSegmentPlanOutdated({ ftpWatts: 280 }, 290), true);
    assert.equal(isSegmentPlanOutdated({ ftpWatts: 280 }, 279.6), false); // rounds to 280
    assert.equal(isSegmentPlanOutdated({ ftpWatts: 280 }, undefined), false);
  });
});
