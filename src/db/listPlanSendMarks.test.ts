import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { listPlanSendMarks } from "./listPlanSendMarks.ts";
import { applyMigrations } from "./migrations.ts";
import { recordPlanSend, type SentBaselinePlan } from "./planSends.ts";

const plan = (ftpWatts: number): SentBaselinePlan => ({
  id: "pkg", segmentFingerprint: "fp", createdAtMs: 1, generator: { type: "manual", modelVersion: "x" }, ftpWatts, zones: [],
});

describe("listPlanSendMarks", () => {
  it("returns the latest send of each segment, newest first", () => {
    const database = new DatabaseSync(":memory:");
    applyMigrations(database);
    for (const id of ["s1", "s2"]) {
      database.prepare(`INSERT INTO segments (id, name, corridor_meters, required_coverage, schema_version, fingerprint, created_at_ms) VALUES (?, 'Seg', 30, 0.9, 1, ?, 1000)`).run(id, `fp-${id}`);
    }
    recordPlanSend(database, { id: "a", segmentId: "s1", sentAtMs: 1_000, packageId: "p1", plan: plan(250) });
    recordPlanSend(database, { id: "b", segmentId: "s1", sentAtMs: 3_000, packageId: "p2", plan: plan(280) });
    recordPlanSend(database, { id: "c", segmentId: "s2", sentAtMs: 2_000, packageId: "p3", plan: plan(280) });
    assert.deepEqual(listPlanSendMarks(database), [
      { segmentId: "s1", sentAtMs: 3_000, ftpWatts: 280 },
      { segmentId: "s2", sentAtMs: 2_000, ftpWatts: 280 },
    ]);
  });
});
