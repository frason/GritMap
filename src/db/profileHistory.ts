export interface ProfileHistoryReadDatabase {
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
  };
}

export interface ProfileHistoryDatabase {
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
    run(...parameters: unknown[]): unknown;
  };
}

export interface ProfileHistoryEntry {
  id: number;
  /** When these values took effect (for a rider-entered past weight, the date they gave). */
  effectiveFromMs: number;
  ftpWatts?: number;
  weightKg?: number;
  maxHeartRateBpm?: number;
  /** 'profile': saved in the Profile screen. 'backdated': a weight the rider entered for a past date. 'backfill': the profile as it stood when history began. */
  source: "profile" | "backdated" | "backfill";
}

interface StoredProfileHistory {
  id: number;
  effective_from_ms: number;
  ftp_watts: number | null;
  weight_kg: number | null;
  max_heart_rate_bpm: number | null;
  source: ProfileHistoryEntry["source"];
}

/** Every history row, oldest effective date first. */
export function listProfileHistory(database: ProfileHistoryReadDatabase): ProfileHistoryEntry[] {
  const rows = database
    .prepare(
      `SELECT id, effective_from_ms, ftp_watts, weight_kg, max_heart_rate_bpm, source
       FROM athlete_profile_history ORDER BY effective_from_ms, id`,
    )
    .all() as StoredProfileHistory[];
  return rows.map((row) => ({
    id: row.id,
    effectiveFromMs: row.effective_from_ms,
    source: row.source,
    ...(row.ftp_watts === null ? {} : { ftpWatts: row.ftp_watts }),
    ...(row.weight_kg === null ? {} : { weightKg: row.weight_kg }),
    ...(row.max_heart_rate_bpm === null ? {} : { maxHeartRateBpm: row.max_heart_rate_bpm }),
  }));
}

/**
 * The rider's weight (kg) at a moment: the latest row at or before it that has a weight, or, for a moment before the earliest
 * row, the earliest row's weight. Undefined when no row has a weight. `entries` must be oldest first (listProfileHistory).
 */
export function weightAtFromEntries(entries: readonly ProfileHistoryEntry[], timestampMs: number): number | undefined {
  const withWeight = entries.filter((entry) => entry.weightKg !== undefined);
  if (withWeight.length === 0) return undefined;
  let found: ProfileHistoryEntry | undefined;
  for (const entry of withWeight) {
    if (entry.effectiveFromMs <= timestampMs) found = entry;
    else break;
  }
  return (found ?? withWeight[0]!).weightKg;
}

/** A `weightAt` function for the calibration loaders, or undefined when there is no weight history. */
export function createWeightAt(database: ProfileHistoryReadDatabase): ((timestampMs: number) => number | undefined) | undefined {
  const entries = listProfileHistory(database);
  if (!entries.some((entry) => entry.weightKg !== undefined)) return undefined;
  return (timestampMs) => weightAtFromEntries(entries, timestampMs);
}

/** Records a weight for a past date (for example the weight on the day of a personal best). It does not change the current profile. */
export function addBackdatedWeight(
  database: ProfileHistoryDatabase,
  params: { effectiveFromMs: number; weightKg: number; nowMs: number },
): void {
  if (!Number.isFinite(params.weightKg) || params.weightKg <= 0) throw new Error("weightKg must be a positive finite number");
  if (!Number.isFinite(params.effectiveFromMs) || params.effectiveFromMs <= 0) throw new Error("effectiveFromMs must be a positive timestamp");
  if (params.effectiveFromMs > params.nowMs) throw new Error("A past weight cannot be dated in the future");
  database
    .prepare(
      `INSERT INTO athlete_profile_history (effective_from_ms, ftp_watts, weight_kg, max_heart_rate_bpm, source, recorded_at_ms)
       VALUES (?, NULL, ?, NULL, 'backdated', ?)`,
    )
    .run(params.effectiveFromMs, params.weightKg, params.nowMs);
}

/** Removes a rider-entered past weight. Rows saved from the Profile screen cannot be removed this way. */
export function removeBackdatedWeight(database: ProfileHistoryDatabase, id: number): void {
  database.prepare("DELETE FROM athlete_profile_history WHERE id = ? AND source = 'backdated'").run(id);
}
