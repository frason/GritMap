export interface SetActiveGoalDatabase {
  prepare(sql: string): {
    run(...parameters: unknown[]): unknown;
  };
}

export interface SetActiveGoalParams {
  segmentId: string;
  /** The goal to work towards now (the "next" goal when a long-term goal is also set). */
  targetDurationMs: number;
  /**
   * The optional long-term goal. Omit it to leave the segment's existing one as it is; pass null to remove it.
   */
  longTermDurationMs?: number | null;
  nowMs: number;
}

function validate(params: SetActiveGoalParams): void {
  if (!Number.isFinite(params.targetDurationMs) || params.targetDurationMs <= 0) {
    throw new Error("targetDurationMs must be a positive finite number");
  }
  const longTerm = params.longTermDurationMs;
  if (longTerm !== undefined && longTerm !== null && (!Number.isFinite(longTerm) || longTerm <= 0)) {
    throw new Error("longTermDurationMs must be a positive finite number");
  }
}

/**
 * Saves the goal on one segment. Each segment keeps its own goal, so this never touches another segment's. The FK to
 * segments(id) enforces that segmentId is real. If no segment is Home's headline yet, this one becomes it.
 */
export function setSegmentGoal(database: SetActiveGoalDatabase, params: SetActiveGoalParams): void {
  validate(params);
  const longTerm = params.longTermDurationMs;
  database
    .prepare(
      `INSERT INTO segment_goals (segment_id, target_duration_ms, long_term_duration_ms, updated_at_ms)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (segment_id) DO UPDATE SET
         long_term_duration_ms = CASE WHEN ? = 1 THEN excluded.long_term_duration_ms ELSE segment_goals.long_term_duration_ms END,
         target_duration_ms = excluded.target_duration_ms,
         updated_at_ms = excluded.updated_at_ms`,
    )
    .run(params.segmentId, params.targetDurationMs, longTerm ?? null, params.nowMs, longTerm === undefined ? 0 : 1);

  database
    .prepare(
      `INSERT INTO active_goal (id, segment_id, target_duration_ms, updated_at_ms)
       SELECT 'singleton', ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM active_goal)`,
    )
    .run(params.segmentId, params.targetDurationMs, params.nowMs);
}

/** Saves the goal on a segment and makes it Home's headline. */
export function setActiveGoal(database: SetActiveGoalDatabase, params: SetActiveGoalParams): void {
  setSegmentGoal(database, params);
  database
    .prepare(
      `INSERT INTO active_goal (id, segment_id, target_duration_ms, updated_at_ms)
       VALUES ('singleton', ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         segment_id = excluded.segment_id,
         target_duration_ms = excluded.target_duration_ms,
         updated_at_ms = excluded.updated_at_ms`,
    )
    .run(params.segmentId, params.targetDurationMs, params.nowMs);
}
