import { getDatabaseConnection } from "./connection.ts";
import { applyMigrations } from "./migrations.ts";
import { toSyncDatabase } from "./toSyncDatabase.ts";
import type { SyncDatabase } from "./types.ts";

/** Opens the on-device database, adapts it, and brings it up to the latest schema version. */
export function initializeDatabase(): SyncDatabase {
  const database = toSyncDatabase(getDatabaseConnection());
  applyMigrations(database);
  return database;
}
