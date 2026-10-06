import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "../db/migrations.ts";
import { getSavedKarooAddress, saveKarooAddress } from "./savedKarooAddress.ts";

function migrated(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  return database;
}

describe("saved Karoo address", () => {
  it("is undefined until an address has been saved", () => {
    assert.equal(getSavedKarooAddress(migrated()), undefined);
    const nullRow = { prepare: () => ({ get: () => null, run: () => {} }) };
    assert.equal(getSavedKarooAddress(nullRow), undefined);
  });

  it("stores whatever the rider typed in the canonical host:port form", () => {
    const database = migrated();
    assert.equal(saveKarooAddress(database, "192.168.7.50", 1_000), "192.168.7.50:8734");
    assert.equal(getSavedKarooAddress(database), "192.168.7.50:8734");
    assert.equal(saveKarooAddress(database, " http://192.168.7.51:9000/transfer ", 2_000), "192.168.7.51:9000");
    assert.equal(getSavedKarooAddress(database), "192.168.7.51:9000");
  });

  it("round-trips: the saved form is itself a valid input", () => {
    const database = migrated();
    const saved = saveKarooAddress(database, "192.168.7.50:8734", 1_000);
    assert.equal(saveKarooAddress(database, saved, 2_000), saved);
  });

  it("refuses an invalid address without overwriting the good one", () => {
    const database = migrated();
    saveKarooAddress(database, "192.168.7.50", 1_000);
    assert.throws(() => saveKarooAddress(database, "   ", 2_000), /Enter the Karoo address/);
    assert.throws(() => saveKarooAddress(database, "https://192.168.7.50", 2_000), /must use http/);
    assert.equal(getSavedKarooAddress(database), "192.168.7.50:8734");
  });
});
