export interface GetRideTrackDatabase {
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
  };
}

export interface RideTrackPoint {
  pointIndex: number;
  timestampMs: number;
  lat: number;
  lng: number;
  distanceMeters?: number;
  elevationMeters?: number;
}

interface StoredRideTrackPoint {
  point_index: number;
  timestamp_ms: number;
  latitude: number;
  longitude: number;
  distance_meters: number | null;
  elevation_meters: number | null;
}

/**
 * Reads one ride's GPS-present track points in `point_index` order, for map rendering
 * (issue #6) and segment range selection (issue #7). Points without GPS are excluded --
 * `docs/PLAN_segment_definition_increment.md`'s gap-handling logic (consumers of this
 * function) uses `timestampMs` gaps between consecutive *returned* points to detect and
 * render real GPS gaps, so silently including null-lat/lng rows here would corrupt that.
 */
export function getRideTrack(database: GetRideTrackDatabase, rideId: string): RideTrackPoint[] {
  const rows = database
    .prepare(
      `SELECT
        point_index,
        timestamp_ms,
        latitude,
        longitude,
        distance_meters,
        elevation_meters
      FROM ride_points
      WHERE ride_id = ? AND latitude IS NOT NULL
      ORDER BY point_index`,
    )
    .all(rideId) as StoredRideTrackPoint[];

  return rows.map((row) => ({
    pointIndex: row.point_index,
    timestampMs: row.timestamp_ms,
    lat: row.latitude,
    lng: row.longitude,
    ...(row.distance_meters === null ? {} : { distanceMeters: row.distance_meters }),
    ...(row.elevation_meters === null ? {} : { elevationMeters: row.elevation_meters }),
  }));
}
