export interface GetAttemptTrackDatabase {
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
  };
}

export interface AttemptTrackPoint {
  /** Cumulative distance from the attempt's own start point (zeroed at start_point_index). */
  distanceMeters: number;
  timestampMs: number;
  power?: number;
  heartRate?: number;
  elevationMeters?: number;
}

interface StoredAttemptTrackPoint {
  timestamp_ms: number;
  distance_meters: number;
  power_watts: number | null;
  heart_rate_bpm: number | null;
  elevation_meters: number | null;
}

/**
 * Reads one attempt's ride_points slice, re-based so distanceMeters starts at 0 at the
 * attempt's own start_point_index -- compareAttempts.ts (issue #12) resamples on a shared
 * distance-from-segment-start axis, not the ride's own cumulative distance. Rows with no
 * distance sample are excluded (they can't be placed on that axis at all); this mirrors
 * getRideTrack.ts's SQL-level filtering, not getMatcherRidePoints.ts's preserve-everything
 * approach -- nothing here needs array-position-equals-point_index identity.
 */
export function getAttemptTrack(
  database: GetAttemptTrackDatabase,
  rideId: string,
  startPointIndex: number,
  endPointIndex: number,
): AttemptTrackPoint[] {
  const rows = database
    .prepare(
      `SELECT timestamp_ms, distance_meters, power_watts, heart_rate_bpm, elevation_meters
       FROM ride_points
       WHERE ride_id = ? AND point_index >= ? AND point_index <= ? AND distance_meters IS NOT NULL
       ORDER BY point_index`,
    )
    .all(rideId, startPointIndex, endPointIndex) as StoredAttemptTrackPoint[];

  if (rows.length === 0) return [];
  const baseDistanceMeters = rows[0].distance_meters;

  return rows.map((row) => ({
    distanceMeters: row.distance_meters - baseDistanceMeters,
    timestampMs: row.timestamp_ms,
    ...(row.power_watts === null ? {} : { power: row.power_watts }),
    ...(row.heart_rate_bpm === null ? {} : { heartRate: row.heart_rate_bpm }),
    ...(row.elevation_meters === null ? {} : { elevationMeters: row.elevation_meters }),
  }));
}
