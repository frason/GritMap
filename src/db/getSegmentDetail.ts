import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";

export interface GetSegmentDetailDatabase {
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
    all(...parameters: unknown[]): unknown[];
  };
}

export interface SegmentDetail {
  segmentId: string;
  name: string;
  corridorMeters: number;
  requiredCoveragePct: number;
  schemaVersion: number;
  fingerprint: string;
  createdAtMs: number;
  referencePolyline: SegmentReferencePoint[];
  sourceRideId?: string;
  sourceStartPointIndex?: number;
  sourceEndPointIndex?: number;
}

interface StoredSegment {
  id: string;
  name: string;
  corridor_meters: number;
  required_coverage: number;
  schema_version: number;
  fingerprint: string;
  created_at_ms: number;
  source_ride_id: string | null;
  source_start_point_index: number | null;
  source_end_point_index: number | null;
}

interface StoredReferencePoint {
  latitude: number;
  longitude: number;
  distance_meters: number;
  elevation_meters: number | null;
}

/** Reads one segment's full detail (metadata + resampled reference polyline). */
export function getSegmentDetail(
  database: GetSegmentDetailDatabase,
  segmentId: string,
): SegmentDetail | undefined {
  const segment = database
    .prepare(
      `SELECT
        id, name, corridor_meters, required_coverage, schema_version, fingerprint,
        created_at_ms, source_ride_id, source_start_point_index, source_end_point_index
      FROM segments
      WHERE id = ?`,
    )
    .get(segmentId) as StoredSegment | undefined;

  if (segment === undefined) return undefined;

  const points = database
    .prepare(
      `SELECT latitude, longitude, distance_meters, elevation_meters
       FROM segment_reference_points
       WHERE segment_id = ?
       ORDER BY point_index`,
    )
    .all(segmentId) as StoredReferencePoint[];

  return {
    segmentId: segment.id,
    name: segment.name,
    corridorMeters: segment.corridor_meters,
    requiredCoveragePct: segment.required_coverage,
    schemaVersion: segment.schema_version,
    fingerprint: segment.fingerprint,
    createdAtMs: segment.created_at_ms,
    referencePolyline: points.map((point) => ({
      lat: point.latitude,
      lng: point.longitude,
      distanceMeters: point.distance_meters,
      ...(point.elevation_meters === null ? {} : { elevationMeters: point.elevation_meters }),
    })),
    ...(segment.source_ride_id === null ? {} : { sourceRideId: segment.source_ride_id }),
    ...(segment.source_start_point_index === null
      ? {}
      : { sourceStartPointIndex: segment.source_start_point_index }),
    ...(segment.source_end_point_index === null
      ? {}
      : { sourceEndPointIndex: segment.source_end_point_index }),
  };
}
