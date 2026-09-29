export interface GetActiveGoalDatabase {
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
  };
}

export interface ActiveGoal {
  segmentId: string;
  targetDurationMs: number;
}

interface StoredActiveGoal {
  segment_id: string;
  target_duration_ms: number;
}

/** Reads the single active-goal row, or undefined if no goal has been set (or its segment was deleted, cascading the goal with it). */
export function getActiveGoal(database: GetActiveGoalDatabase): ActiveGoal | undefined {
  const row = database
    .prepare("SELECT segment_id, target_duration_ms FROM active_goal WHERE id = 'singleton'")
    .get() as StoredActiveGoal | null | undefined;

  // expo-sqlite's real getFirstSync() returns null for "no row"; the node:sqlite test
  // double returns undefined for the same case -- both must be treated as not-found.
  if (row === undefined || row === null) return undefined;
  return { segmentId: row.segment_id, targetDurationMs: row.target_duration_ms };
}
