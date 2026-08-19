import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, describe, it, mock } from "node:test";

/**
 * Proves `initializeDatabase()` works against the real expo-sqlite call shape, not a
 * hand-copied stand-in of the adapter under test. `mock.module()` replaces the `expo-sqlite`
 * package itself; every call still runs through the real `initializeDatabase.ts` and
 * `toSyncDatabase.ts`. The fake is backed by real `node:sqlite` databases on real temp files
 * (not `:memory:`) so close+reopen genuinely round-trips through disk -- required to prove
 * the poisoned-handle eviction below for real, not just by reading the code.
 */

const tempDir = mkdtempSync(join(tmpdir(), "gritmap-expo-bootstrap-"));
const realDatabases = new Map<string, DatabaseSync>();
let failNextMigrationStatement = false;

function realDatabaseFor(name: string): DatabaseSync {
  const cached = realDatabases.get(name);
  if (cached) return cached;
  const database = new DatabaseSync(join(tempDir, name));
  realDatabases.set(name, database);
  return database;
}

mock.module("expo-sqlite", {
  exports: {
    openDatabaseSync(name: string) {
      const real = realDatabaseFor(name);
      return {
        execSync(sql: string) {
          // Targets migration v3's unique column, so this stays valid no matter how many
          // migrations exist -- it fails one real migration statement, not a hardcoded step.
          if (failNextMigrationStatement && sql.includes("total_ascent_meters")) {
            failNextMigrationStatement = false;
            throw new Error("simulated migration failure");
          }
          real.exec(sql);
        },
        getFirstSync(sql: string, ...params: unknown[]) {
          return real.prepare(sql).get(...(params as never[])) ?? null;
        },
        runSync(sql: string, ...params: unknown[]) {
          return real.prepare(sql).run(...(params as never[]));
        },
        getAllSync(sql: string, ...params: unknown[]) {
          return real.prepare(sql).all(...(params as never[]));
        },
        prepareSync(sql: string) {
          const statement = real.prepare(sql);
          return {
            executeSync(params: unknown[]) {
              return statement.run(...(params as never[]));
            },
            finalizeSync() {
              // node:sqlite statements need no explicit finalize.
            },
          };
        },
        closeSync() {
          real.close();
          realDatabases.delete(name);
        },
      };
    },
  },
});

const { initializeDatabase } = await import("./initializeDatabase.ts");
const { closeDatabaseConnection } = await import("./connection.ts");

const CORE_TABLES = [
  "imported_files",
  "rides",
  "ride_points",
  "segments",
  "segment_reference_points",
  "segment_attempts",
  "match_diagnostics",
];

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("initializeDatabase (real expo-sqlite call shape, mocked module)", () => {
  it("opens a fresh database, migrates it, and enables foreign keys", () => {
    const dbName = "bootstrap-fresh.db";
    const database = initializeDatabase(dbName);

    const version = database.prepare("PRAGMA user_version").get() as
      | { user_version?: number }
      | undefined;
    assert.equal(Number(version?.user_version), 3);

    const tables = (
      database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
        name: string;
      }[]
    ).map((row) => row.name);
    for (const table of CORE_TABLES) {
      assert.ok(tables.includes(table), `missing table ${table}`);
    }

    const foreignKeys = database.prepare("PRAGMA foreign_keys").get() as
      | { foreign_keys?: number }
      | undefined;
    assert.equal(Number(foreignKeys?.foreign_keys), 1);

    closeDatabaseConnection(dbName);
  });

  it("is idempotent -- bootstrapping an already-migrated database is a no-op", () => {
    const dbName = "bootstrap-idempotent.db";
    initializeDatabase(dbName);
    closeDatabaseConnection(dbName);

    const database = initializeDatabase(dbName);
    const version = database.prepare("PRAGMA user_version").get() as
      | { user_version?: number }
      | undefined;
    assert.equal(Number(version?.user_version), 3);

    closeDatabaseConnection(dbName);
  });

  it("evicts the cached connection on failure so a retry reopens and succeeds", () => {
    const dbName = "bootstrap-poisoned.db";
    failNextMigrationStatement = true;

    assert.throws(() => initializeDatabase(dbName), /Migration 3 .* failed/);

    // If the failed connection stayed cached, this retry would reuse the same broken
    // handle. It must instead reopen cleanly and finish migrating.
    const database = initializeDatabase(dbName);
    const version = database.prepare("PRAGMA user_version").get() as
      | { user_version?: number }
      | undefined;
    assert.equal(Number(version?.user_version), 3);

    closeDatabaseConnection(dbName);
  });
});
