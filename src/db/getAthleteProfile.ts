export interface GetAthleteProfileDatabase {
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
  };
}

export interface AthleteProfile {
  ftpWatts?: number;
  maxHeartRateBpm?: number;
}

interface StoredAthleteProfile {
  ftp_watts: number | null;
  max_heart_rate_bpm: number | null;
}

/** Reads the single athlete-profile row, or an all-absent profile if none was ever saved. */
export function getAthleteProfile(database: GetAthleteProfileDatabase): AthleteProfile {
  const row = database
    .prepare("SELECT ftp_watts, max_heart_rate_bpm FROM athlete_profile WHERE id = 'singleton'")
    .get() as StoredAthleteProfile | undefined;

  if (row === undefined) return {};

  return {
    ...(row.ftp_watts !== null ? { ftpWatts: row.ftp_watts } : {}),
    ...(row.max_heart_rate_bpm !== null ? { maxHeartRateBpm: row.max_heart_rate_bpm } : {}),
  };
}
