import { closeDatabaseConnection, getDatabaseConnection } from "./connection.ts";
import { applyMigrations } from "./migrations.ts";
import { toSyncDatabase } from "./toSyncDatabase.ts";
import type { SyncDatabase } from "./types.ts";

/**
 * Opens (or reuses) the named on-device database, adapts it, and brings it up to the latest
 * schema version. On any failure, evicts the cached connection first so a poisoned handle
 * mid-transaction never survives a retry -- the next call reopens cleanly instead of reusing
 * a broken cached connection.
 */
export function initializeDatabase(databaseName?: string): SyncDatabase {
  const database = toSyncDatabase(getDatabaseConnection(databaseName));
  try {
    applyMigrations(database);
  } catch (error) {
    closeDatabaseConnection(databaseName);
    throw error;
  }
  return database;
}
