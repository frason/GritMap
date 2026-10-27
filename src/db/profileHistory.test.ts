import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations, migrations } from "./migrations.ts";
import {
  addBackdatedWeight,
  createWeightAt,
  listProfileHistory,
  removeBackdatedWeight,
  weightAtFromEntries,
  type ProfileHistoryEntry,
} from "./profileHistory.ts";
import { setAthleteProfile } from "./setAthleteProfile.ts";
import type { SyncDatabase } from "./types.ts";

function toSync(database: DatabaseSync): SyncDatabase {
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

function migrated(): SyncDatabase {
  const database = toSync(new DatabaseSync(":memory:"));
  applyMigrations(database);
  return database;
}

const DAY = 86_400_000;
const T0 = 1_700_000_000_000;

describe("athlete_profile_history migration", () => {
  it("backfills a first row from the existing profile when upgrading a populated database", () => {
    const raw = new DatabaseSync(":memory:");
    applyMigrations(raw, migrations.slice(0, 14));
    raw.prepare("INSERT INTO athlete_profile (id, ftp_watts, max_heart_rate_bpm, weight_kg, updated_at_ms) VALUES ('singleton', 280, 175, 92.5, 5000)").run();

    applyMigrations(raw);

    const rows = raw.prepare("SELECT effective_from_ms, ftp_watts, weight_kg, max_heart_rate_bpm, source, recorded_at_ms FROM athlete_profile_history").all();
    assert.equal(rows.length, 1);
    assert.deepEqual({ ...rows[0] }, { effective_from_ms: 5000, ftp_watts: 280, weight_kg: 92.5, max_heart_rate_bpm: 175, source: "backfill", recorded_at_ms: 5000 });
    assert.equal(Number(raw.prepare("PRAGMA user_version").get()?.user_version), 17);
    // the profile itself is untouched
    assert.equal(raw.prepare("SELECT weight_kg AS w FROM athlete_profile WHERE id = 'singleton'").get()?.w, 92.5);
  });

  it("adds no row for a database that never had a profile, and the table starts empty on a fresh install", () => {
    const upgraded = new DatabaseSync(":memory:");
    applyMigrations(upgraded, migrations.slice(0, 14));
    applyMigrations(upgraded);
    assert.equal(upgraded.prepare("SELECT COUNT(*) AS n FROM athlete_profile_history").get()?.n, 0);
    const fresh = new DatabaseSync(":memory:");
    applyMigrations(fresh);
    assert.equal(fresh.prepare("SELECT COUNT(*) AS n FROM athlete_profile_history").get()?.n, 0);
  });

  it("rejects a non-positive weight and an unknown source", () => {
    const database = migrated();
    assert.throws(() => database.prepare("INSERT INTO athlete_profile_history (effective_from_ms, weight_kg, source, recorded_at_ms) VALUES (1, 0, 'profile', 1)").run(), /CHECK constraint failed/);
    assert.throws(() => database.prepare("INSERT INTO athlete_profile_history (effective_from_ms, weight_kg, source, recorded_at_ms) VALUES (1, 80, 'other', 1)").run(), /CHECK constraint failed/);
  });
});

describe("setAthleteProfile keeps a dated history", () => {
  it("adds a row on the first save and when FTP, weight or max HR changes, and not for an identical re-save", () => {
    const database = migrated();
    setAthleteProfile(database, { ftpWatts: 250, weightKg: 80, nowMs: T0 });
    setAthleteProfile(database, { ftpWatts: 250, weightKg: 80, nowMs: T0 + DAY });
    assert.equal(listProfileHistory(database).length, 1);
    setAthleteProfile(database, { ftpWatts: 250, weightKg: 81, nowMs: T0 + 2 * DAY });
    setAthleteProfile(database, { ftpWatts: 255, weightKg: 81, nowMs: T0 + 3 * DAY });
    setAthleteProfile(database, { ftpWatts: 255, weightKg: 81, maxHeartRateBpm: 180, nowMs: T0 + 4 * DAY });
    const rows = listProfileHistory(database);
    assert.deepEqual(rows.map((row) => [row.effectiveFromMs, row.ftpWatts, row.weightKg, row.maxHeartRateBpm, row.source]), [
      [T0, 250, 80, undefined, "profile"],
      [T0 + 2 * DAY, 250, 81, undefined, "profile"],
      [T0 + 3 * DAY, 255, 81, undefined, "profile"],
      [T0 + 4 * DAY, 255, 81, 180, "profile"],
    ]);
  });

  it("a back-dated weight does not stop the next identical save from being recognised as unchanged", () => {
    const database = migrated();
    setAthleteProfile(database, { ftpWatts: 250, weightKg: 90, nowMs: T0 });
    addBackdatedWeight(database, { effectiveFromMs: T0 - 100 * DAY, weightKg: 85, nowMs: T0 + DAY });
    addBackdatedWeight(database, { effectiveFromMs: T0 + DAY, weightKg: 86, nowMs: T0 + DAY });
    setAthleteProfile(database, { ftpWatts: 250, weightKg: 90, nowMs: T0 + 2 * DAY });
    assert.equal(listProfileHistory(database).filter((row) => row.source === "profile").length, 1);
  });

  it("a weight rider-entered for a past date does not change the current profile", () => {
    const database = migrated();
    setAthleteProfile(database, { ftpWatts: 250, weightKg: 90, nowMs: T0 });
    addBackdatedWeight(database, { effectiveFromMs: T0 - 30 * DAY, weightKg: 85, nowMs: T0 });
    assert.equal((database.prepare("SELECT weight_kg AS w FROM athlete_profile WHERE id = 'singleton'").get() as { w: number }).w, 90);
  });
});

describe("weightAtFromEntries", () => {
  const entry = (id: number, effectiveFromMs: number, weightKg?: number): ProfileHistoryEntry => ({
    id,
    effectiveFromMs,
    source: "profile",
    ...(weightKg === undefined ? {} : { weightKg }),
  });

  it("takes the latest row at or before the moment", () => {
    const entries = [entry(1, 100, 80), entry(2, 200, 82), entry(3, 300, 85)];
    assert.equal(weightAtFromEntries(entries, 250), 82);
    assert.equal(weightAtFromEntries(entries, 200), 82);
    assert.equal(weightAtFromEntries(entries, 10_000), 85);
  });

  it("uses the earliest row for a moment before it", () => {
    assert.equal(weightAtFromEntries([entry(1, 100, 80), entry(2, 200, 82)], 5), 80);
  });

  it("skips rows without a weight, and is undefined when none has one", () => {
    assert.equal(weightAtFromEntries([entry(1, 100), entry(2, 200, 82), entry(3, 300)], 350), 82);
    assert.equal(weightAtFromEntries([entry(1, 100)], 150), undefined);
    assert.equal(weightAtFromEntries([], 150), undefined);
  });
});

describe("back-dated weights", () => {
  it("are stored, listed in date order, used by weightAt and removable (profile rows are not)", () => {
    const database = migrated();
    setAthleteProfile(database, { ftpWatts: 280, weightKg: 93, nowMs: T0 });
    addBackdatedWeight(database, { effectiveFromMs: T0 - 500 * DAY, weightKg: 90.5, nowMs: T0 });
    const weightAt = createWeightAt(database)!;
    assert.equal(weightAt(T0 - 600 * DAY), 90.5, "older than every row: the earliest row");
    assert.equal(weightAt(T0 - 400 * DAY), 90.5);
    assert.equal(weightAt(T0 + DAY), 93);
    const rows = listProfileHistory(database);
    assert.deepEqual(rows.map((row) => row.source), ["backdated", "profile"]);
    removeBackdatedWeight(database, rows[1]!.id);
    assert.equal(listProfileHistory(database).length, 2, "a profile row is kept");
    removeBackdatedWeight(database, rows[0]!.id);
    assert.deepEqual(listProfileHistory(database).map((row) => row.source), ["profile"]);
  });

  it("createWeightAt is undefined when no weight was ever recorded", () => {
    const database = migrated();
    assert.equal(createWeightAt(database), undefined);
    setAthleteProfile(database, { ftpWatts: 250, nowMs: T0 });
    assert.equal(createWeightAt(database), undefined);
  });

  it("rejects a non-positive weight, a non-positive date and a date in the future", () => {
    const database = migrated();
    assert.throws(() => addBackdatedWeight(database, { effectiveFromMs: T0, weightKg: 0, nowMs: T0 + 1 }));
    assert.throws(() => addBackdatedWeight(database, { effectiveFromMs: 0, weightKg: 80, nowMs: T0 }));
    assert.throws(() => addBackdatedWeight(database, { effectiveFromMs: T0 + DAY, weightKg: 80, nowMs: T0 }), /future/);
  });
});
