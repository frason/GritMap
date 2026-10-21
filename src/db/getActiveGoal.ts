export interface GetActiveGoalDatabase {
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
  };
}

export interface ActiveGoal {
  segmentId: string;
  /** The goal the rider is working towards now: plans, the Karoo send and notices use it. */
  targetDurationMs: number;
  /** An optional, more ambitious goal on the same segment; drives only a progress line. */
  longTermDurationMs?: number;
}

interface StoredActiveGoal {
  segment_id: string;
  target_duration_ms: number;
  long_term_duration_ms: number | null;
}

/** Reads the single active-goal row, or undefined if no goal has been set (or its segment was deleted, cascading the goal with it). */
export function getActiveGoal(database: GetActiveGoalDatabase): ActiveGoal | undefined {
  const row = database
    .prepare("SELECT segment_id, target_duration_ms, long_term_duration_ms FROM active_goal WHERE id = 'singleton'")
    .get() as StoredActiveGoal | null | undefined;

  // expo-sqlite's real getFirstSync() returns null for "no row"; the node:sqlite test
  // double returns undefined for the same case -- both must be treated as not-found.
  if (row === undefined || row === null) return undefined;
  return {
    segmentId: row.segment_id,
    targetDurationMs: row.target_duration_ms,
    ...(row.long_term_duration_ms === null || row.long_term_duration_ms === undefined ? {} : { longTermDurationMs: row.long_term_duration_ms }),
  };
}
