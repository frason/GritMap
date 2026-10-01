import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { setAthleteProfile } from "./setAthleteProfile.ts";
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

function migratedDatabase(): SyncDatabase {
  const raw = new DatabaseSync(":memory:");
  const database = toTestSyncDatabase(raw);
  applyMigrations(database);
  return database;
}

describe("setAthleteProfile", () => {
  it("rejects a non-positive FTP", () => {
    const database = migratedDatabase();
    assert.throws(() => setAthleteProfile(database, { ftpWatts: 0, nowMs: 1_000 }));
    assert.throws(() => setAthleteProfile(database, { ftpWatts: -5, nowMs: 1_000 }));
  });

  it("rejects a non-positive max heart rate", () => {
    const database = migratedDatabase();
    assert.throws(() => setAthleteProfile(database, { maxHeartRateBpm: 0, nowMs: 1_000 }));
  });

  it("rejects a non-positive weight", () => {
    const database = migratedDatabase();
    assert.throws(() => setAthleteProfile(database, { weightKg: 0, nowMs: 1_000 }));
    assert.throws(() => setAthleteProfile(database, { weightKg: -70, nowMs: 1_000 }));
  });

  it("rejects non-finite values", () => {
    const database = migratedDatabase();
    assert.throws(() => setAthleteProfile(database, { ftpWatts: Number.NaN, nowMs: 1_000 }));
    assert.throws(() =>
      setAthleteProfile(database, { maxHeartRateBpm: Number.POSITIVE_INFINITY, nowMs: 1_000 }),
    );
    assert.throws(() => setAthleteProfile(database, { weightKg: Number.NaN, nowMs: 1_000 }));
  });

  it("allows saving with every field omitted", () => {
    const database = migratedDatabase();
    assert.doesNotThrow(() => setAthleteProfile(database, { nowMs: 1_000 }));
  });
});
