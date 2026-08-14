import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

/** Default on-device database filename. */
export const DEFAULT_DATABASE_NAME = "gritmap.db";

const openConnections = new Map<string, SQLiteDatabase>();

/**
 * Opens (or returns an already-open) SQLite connection with foreign-key
 * enforcement turned on. Connections are cached per database name so that
 * repeated calls reuse the same underlying handle instead of opening a new
 * one every time.
 *
 * This module only opens the connection and enforces `PRAGMA foreign_keys`;
 * it does not create any tables. Schema creation/migrations are handled
 * separately (see src/db/migrations.ts).
 */
export function getDatabaseConnection(
  databaseName: string = DEFAULT_DATABASE_NAME,
): SQLiteDatabase {
  const cached = openConnections.get(databaseName);
  if (cached) return cached;

  const database = openDatabaseSync(databaseName);
  enableForeignKeys(database);
  openConnections.set(databaseName, database);
  return database;
}

/** Enables and verifies SQLite foreign-key constraint enforcement. */
export function enableForeignKeys(database: SQLiteDatabase): void {
  database.execSync("PRAGMA foreign_keys = ON");
  const row = database.getFirstSync<{ foreign_keys: number }>(
    "PRAGMA foreign_keys",
  );
  if (Number(row?.foreign_keys) !== 1) {
    throw new Error("SQLite foreign-key enforcement could not be enabled");
  }
}

/** Closes and forgets a cached connection, if one is open. Mainly for tests. */
export function closeDatabaseConnection(
  databaseName: string = DEFAULT_DATABASE_NAME,
): void {
  const database = openConnections.get(databaseName);
  if (!database) return;
  database.closeSync();
  openConnections.delete(databaseName);
}
