import type { SQLiteDatabase } from "expo-sqlite";

import {
  closeDatabaseConnection,
  DEFAULT_DATABASE_NAME,
  getDatabaseConnection,
} from "./connection";
import { toMigrationDatabase } from "./expoMigrationAdapter";
import { applyMigrations } from "./migrations";

/**
 * Opens (or reuses) the on-device Expo SQLite connection, verifies
 * foreign-key enforcement, and applies any pending migrations.
 *
 * `applyMigrations` only runs migrations whose version is greater than the
 * database's current `PRAGMA user_version`, so calling this function
 * repeatedly (e.g. on every app launch) is idempotent: a fully migrated
 * database is left untouched.
 *
 * If migration fails, the cached connection is closed and forgotten so a
 * later call reopens a fresh handle instead of reusing a connection that
 * may be left mid-migration. `applyMigrations` itself wraps each migration
 * in `BEGIN IMMEDIATE`/`ROLLBACK`, so the on-disk schema itself cannot be
 * left partially applied by a single failed migration.
 */
export function bootstrapDatabase(
  databaseName: string = DEFAULT_DATABASE_NAME,
): SQLiteDatabase {
  const database = getDatabaseConnection(databaseName);
  try {
    applyMigrations(toMigrationDatabase(database));
  } catch (error) {
    closeDatabaseConnection(databaseName);
    throw error;
  }
  return database;
}
