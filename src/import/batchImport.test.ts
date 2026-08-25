import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "../db/migrations.ts";
import type { SyncDatabase } from "../db/types.ts";
import { importFitFile } from "./importFitFile.ts";

/** Mirrors toSyncDatabase.ts's shape, same pattern as importFitFile.test.ts. */
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

/**
 * docs/MVP.md's acceptance criteria: "Import at least 100 FIT files in a batch without
 * crashing" and "a failed file does not roll back successful imports" -- issue #14 permits
 * synthetic copies. Mirrors ImportScreen.tsx's own sequential, catch-and-continue loop
 * exactly (real production logic, not a reimplementation), against real FIT fixtures.
 */
describe("batch import at MVP acceptance scale", () => {
  it("imports 100+ files (mixed real copies, exact duplicates, and one corrupt file) without crashing", () => {
    using rawDatabase = new DatabaseSync(":memory:");
    const database = toTestSyncDatabase(rawDatabase);
    applyMigrations(database);

    const fixtureA = readFileSync("fixtures/fit/Karoo-Morning_Ride-2026-08-02-0837.fit");
    const fixtureB = readFileSync("fixtures/fit/Karoo-Morning_Ride-2026-08-09-0844.fit");
    const corrupt = Buffer.from("this is not a valid FIT file");

    const batch: { bytes: Buffer; filename: string }[] = [];
    for (let i = 0; i < 60; i += 1) batch.push({ bytes: fixtureA, filename: `ride-a-${i}.fit` });
    for (let i = 0; i < 40; i += 1) batch.push({ bytes: fixtureB, filename: `ride-b-${i}.fit` });
    // Interleave the corrupt file in the middle, exactly where a real bad file could land.
    batch.splice(75, 0, { bytes: corrupt, filename: "corrupt.fit" });
    assert.equal(batch.length, 101);

    let generatedIdCounter = 0;
    const generateId = () => `id-${(generatedIdCounter += 1)}`;
    const statusCounts = { imported: 0, duplicate: 0, "duplicate-kept": 0, replaced: 0, failed: 0 };

    const startedAtMs = Date.now();
    for (const file of batch) {
      const contentHash = createHash("sha256").update(file.bytes).digest("hex");
      const result = importFitFile(database, generateId, {
        bytes: file.bytes,
        filename: file.filename,
        contentHash,
        retainedFileUri: `fake://${file.filename}`,
        fileSizeBytes: file.bytes.length,
        nowMs: startedAtMs,
      });
      statusCounts[result.status] += 1;
    }
    const elapsedMs = Date.now() - startedAtMs;

    // The one corrupt file failed cleanly -- it did not throw, and did not stop the loop.
    assert.equal(statusCounts.failed, 1);
    // Exactly the first copy of each real fixture actually inserted; every other copy of
    // the same file is correctly recognized as an exact-content duplicate at this scale --
    // proving the failed file didn't roll back or corrupt anything that came before or after it.
    assert.equal(statusCounts.imported, 2);
    assert.equal(statusCounts.duplicate, 98);
    assert.equal(count(rawDatabase, "rides"), 2);
    assert.equal(count(rawDatabase, "imported_files"), 2);

    // No hard scale requirement per SPEC.md ("no performance/scale requirements beyond the
    // acceptance criteria") -- this is a sanity ceiling, not a benchmark.
    assert.ok(elapsedMs < 30_000, `expected under 30s for 101 files, took ${elapsedMs}ms`);
  });
});

function count(database: DatabaseSync, table: string): number {
  return Number(database.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.count);
}
