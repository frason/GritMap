export interface SetActiveGoalDatabase {
  prepare(sql: string): {
    run(...parameters: unknown[]): unknown;
  };
}

export interface SetActiveGoalParams {
  segmentId: string;
  targetDurationMs: number;
  nowMs: number;
}

/** Upserts the single active-goal row. The FK to segments(id) enforces that segmentId is real. */
export function setActiveGoal(database: SetActiveGoalDatabase, params: SetActiveGoalParams): void {
  if (!Number.isFinite(params.targetDurationMs) || params.targetDurationMs <= 0) {
    throw new Error("targetDurationMs must be a positive finite number");
  }

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
