/**
 * A superset of `MigrationDatabase` (migrations.ts) and `MatchPersistenceDatabase`
 * (persistMatchCandidate.ts)'s narrower local interfaces — structurally assignable to both.
 * `prepare(sql)` is one-shot per call (no statement handle held across calls); `runMany` is
 * the one bulk-write escape hatch that does hold a native statement across a loop, used only
 * for inserting many `ride_points` rows at once.
 */
export interface SyncDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
    run(...parameters: unknown[]): unknown;
    all(...parameters: unknown[]): unknown[];
  };
  /** Runs `sql` once per entry in `paramsList` inside a single prepared statement. */
  runMany(sql: string, paramsList: readonly unknown[][]): void;
}
