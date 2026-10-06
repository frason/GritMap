export interface AppSettingsDatabase {
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
    run(...parameters: unknown[]): unknown;
  };
}

/** Reads one device-local setting, or undefined when it was never saved. */
export function getAppSetting(database: AppSettingsDatabase, key: string): string | undefined {
  const row = database.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
    | { value: string }
    | null
    | undefined;
  // expo-sqlite's getFirstSync() returns null for "no row"; node:sqlite returns undefined.
  return row === undefined || row === null ? undefined : row.value;
}

export function setAppSetting(database: AppSettingsDatabase, key: string, value: string, nowMs: number): void {
  database
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at_ms) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at_ms = excluded.updated_at_ms`,
    )
    .run(key, value, nowMs);
}
