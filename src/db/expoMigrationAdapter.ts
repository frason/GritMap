import type { SQLiteDatabase } from "expo-sqlite";

import type { MigrationDatabase } from "./migrations";

/**
 * Adapts an Expo SQLite connection to the small `MigrationDatabase`
 * interface that `applyMigrations` (src/db/migrations.ts) already targets
 * and that the Node `node:sqlite` test suite exercises directly.
 *
 * This intentionally does not duplicate or rewrite any migration SQL: it
 * only maps `exec`/`prepare(...).get(...)` onto Expo's synchronous
 * `execSync`/`getFirstSync` primitives so the exact same migration SQL runs
 * unchanged on-device.
 */
export function toMigrationDatabase(database: SQLiteDatabase): MigrationDatabase {
  return {
    exec(sql: string): void {
      database.execSync(sql);
    },
    prepare(sql: string) {
      return {
        get(...parameters: unknown[]): unknown {
          return database.getFirstSync(sql, parameters as never[]);
        },
      };
    },
  };
}
