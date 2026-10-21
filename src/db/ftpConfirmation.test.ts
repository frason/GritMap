import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { confirmFtp, FTP_CONFIRMED_KEY, isFtpConfirmed } from "./ftpConfirmation.ts";

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at_ms INTEGER NOT NULL) STRICT;");
  return db;
}

describe("ftpConfirmation", () => {
  it("is false until the rider confirms an FTP, then true", () => {
    const db = database();
    assert.equal(isFtpConfirmed(db), false);
    confirmFtp(db, 1_000);
    assert.equal(isFtpConfirmed(db), true);
    assert.equal((db.prepare("SELECT value FROM app_settings WHERE key = ?").get(FTP_CONFIRMED_KEY) as { value: string }).value, "1000");
  });

  it("confirming again keeps it confirmed", () => {
    const db = database();
    confirmFtp(db, 1);
    confirmFtp(db, 2);
    assert.equal(isFtpConfirmed(db), true);
  });
});
