import { DatabaseSync } from "node:sqlite";
import { toMigrationDatabase } from "./src/db/expoMigrationAdapter.ts";
import { applyMigrations } from "./src/db/migrations.ts";

// Duck-type a fake Expo SQLiteDatabase using node:sqlite under the hood,
// to prove toMigrationDatabase's exec/prepare(...).get(...) mapping onto
// execSync/getFirstSync actually works, without importing real expo-sqlite.
const real = new DatabaseSync(":memory:");
const fakeExpoDb = {
  execSync(sql) { real.exec(sql); },
  getFirstSync(sql, params = []) { return real.prepare(sql).get(...params); },
};

const migrationDb = toMigrationDatabase(fakeExpoDb);
applyMigrations(migrationDb);

const tables = real.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
console.log("tables:", tables);
console.log("user_version:", real.prepare("PRAGMA user_version").get());
console.log("foreign_keys:", real.prepare("PRAGMA foreign_keys").get());

// idempotency: reopen and reapply against same underlying db
applyMigrations(toMigrationDatabase(fakeExpoDb));
console.log("after re-apply user_version:", real.prepare("PRAGMA user_version").get());
