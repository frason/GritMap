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
}

interface StoredSegmentSummary {
  id: string;
  name: string;
  corridor_meters: number;
  created_at_ms: number;
}

/** Lists every segment, newest first, for the Segments tab. */
export function listSegments(database: ListSegmentsDatabase): SegmentSummary[] {
  const rows = database
    .prepare(
      `SELECT id, name, corridor_meters, created_at_ms
       FROM segments
       ORDER BY created_at_ms DESC, id DESC`,
    )
    .all() as StoredSegmentSummary[];

  return rows.map((row) => ({
    segmentId: row.id,
    name: row.name,
    corridorMeters: row.corridor_meters,
    createdAtMs: row.created_at_ms,
  }));
}
