import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import type { SyncDatabase } from "./types.ts";

export interface InsertSegmentParams {
  name: string;
  corridorMeters: number;
  requiredCoveragePct: number;
  schemaVersion: number;
  fingerprint: string;
  referencePolyline: readonly SegmentReferencePoint[];
  sourceRideId: string;
  sourceStartPointIndex: number;
  sourceEndPointIndex: number;
  nowMs: number;
}

export interface InsertSegmentResult {
  segmentId: string;
}

/**
 * Inserts a new immutable segment and its resampled reference points in one transaction.
 * Validates before opening the transaction (mirrors persistImportedRide.ts's own practice)
 * so a bad candidate never touches the database at all.
 */
export function insertSegment(
  database: SyncDatabase,
  generateId: () => string,
  params: InsertSegmentParams,
): InsertSegmentResult {
  validateInsertSegmentParams(params);

  const segmentId = generateId();

  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        `INSERT INTO segments (
          id, name, corridor_meters, required_coverage, schema_version, fingerprint,
          source_ride_id, source_start_point_index, source_end_point_index, created_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        segmentId,
        params.name,
        params.corridorMeters,
        params.requiredCoveragePct,
        params.schemaVersion,
        params.fingerprint,
        params.sourceRideId,
        params.sourceStartPointIndex,
        params.sourceEndPointIndex,
        params.nowMs,
      );

    const paramsList = params.referencePolyline.map((point, index) => [
      segmentId,
      index,
      point.lat,
      point.lng,
      point.distanceMeters,
      point.elevationMeters ?? null,
    ]);
    database.runMany(
      `INSERT INTO segment_reference_points (
        segment_id, point_index, latitude, longitude, distance_meters, elevation_meters
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      paramsList,
    );

    database.exec("COMMIT");
    return { segmentId };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function validateInsertSegmentParams(params: InsertSegmentParams): void {
  const points = params.referencePolyline;

  if (points.length < 2) {
    throw new Error("A segment needs at least two reference points");
  }
  if (points[0]!.distanceMeters !== 0) {
    throw new Error("The first reference point must be at distance 0");
  }
  for (let i = 1; i < points.length; i += 1) {
    if (points[i]!.distanceMeters <= points[i - 1]!.distanceMeters) {
      throw new Error(`Reference point distances must strictly increase (index ${i})`);
    }
  }
  points.forEach((point, index) => {
    if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) {
      throw new Error(`Invalid latitude at reference point ${index}`);
    }
    if (!Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180) {
      throw new Error(`Invalid longitude at reference point ${index}`);
    }
    if (point.elevationMeters !== undefined && !Number.isFinite(point.elevationMeters)) {
      throw new Error(`Invalid elevation at reference point ${index}`);
    }
  });

  if (params.sourceStartPointIndex < 0) {
    throw new Error("sourceStartPointIndex must be non-negative");
  }
  if (params.sourceStartPointIndex >= params.sourceEndPointIndex) {
    throw new Error("sourceStartPointIndex must be less than sourceEndPointIndex");
  }
}
