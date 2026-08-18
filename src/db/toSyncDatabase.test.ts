import { test } from "node:test";
import assert from "node:assert/strict";
import { toSyncDatabase } from "./toSyncDatabase.ts";

/**
 * A minimal fake of the expo-sqlite `SQLiteDatabase` methods `toSyncDatabase` actually calls.
 * Not the real native module (can't run outside a device) — this only verifies the adapter
 * delegates to the right one-shot methods with the right arguments, and that `runMany`
 * finalizes its statement even when a row throws (the exact bug the real `prepareSync()`
 * design would have had without this).
 */
function fakeSqliteDatabase() {
  const calls: { method: string; args: unknown[] }[] = [];
  let finalizeCallCount = 0;

  const fake = {
    execSync(sql: string) {
      calls.push({ method: "execSync", args: [sql] });
    },
    getFirstSync(sql: string, ...params: unknown[]) {
      calls.push({ method: "getFirstSync", args: [sql, ...params] });
      return { sql, params };
    },
    runSync(sql: string, ...params: unknown[]) {
      calls.push({ method: "runSync", args: [sql, ...params] });
      return { changes: 1, lastInsertRowId: 1 };
    },
    getAllSync(sql: string, ...params: unknown[]) {
      calls.push({ method: "getAllSync", args: [sql, ...params] });
      return [{ sql, params }];
    },
    prepareSync(sql: string) {
      calls.push({ method: "prepareSync", args: [sql] });
      return {
        executeSync(params: unknown) {
          calls.push({ method: "executeSync", args: [params] });
          if (Array.isArray(params) && params[0] === "boom") {
            throw new Error("row failed");
          }
        },
        finalizeSync() {
          finalizeCallCount += 1;
        },
      };
    },
  };

  return { fake, calls, getFinalizeCallCount: () => finalizeCallCount };
}

test("toSyncDatabase", async (t) => {
  await t.test("exec delegates to execSync", () => {
    const { fake, calls } = fakeSqliteDatabase();
    const db = toSyncDatabase(fake as never);
    db.exec("PRAGMA foreign_keys = ON");
    assert.deepEqual(calls, [{ method: "execSync", args: ["PRAGMA foreign_keys = ON"] }]);
  });

  await t.test("prepare().get/run/all are one-shot, no statement retained across calls", () => {
    const { fake, calls } = fakeSqliteDatabase();
    const db = toSyncDatabase(fake as never);

    db.prepare("SELECT 1").get("a");
    db.prepare("INSERT INTO t VALUES (?)").run("b");
    db.prepare("SELECT * FROM t").all("c");

    assert.deepEqual(calls, [
      { method: "getFirstSync", args: ["SELECT 1", "a"] },
      { method: "runSync", args: ["INSERT INTO t VALUES (?)", "b"] },
      { method: "getAllSync", args: ["SELECT * FROM t", "c"] },
    ]);
    // No prepareSync call anywhere — the one-shot path never holds a statement handle.
    assert.ok(!calls.some((c) => c.method === "prepareSync"));
  });

  await t.test("runMany executes every row through one prepared statement, then finalizes", () => {
    const { fake, calls, getFinalizeCallCount } = fakeSqliteDatabase();
    const db = toSyncDatabase(fake as never);

    db.runMany("INSERT INTO ride_points VALUES (?, ?)", [
      ["r1", 0],
      ["r1", 1],
      ["r1", 2],
    ]);

    assert.equal(calls.filter((c) => c.method === "prepareSync").length, 1);
    assert.equal(calls.filter((c) => c.method === "executeSync").length, 3);
    assert.equal(getFinalizeCallCount(), 1);
  });

  await t.test("runMany finalizes the statement even when a row throws mid-loop", () => {
    const { fake, getFinalizeCallCount } = fakeSqliteDatabase();
    const db = toSyncDatabase(fake as never);

    assert.throws(
      () => db.runMany("INSERT INTO t VALUES (?)", [["ok"], ["boom"], ["never reached"]]),
      /row failed/,
    );
    assert.equal(getFinalizeCallCount(), 1);
  });
});
