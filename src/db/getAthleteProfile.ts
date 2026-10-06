export interface GetAthleteProfileDatabase {
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
  };
}

export interface AthleteProfile {
  ftpWatts?: number;
  maxHeartRateBpm?: number;
  weightKg?: number;
  /** Absent until a profile has ever been saved; starts at 1 and bumps whenever FTP, weight or max HR changes. */
  profileVersion?: number;
}

interface StoredAthleteProfile {
  ftp_watts: number | null;
  max_heart_rate_bpm: number | null;
  weight_kg: number | null;
  profile_version: number;
}

/** Reads the single athlete-profile row, or an all-absent profile if none was ever saved. */
export function getAthleteProfile(database: GetAthleteProfileDatabase): AthleteProfile {
  const row = database
    .prepare(
      "SELECT ftp_watts, max_heart_rate_bpm, weight_kg, profile_version FROM athlete_profile WHERE id = 'singleton'",
    )
    .get() as StoredAthleteProfile | null | undefined;

  // expo-sqlite's real getFirstSync() returns null for "no row"; the node:sqlite test
  // double returns undefined for the same case -- both must be treated as not-found.
  if (row === undefined || row === null) return {};

  return {
    profileVersion: row.profile_version,
    ...(row.ftp_watts !== null ? { ftpWatts: row.ftp_watts } : {}),
    ...(row.max_heart_rate_bpm !== null ? { maxHeartRateBpm: row.max_heart_rate_bpm } : {}),
    ...(row.weight_kg !== null ? { weightKg: row.weight_kg } : {}),
  };
}
