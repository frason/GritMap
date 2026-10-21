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
   * The optional long-term goal. Omit it to leave an existing one as it is (it is dropped when the goal moves to a
   * different segment); pass null to remove it.
   */
  longTermDurationMs?: number | null;
  nowMs: number;
}

/** Upserts the single active-goal row. The FK to segments(id) enforces that segmentId is real. */
export function setActiveGoal(database: SetActiveGoalDatabase, params: SetActiveGoalParams): void {
  if (!Number.isFinite(params.targetDurationMs) || params.targetDurationMs <= 0) {
    throw new Error("targetDurationMs must be a positive finite number");
  }
  const longTerm = params.longTermDurationMs;
  if (longTerm !== undefined && longTerm !== null && (!Number.isFinite(longTerm) || longTerm <= 0)) {
    throw new Error("longTermDurationMs must be a positive finite number");
  }

  // The long-term goal belongs to one segment: it survives a re-save on the same segment, and is cleared when the goal moves.
  database
    .prepare(
      `INSERT INTO active_goal (id, segment_id, target_duration_ms, long_term_duration_ms, updated_at_ms)
       VALUES ('singleton', ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         long_term_duration_ms = CASE
           WHEN ? = 1 THEN excluded.long_term_duration_ms
           WHEN active_goal.segment_id = excluded.segment_id THEN active_goal.long_term_duration_ms
           ELSE NULL
         END,
         segment_id = excluded.segment_id,
         target_duration_ms = excluded.target_duration_ms,
         updated_at_ms = excluded.updated_at_ms`,
    )
    .run(params.segmentId, params.targetDurationMs, longTerm ?? null, params.nowMs, longTerm === undefined ? 0 : 1);
}
