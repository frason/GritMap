import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "../db/migrations.ts";
import { isOnboardingComplete, markOnboardingComplete, resolveOnboarding } from "./onboardingState.ts";

function migrated(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  return database;
}

describe("resolveOnboarding", () => {
  it("shows onboarding on a brand-new empty install, and does not mark it complete yet", () => {
    const database = migrated();
    assert.equal(resolveOnboarding(database, 1_000), "show");
    assert.equal(isOnboardingComplete(database), false);
  });

  it("keeps showing it until the rider finishes, then never again", () => {
    const database = migrated();
    assert.equal(resolveOnboarding(database, 1_000), "show");
    assert.equal(resolveOnboarding(database, 2_000), "show");
    markOnboardingComplete(database, 3_000);
    assert.equal(isOnboardingComplete(database), true);
    assert.equal(resolveOnboarding(database, 4_000), "skip");
  });

  it("skips, and remembers, for an existing install that already has a saved FTP", () => {
    const database = migrated();
    database.prepare("INSERT INTO athlete_profile (id, ftp_watts, updated_at_ms) VALUES ('singleton', 250, 1)").run();
    assert.equal(resolveOnboarding(database, 5_000), "skip");
    assert.equal(isOnboardingComplete(database), true);
  });

  it("skips for an install that already has a segment or a ride", () => {
    const withSegment = migrated();
    withSegment
      .prepare("INSERT INTO segments (id, name, corridor_meters, required_coverage, schema_version, fingerprint, created_at_ms) VALUES ('s', 'S', 30, 0.9, 1, 'fp', 1)")
      .run();
    assert.equal(resolveOnboarding(withSegment, 5_000), "skip");

    const withRide = migrated();
    withRide.prepare("INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms) VALUES ('f', ?, 'a.fit', 1)").run("a".repeat(64));
    withRide
      .prepare("INSERT INTO rides (id, imported_file_id, parser_version, created_at_ms, updated_at_ms) VALUES ('r', 'f', 1, 1, 1)")
      .run();
    assert.equal(resolveOnboarding(withRide, 5_000), "skip");
  });

  it("an empty profile row (no FTP) does not count as an existing install", () => {
    const database = migrated();
    database.prepare("INSERT INTO athlete_profile (id, updated_at_ms) VALUES ('singleton', 1)").run();
    assert.equal(resolveOnboarding(database, 5_000), "show");
  });

  it("treats expo-sqlite's null for 'no row' like node:sqlite's undefined", () => {
    const fake = {
      prepare: (sql: string) => ({ get: () => (sql.includes("app_settings") ? null : null), run: () => undefined }),
    };
    assert.equal(resolveOnboarding(fake, 1), "show");
  });
});
