import type { ParsedPoint } from "../fit/parseFitFile.ts";
import type { SyncDatabase } from "./types.ts";

export interface ImportedRideParams {
  contentHash: string;
  originalFilename: string;
  retainedFileUri: string;
  fileSizeBytes: number;
  points: readonly ParsedPoint[];
  parserVersion: number;
  deviceMetadataJson: string;
  activityId?: string;
  deviceId?: string;
  startTimestampMs: number;
  durationMs: number;
  originalTimezoneOffsetMinutes?: number;
  nowMs: number;
}

export interface InsertImportedRideResult {
  rideId: string;
}

export interface ReplaceImportedRideResult {
  /** The retained file this replace superseded, for the caller to delete once this commits. */
  previousRetainedFileUri: string | null;
}

/** Inserts a new imported file, ride, and its points in one transaction. */
export function insertImportedRide(
  database: SyncDatabase,
  generateId: () => string,
  params: ImportedRideParams,
): InsertImportedRideResult {
  const fileId = generateId();
  const rideId = generateId();
  const totalDistanceMeters = computeTotalDistanceMeters(params.points);
  const totalAscentMeters = computeTotalAscentMeters(params.points);
  const endTimestampMs = params.startTimestampMs + params.durationMs;

  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        `INSERT INTO imported_files (
          id, sha256, original_filename, imported_at_ms, retained_file_uri, file_size_bytes
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        fileId,
        params.contentHash,
        params.originalFilename,
        params.nowMs,
        params.retainedFileUri,
        params.fileSizeBytes,
      );

    database
      .prepare(
        `INSERT INTO rides (
          id, imported_file_id, parser_version, start_timestamp_ms, end_timestamp_ms,
          created_at_ms, updated_at_ms, activity_id, device_id, duration_ms,
          original_timezone_offset_minutes, fit_metadata_json,
          total_distance_meters, total_ascent_meters
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        rideId,
        fileId,
        params.parserVersion,
        params.startTimestampMs,
        endTimestampMs,
        params.nowMs,
        params.nowMs,
        params.activityId ?? null,
        params.deviceId ?? null,
        params.durationMs,
        params.originalTimezoneOffsetMinutes ?? null,
        params.deviceMetadataJson,
        totalDistanceMeters ?? null,
        totalAscentMeters ?? null,
      );

    insertRidePoints(database, rideId, params.points);

    database.exec("COMMIT");
    return { rideId };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Updates an already-imported ride's file and content in place, preserving `rides.id`.
 * `segment_attempts`/`match_diagnostics` referencing the replaced points are cascade-deleted
 * by the `ride_points` delete below (composite FK, `ON DELETE CASCADE`) -- this is what
 * satisfies MVP.md's "clear all automatic/manual match decisions" requirement on replace.
 *
 * Rescanning the replaced ride against every segment is NOT done here -- there is no
 * segment-scanning orchestrator anywhere in the codebase yet, and segments aren't part of
 * this increment. Track as a follow-up once segment definition lands.
 */
export function replaceImportedRide(
  database: SyncDatabase,
  existingRideId: string,
  params: ImportedRideParams,
): ReplaceImportedRideResult {
  const totalDistanceMeters = computeTotalDistanceMeters(params.points);
  const totalAscentMeters = computeTotalAscentMeters(params.points);
  const endTimestampMs = params.startTimestampMs + params.durationMs;

  database.exec("BEGIN IMMEDIATE");
  try {
    const existing = database
      .prepare(
        `SELECT rides.imported_file_id AS imported_file_id,
                imported_files.retained_file_uri AS retained_file_uri
         FROM rides
         JOIN imported_files ON imported_files.id = rides.imported_file_id
         WHERE rides.id = ?`,
      )
      .get(existingRideId) as
      | { imported_file_id: string; retained_file_uri: string | null }
      | undefined;

    if (existing === undefined) {
      throw new Error(`Cannot replace ride ${existingRideId}: no such ride`);
    }

    database
      .prepare(
        `UPDATE imported_files
         SET sha256 = ?, original_filename = ?, imported_at_ms = ?,
             retained_file_uri = ?, file_size_bytes = ?
         WHERE id = ?`,
      )
      .run(
        params.contentHash,
        params.originalFilename,
        params.nowMs,
        params.retainedFileUri,
        params.fileSizeBytes,
        existing.imported_file_id,
      );

    database
      .prepare(
        `UPDATE rides
         SET parser_version = ?, start_timestamp_ms = ?, end_timestamp_ms = ?,
             updated_at_ms = ?, activity_id = ?, device_id = ?, duration_ms = ?,
             original_timezone_offset_minutes = ?, fit_metadata_json = ?,
             total_distance_meters = ?, total_ascent_meters = ?
         WHERE id = ?`,
      )
      .run(
        params.parserVersion,
        params.startTimestampMs,
        endTimestampMs,
        params.nowMs,
        params.activityId ?? null,
        params.deviceId ?? null,
        params.durationMs,
        params.originalTimezoneOffsetMinutes ?? null,
        params.deviceMetadataJson,
        totalDistanceMeters ?? null,
        totalAscentMeters ?? null,
        existingRideId,
      );

    database.prepare("DELETE FROM ride_points WHERE ride_id = ?").run(existingRideId);
    insertRidePoints(database, existingRideId, params.points);

    database.exec("COMMIT");
    return { previousRetainedFileUri: existing.retained_file_uri };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function insertRidePoints(
  database: SyncDatabase,
  rideId: string,
  points: readonly ParsedPoint[],
): void {
  const paramsList = points.map((point, index) => [
    rideId,
    index,
    point.timestampMs,
    point.lat ?? null,
    point.lng ?? null,
    point.distanceMeters ?? null,
    point.elevationMeters ?? null,
    point.power ?? null,
    point.heartRate ?? null,
    point.cadence ?? null,
    point.speedMetersPerSec ?? null,
    point.temperatureCelsius ?? null,
  ]);
  database.runMany(
    `INSERT INTO ride_points (
      ride_id, point_index, timestamp_ms, latitude, longitude, distance_meters,
      elevation_meters, power_watts, heart_rate_bpm, cadence_rpm,
      speed_meters_per_second, temperature_celsius
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    paramsList,
  );
}

/** FIT distance is cumulative -- the last present sample is the ride's total distance. */
function computeTotalDistanceMeters(points: readonly ParsedPoint[]): number | undefined {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const distance = points[i]?.distanceMeters;
    if (distance !== undefined) return distance;
  }
  return undefined;
}

/**
 * Sum of positive deltas between consecutive points that both have a present elevation
 * sample, in point order. A gap across missing elevation samples contributes no delta --
 * it never fabricates a jump across the gap.
 */
function computeTotalAscentMeters(points: readonly ParsedPoint[]): number | undefined {
  let ascent = 0;
  let previousElevation: number | undefined;
  let sawElevation = false;

  for (const point of points) {
    const elevation = point.elevationMeters;
    if (elevation === undefined) {
      previousElevation = undefined;
      continue;
    }
    sawElevation = true;
    if (previousElevation !== undefined && elevation > previousElevation) {
      ascent += elevation - previousElevation;
    }
    previousElevation = elevation;
  }

  return sawElevation ? ascent : undefined;
}
