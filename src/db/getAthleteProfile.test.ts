import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { getAthleteProfile } from "./getAthleteProfile.ts";
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

describe("getAthleteProfile", () => {
  it("returns an all-absent profile when nothing has ever been saved", () => {
    const database = migratedDatabase();
    assert.deepEqual(getAthleteProfile(database), {});
  });

  it("treats a real null row (what expo-sqlite's getFirstSync() actually returns for no match, unlike node:sqlite's undefined) as not-found", () => {
    const fakeDatabase = { prepare: () => ({ get: () => null }) };
    assert.deepEqual(getAthleteProfile(fakeDatabase), {});
  });

  it("returns what setAthleteProfile saved", () => {
    const database = migratedDatabase();
    setAthleteProfile(database, { ftpWatts: 250, maxHeartRateBpm: 185, weightKg: 75.5, nowMs: 1_000 });
    assert.deepEqual(getAthleteProfile(database), {
      profileVersion: 1,
      ftpWatts: 250,
      maxHeartRateBpm: 185,
      weightKg: 75.5,
    });
  });

  it("omits a threshold that was never set, rather than fabricating a value", () => {
    const database = migratedDatabase();
    setAthleteProfile(database, { ftpWatts: 250, nowMs: 1_000 });
    assert.deepEqual(getAthleteProfile(database), { profileVersion: 1, ftpWatts: 250 });
  });

  it("a second save overwrites the first (singleton row, not a new one)", () => {
    const database = migratedDatabase();
    setAthleteProfile(database, { ftpWatts: 250, maxHeartRateBpm: 185, nowMs: 1_000 });
    setAthleteProfile(database, { ftpWatts: 260, nowMs: 2_000 });
    assert.deepEqual(getAthleteProfile(database), { profileVersion: 2, ftpWatts: 260 });
  });
});
