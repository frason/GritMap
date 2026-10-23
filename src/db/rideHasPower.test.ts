import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { rideHasPower } from "./rideHasPower.ts";

function ride(database: DatabaseSync, id: string, powers: (number | null)[]): void {
  database.prepare("INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms) VALUES (?, ?, ?, 1)").run(`f-${id}`, `f-${id}`.padEnd(64, "0"), `${id}.fit`);
  database.prepare("INSERT INTO rides (id, imported_file_id, parser_version, created_at_ms, updated_at_ms) VALUES (?, ?, 1, 1, 1)").run(id, `f-${id}`);
  powers.forEach((power, i) => database.prepare("INSERT INTO ride_points (ride_id, point_index, timestamp_ms, power_watts) VALUES (?, ?, ?, ?)").run(id, i, 1_000 + i, power));
}

describe("rideHasPower", () => {
  it("is true when any point has power, false when none does or the ride has no points", () => {
    const database = new DatabaseSync(":memory:");
    applyMigrations(database);
    ride(database, "with", [null, 210, null]);
    ride(database, "without", [null, null]);
    ride(database, "empty", []);
    assert.equal(rideHasPower(database, "with"), true);
    assert.equal(rideHasPower(database, "without"), false);
    assert.equal(rideHasPower(database, "empty"), false);
    assert.equal(rideHasPower(database, "missing"), false);
  });

  it("counts a real zero as a power reading (coasting) and treats a null row from expo-sqlite as none", () => {
    const database = new DatabaseSync(":memory:");
    applyMigrations(database);
    ride(database, "zero", [0]);
    assert.equal(rideHasPower(database, "zero"), true);
    assert.equal(rideHasPower({ prepare: () => ({ get: () => null }) }, "x"), false);
  });
});
