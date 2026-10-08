export interface ListSegmentsDatabase {
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
  };
}

export interface SegmentSummary {
  segmentId: string;
  name: string;
  corridorMeters: number;
  createdAtMs: number;
  /** Length of the segment, from its last reference point; absent for a segment with no points. */
  distanceMeters?: number;
  /** Efforts that count: accepted by the matcher or approved by the rider. */
  effortCount: number;
}

interface StoredSegmentSummary {
  id: string;
  name: string;
  corridor_meters: number;
  created_at_ms: number;
  distance_meters: number | null;
  effort_count: number;
}

/** Lists every segment, newest first, for the Segments tab. */
export function listSegments(database: ListSegmentsDatabase): SegmentSummary[] {
  const rows = database
    .prepare(
      `SELECT
         segments.id, segments.name, segments.corridor_meters, segments.created_at_ms,
         (SELECT MAX(distance_meters) FROM segment_reference_points
           WHERE segment_reference_points.segment_id = segments.id) AS distance_meters,
         (SELECT COUNT(*) FROM segment_attempts
           WHERE segment_attempts.segment_id = segments.id
             AND (segment_attempts.decision = 'accept' OR segment_attempts.manually_approved = 1)) AS effort_count
       FROM segments
       ORDER BY segments.created_at_ms DESC, segments.id DESC`,
    )
    .all() as StoredSegmentSummary[];

  return rows.map((row) => ({
    segmentId: row.id,
    name: row.name,
    corridorMeters: row.corridor_meters,
    createdAtMs: row.created_at_ms,
    ...(row.distance_meters === null ? {} : { distanceMeters: row.distance_meters }),
    effortCount: row.effort_count,
  }));
}
