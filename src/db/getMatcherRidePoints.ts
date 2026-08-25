import type { SourcePoint } from "../matcher/toMatcherRidePoints.ts";

export interface GetMatcherRidePointsDatabase {
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
  };
}

interface StoredMatcherPoint {
  timestamp_ms: number;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Reads every ride_points row for a ride, in point_index order, including rows with no GPS
 * fix. toMatcherRidePoints relies on this exact ordering -- array position equals
 * point_index -- to recover each kept point's original point_index (see its own doc
 * comment). Do not filter here; getRideTrack.ts already filters at the SQL level for map
 * rendering, which is exactly why it isn't reused for this purpose.
 */
export function getMatcherRidePoints(
  database: GetMatcherRidePointsDatabase,
  rideId: string,
): SourcePoint[] {
  const rows = database
    .prepare(
      `SELECT timestamp_ms, latitude, longitude
       FROM ride_points
       WHERE ride_id = ?
       ORDER BY point_index`,
    )
    .all(rideId) as StoredMatcherPoint[];

  return rows.map((row) => ({
    timestampMs: row.timestamp_ms,
    ...(row.latitude === null || row.longitude === null
      ? {}
      : { lat: row.latitude, lng: row.longitude }),
  }));
}
