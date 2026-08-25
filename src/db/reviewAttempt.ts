export interface ReviewAttemptDatabase {
  prepare(sql: string): {
    run(...parameters: unknown[]): unknown;
  };
}

/**
 * Confirms a borderline (or already-accepted) candidate: it now participates normally and
 * carries a `manuallyApproved` marker that later automatic rescans must never overwrite
 * (see persistMatchCandidate.ts's own handling of `manually_approved`).
 */
export function confirmAttempt(database: ReviewAttemptDatabase, attemptId: string): void {
  database
    .prepare(
      `UPDATE segment_attempts SET decision = 'accept', manually_approved = 1 WHERE id = ?`,
    )
    .run(attemptId);
}

/**
 * Rejects a candidate: per docs/MVP.md's review model, a rejected candidate "creates no
 * segment-attempt relationship" -- deleting the row is the same removal
 * persistMatchCandidate.ts already performs when a newer automatic rescan rejects an
 * attempt, cascading match_diagnostics with it (no independent ride_id link exists to keep
 * diagnostics around once their attempt is gone).
 */
export function rejectAttempt(database: ReviewAttemptDatabase, attemptId: string): void {
  database.prepare(`DELETE FROM segment_attempts WHERE id = ?`).run(attemptId);
}
