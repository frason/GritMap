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
  /** When this goal was last saved: a send older than this left the Karoo with an out-of-date plan. */
  updatedAtMs?: number;
}

interface StoredGoal {
  segment_id: string;
  target_duration_ms: number;
  long_term_duration_ms: number | null;
  updated_at_ms: number;
}

function toGoal(row: StoredGoal): ActiveGoal {
  return {
    segmentId: row.segment_id,
    targetDurationMs: row.target_duration_ms,
    ...(row.long_term_duration_ms === null || row.long_term_duration_ms === undefined ? {} : { longTermDurationMs: row.long_term_duration_ms }),
    ...(row.updated_at_ms === null || row.updated_at_ms === undefined ? {} : { updatedAtMs: row.updated_at_ms }),
  };
}

const GOAL_COLUMNS = "segment_id, target_duration_ms, long_term_duration_ms, updated_at_ms";

/**
 * The goal on this one segment, or undefined if it has none. Every segment can hold its own goal
 * (segment_goals); a goal never follows the rider from one segment to another.
 */
export function getSegmentGoal(database: GetActiveGoalDatabase, segmentId: string): ActiveGoal | undefined {
  const row = database.prepare(`SELECT ${GOAL_COLUMNS} FROM segment_goals WHERE segment_id = ?`).get(segmentId) as StoredGoal | null | undefined;
  // expo-sqlite's real getFirstSync() returns null for "no row"; the node:sqlite test
  // double returns undefined for the same case -- both must be treated as not-found.
  if (row === undefined || row === null) return undefined;
  return toGoal(row);
}

/**
 * The goal Home leads with: the segment the rider picked as the headline (the active_goal pointer), or, when none
 * is picked (or its segment was deleted), the most recently saved goal. Undefined if no segment has a goal.
 */
export function getActiveGoal(database: GetActiveGoalDatabase): ActiveGoal | undefined {
  const row = database
    .prepare(
      `SELECT ${GOAL_COLUMNS} FROM segment_goals
       ORDER BY (segment_id = COALESCE((SELECT segment_id FROM active_goal WHERE id = 'singleton'), '')) DESC,
                updated_at_ms DESC, segment_id
       LIMIT 1`,
    )
    .get() as StoredGoal | null | undefined;
  if (row === undefined || row === null) return undefined;
  return toGoal(row);
}

export interface ListGoalsDatabase {
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
  };
}

/** Every segment's goal, most recently saved first. */
export function listSegmentGoals(database: ListGoalsDatabase): ActiveGoal[] {
  const rows = database
    .prepare(`SELECT ${GOAL_COLUMNS} FROM segment_goals ORDER BY updated_at_ms DESC, segment_id`)
    .all() as StoredGoal[];
  return rows.map(toGoal);
}
