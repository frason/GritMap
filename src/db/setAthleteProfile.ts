export interface SetAthleteProfileDatabase {
  prepare(sql: string): {
    run(...parameters: unknown[]): unknown;
  };
}

export interface SetAthleteProfileParams {
  ftpWatts?: number;
  maxHeartRateBpm?: number;
  nowMs: number;
}

/**
 * Upserts the single athlete-profile row. Either threshold may be omitted (stored as NULL),
 * since zones simply don't display until the corresponding value is set.
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

  database
    .prepare(
      `INSERT INTO athlete_profile (id, ftp_watts, max_heart_rate_bpm, updated_at_ms)
       VALUES ('singleton', ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         ftp_watts = excluded.ftp_watts,
         max_heart_rate_bpm = excluded.max_heart_rate_bpm,
         updated_at_ms = excluded.updated_at_ms`,
    )
    .run(params.ftpWatts ?? null, params.maxHeartRateBpm ?? null, params.nowMs);
}
