export interface ListRidesDatabase {
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
  };
}

export interface RideSummary {
  rideId: string;
  originalFilename: string;
  startTimestampMs?: number;
  durationMs?: number;
  totalDistanceMeters?: number;
}

interface StoredRideSummary {
  ride_id: string;
  original_filename: string;
  start_timestamp_ms: number | null;
  duration_ms: number | null;
  total_distance_meters: number | null;
}

/**
 * Lists every ride, newest first, for the Ride List screen. Reads the v3 summary columns
 * (populated once at import time by persistImportedRide.ts) directly -- no per-row
 * aggregation over ride_points at read time.
 */
export function listRides(database: ListRidesDatabase): RideSummary[] {
  const rows = database
    .prepare(
      `SELECT
        rides.id AS ride_id,
        imported_files.original_filename AS original_filename,
        rides.start_timestamp_ms,
        rides.duration_ms,
        rides.total_distance_meters
      FROM rides
      JOIN imported_files ON imported_files.id = rides.imported_file_id
      ORDER BY rides.start_timestamp_ms DESC, rides.id DESC`,
    )
    .all() as StoredRideSummary[];

  return rows.map((row) => ({
    rideId: row.ride_id,
    originalFilename: row.original_filename,
    ...(row.start_timestamp_ms === null ? {} : { startTimestampMs: row.start_timestamp_ms }),
    ...(row.duration_ms === null ? {} : { durationMs: row.duration_ms }),
    ...(row.total_distance_meters === null
      ? {}
      : { totalDistanceMeters: row.total_distance_meters }),
  }));
}
