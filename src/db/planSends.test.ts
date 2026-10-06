import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { getPlanSentBefore, recordPlanSend, type SentBaselinePlan } from "./planSends.ts";

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

function plan(overrides: Partial<SentBaselinePlan> = {}): SentBaselinePlan {
  return {
    id: "pkg",
    segmentFingerprint: "fp",
    createdAtMs: 1,
    generator: { type: "manual", modelVersion: "ai-coach" },
    ftpWatts: 280,
    targetFinishTimeSeconds: 2_512,
    zones: [
      { startDistanceMeters: 0, endDistanceMeters: 500, targetPowerWatts: 250, classification: "HOLD", icon: "HOLD", instruction: "Hold" },
      { startDistanceMeters: 500, endDistanceMeters: 1_000, targetPowerWatts: 300, classification: "PUSH", icon: "PUSH", instruction: "Go" },
    ],
    ...overrides,
  };
}

const record = (database: DatabaseSync, id: string, sentAtMs: number, p = plan(), segmentId = "s1") =>
  recordPlanSend(database, { id, segmentId, sentAtMs, packageId: `pkg-${id}`, plan: p });

describe("plan sends", () => {
  it("round-trips what was sent: metadata, target time and zones", () => {
    const database = migrated();
    insertSegment(database, "s1");
    record(database, "send-1", 5_000);
    assert.deepEqual(getPlanSentBefore(database, "s1", 9_000), {
      sendId: "send-1",
      sentAtMs: 5_000,
      generatorType: "manual",
      generatorModelVersion: "ai-coach",
      ftpWatts: 280,
      targetFinishSeconds: 2_512,
      zones: [
        { startDistanceMeters: 0, endDistanceMeters: 500, targetPowerWatts: 250 },
        { startDistanceMeters: 500, endDistanceMeters: 1_000, targetPowerWatts: 300 },
      ],
    });
  });

  it("picks the latest send at or before the ride, so a later resend never rewrites an earlier ride's plan", () => {
    const database = migrated();
    insertSegment(database, "s1");
    record(database, "send-1", 1_000, plan({ ftpWatts: 270 }));
    record(database, "send-2", 5_000, plan({ ftpWatts: 280 }));
    record(database, "send-3", 9_000, plan({ ftpWatts: 290 }));
    assert.equal(getPlanSentBefore(database, "s1", 7_000)!.sendId, "send-2");
    assert.equal(getPlanSentBefore(database, "s1", 5_000)!.sendId, "send-2"); // at the instant counts
    assert.equal(getPlanSentBefore(database, "s1", 100_000)!.sendId, "send-3");
    assert.equal(getPlanSentBefore(database, "s1", 7_000)!.ftpWatts, 280);
  });

  it("is undefined when the ride predates every send, or the segment has none", () => {
    const database = migrated();
    insertSegment(database, "s1");
    insertSegment(database, "s2");
    record(database, "send-1", 5_000);
    assert.equal(getPlanSentBefore(database, "s1", 4_999), undefined);
    assert.equal(getPlanSentBefore(database, "s2", 9_000), undefined);
    assert.equal(getPlanSentBefore({ prepare: () => ({ get: () => null, run: () => {} }) }, "s1", 1), undefined);
  });

  it("omits the target when the plan carried none", () => {
    const database = migrated();
    insertSegment(database, "s1");
    const { targetFinishTimeSeconds: _drop, ...noTarget } = plan();
    record(database, "send-1", 5_000, noTarget);
    assert.equal("targetFinishSeconds" in getPlanSentBefore(database, "s1", 9_000)!, false);
  });

  it("keeps segments apart and deletes with the segment", () => {
    const database = migrated();
    insertSegment(database, "s1");
    insertSegment(database, "s2");
    record(database, "send-1", 5_000, plan(), "s1");
    record(database, "send-2", 5_000, plan({ ftpWatts: 260 }), "s2");
    assert.equal(getPlanSentBefore(database, "s2", 9_000)!.ftpWatts, 260);
    database.prepare("DELETE FROM segments WHERE id = 's1'").run();
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM plan_sends").get()!.n, 1);
  });

  it("rejects a send for a segment that does not exist", () => {
    const database = migrated();
    assert.throws(() => record(database, "send-1", 5_000, plan(), "missing"), /FOREIGN KEY/);
  });
});
