import type { SyncDatabase } from "../db/types.ts";
import { thinCourse, type PreviewPoint } from "./segmentListView.ts";

const POINTS_PER_SEGMENT_LINE = 16;

interface StoredPoint {
  latitude: number;
  longitude: number;
}

/**
 * The stretches of a ride that are segment efforts, as short polylines for the ride card's route preview. Taken from
 * the ride's own GPS points between each counted effort's start and end index, so they sit exactly on the route line
 * drawn under them. One bounded query per effort, only the points inside it. Efforts with fewer than two GPS fixes
 * are skipped.
 */
export function loadRideSegmentLines(database: SyncDatabase, rideId: string): PreviewPoint[][] {
  const attempts = database
    .prepare(
      `SELECT start_point_index AS start_index, end_point_index AS end_index
       FROM segment_attempts
       WHERE ride_id = ? AND (decision = 'accept' OR manually_approved = 1)
       ORDER BY start_point_index`,
    )
    .all(rideId) as { start_index: number; end_index: number }[];

  const lines: PreviewPoint[][] = [];
  for (const attempt of attempts) {
    const rows = database
      .prepare(
        `SELECT latitude, longitude FROM ride_points
         WHERE ride_id = ? AND point_index BETWEEN ? AND ? AND latitude IS NOT NULL AND longitude IS NOT NULL
         ORDER BY point_index`,
      )
      .all(rideId, attempt.start_index, attempt.end_index) as StoredPoint[];
    if (rows.length < 2) continue;
    lines.push(thinCourse(rows.map((row) => ({ lat: row.latitude, lng: row.longitude })), POINTS_PER_SEGMENT_LINE));
  }
  return lines;
}
