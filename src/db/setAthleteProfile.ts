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
         updated_at_ms = excluded.updated_at_ms`,
    )
    .run(params.ftpWatts ?? null, params.maxHeartRateBpm ?? null, params.weightKg ?? null, params.nowMs);
}
