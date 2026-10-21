export interface SetAthleteProfileDatabase {
  prepare(sql: string): {
    run(...parameters: unknown[]): unknown;
  };
}

export interface SetAthleteProfileParams {
  ftpWatts?: number;
  maxHeartRateBpm?: number;
  weightKg?: number;
  nowMs: number;
}

/**
 * Upserts the single athlete-profile row. Any field may be omitted (stored as NULL) --
 * zones simply don't display until the corresponding threshold is set, and the pacing-plan
 * send action prompts for weight the same way. weightKg is manually entered for now; it's
 * the same field a future HealthKit/Health Connect sync would keep current, not a separate
 * one, so callers don't need to change when that lands.
 *
 * `profile_version` (migration v10) is bumped in the same statement, and only when FTP, weight
 * or max HR actually changes -- so re-saving identical values, or a no-op edit, never makes
 * plans built against the profile look outdated. SQLite evaluates every right-hand side in
 * `DO UPDATE SET` against the row as it was before the update, and `IS` compares NULLs equal.
 */
export function setAthleteProfile(
  database: SetAthleteProfileDatabase,
  params: SetAthleteProfileParams,
): void {
  if (params.ftpWatts !== undefined && (!Number.isFinite(params.ftpWatts) || params.ftpWatts <= 0)) {
    throw new Error("ftpWatts must be a positive finite number");
  }
  if (
    params.maxHeartRateBpm !== undefined &&
    (!Number.isFinite(params.maxHeartRateBpm) || params.maxHeartRateBpm <= 0)
  ) {
    throw new Error("maxHeartRateBpm must be a positive finite number");
  }
  if (params.weightKg !== undefined && (!Number.isFinite(params.weightKg) || params.weightKg <= 0)) {
    throw new Error("weightKg must be a positive finite number");
  }

  database
    .prepare(
      `INSERT INTO athlete_profile (id, ftp_watts, max_heart_rate_bpm, weight_kg, updated_at_ms)
       VALUES ('singleton', ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         ftp_watts = excluded.ftp_watts,
         max_heart_rate_bpm = excluded.max_heart_rate_bpm,
         weight_kg = excluded.weight_kg,
         profile_version = CASE
           WHEN athlete_profile.ftp_watts IS excluded.ftp_watts
            AND athlete_profile.max_heart_rate_bpm IS excluded.max_heart_rate_bpm
            AND athlete_profile.weight_kg IS excluded.weight_kg
           THEN athlete_profile.profile_version
           ELSE athlete_profile.profile_version + 1
         END,
         updated_at_ms = excluded.updated_at_ms`,
    )
    .run(params.ftpWatts ?? null, params.maxHeartRateBpm ?? null, params.weightKg ?? null, params.nowMs);

  // Keep a dated history of what the profile was, so a past effort can be judged at the weight the rider had then.
  // A row is added only when FTP, weight or max HR differs from the latest saved one (a back-dated entry never counts).
  database
    .prepare(
      `INSERT INTO athlete_profile_history (effective_from_ms, ftp_watts, weight_kg, max_heart_rate_bpm, source, recorded_at_ms)
       SELECT ?, ?, ?, ?, 'profile', ?
       WHERE NOT EXISTS (
         SELECT 1 FROM (
           SELECT ftp_watts, weight_kg, max_heart_rate_bpm FROM athlete_profile_history
           WHERE source <> 'backdated' ORDER BY effective_from_ms DESC, id DESC LIMIT 1
         ) AS latest
         WHERE latest.ftp_watts IS ? AND latest.weight_kg IS ? AND latest.max_heart_rate_bpm IS ?
       )`,
    )
    .run(
      params.nowMs,
      params.ftpWatts ?? null,
      params.weightKg ?? null,
      params.maxHeartRateBpm ?? null,
      params.nowMs,
      params.ftpWatts ?? null,
      params.weightKg ?? null,
      params.maxHeartRateBpm ?? null,
    );
}
