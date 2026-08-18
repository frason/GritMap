import type { SQLiteDatabase } from "expo-sqlite";
import type { SyncDatabase } from "./types.ts";

/**
 * Adapts a real expo-sqlite `SQLiteDatabase` to `SyncDatabase`. `exec`/`prepare().get/run/all`
 * go through expo-sqlite's one-shot `execSync`/`getFirstSync`/`runSync`/`getAllSync` —
 * documented convenience wrappers that prepare, execute, and finalize a native statement
 * internally, so no handle is ever held across calls in this path. `runMany` is the sole
 * exception: it holds one `prepareSync()` handle across the loop and explicitly finalizes it
 * in a `finally` block, so it releases the native statement even if a row throws mid-loop.
 */
export function toSyncDatabase(database: SQLiteDatabase): SyncDatabase {
  return {
    exec(sql) {
      database.execSync(sql);
    },
    prepare(sql) {
      return {
        get(...parameters) {
          return database.getFirstSync(sql, ...(parameters as never[]));
        },
        run(...parameters) {
          return database.runSync(sql, ...(parameters as never[]));
        },
        all(...parameters) {
          return database.getAllSync(sql, ...(parameters as never[]));
        },
      };
    },
    runMany(sql, paramsList) {
      const statement = database.prepareSync(sql);
      try {
        for (const parameters of paramsList) {
          statement.executeSync(parameters as never[]);
        }
      } finally {
        statement.finalizeSync();
      }
    },
  };
}
