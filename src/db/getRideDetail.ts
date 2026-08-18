export interface GetRideDetailDatabase {
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
  };
}

export interface RideDetail {
  rideId: string;
  originalFilename: string;
  startTimestampMs?: number;
  durationMs?: number;
  totalDistanceMeters?: number;
  totalAscentMeters?: number;
  pointCount: number;
}

interface StoredRideDetail {
  ride_id: string;
  original_filename: string;
  start_timestamp_ms: number | null;
  duration_ms: number | null;
  total_distance_meters: number | null;
  total_ascent_meters: number | null;
  point_count: number;
}

/**
 * Reads one ride's detail for the Ride Detail screen. Segment/attempt info is deliberately
 * omitted -- segments aren't part of this increment (see docs/PLAN_first_ui_increment.md).
 */
export function getRideDetail(
  database: GetRideDetailDatabase,
  rideId: string,
): RideDetail | undefined {
  const row = database
    .prepare(
      `SELECT
        rides.id AS ride_id,
        imported_files.original_filename AS original_filename,
        rides.start_timestamp_ms,
        rides.duration_ms,
        rides.total_distance_meters,
        rides.total_ascent_meters,
        (SELECT count(*) FROM ride_points WHERE ride_points.ride_id = rides.id) AS point_count
      FROM rides
      JOIN imported_files ON imported_files.id = rides.imported_file_id
      WHERE rides.id = ?`,
    )
    .get(rideId) as StoredRideDetail | undefined;

  if (row === undefined) return undefined;

  return {
    rideId: row.ride_id,
    originalFilename: row.original_filename,
    pointCount: row.point_count,
    ...(row.start_timestamp_ms === null ? {} : { startTimestampMs: row.start_timestamp_ms }),
    ...(row.duration_ms === null ? {} : { durationMs: row.duration_ms }),
    ...(row.total_distance_meters === null
      ? {}
      : { totalDistanceMeters: row.total_distance_meters }),
    ...(row.total_ascent_meters === null ? {} : { totalAscentMeters: row.total_ascent_meters }),
  };
}
