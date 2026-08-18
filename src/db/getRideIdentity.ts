import type { RideIdentity } from "../import/findDuplicate.ts";

export interface RideIdentityDatabase {
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
    all(...parameters: unknown[]): unknown[];
  };
}

interface StoredRideIdentity {
  ride_id: string;
  content_hash: string;
  activity_id: string | null;
  device_id: string | null;
  start_timestamp_ms: number | null;
  duration_ms: number | null;
}

const IDENTITY_SELECT = `
  SELECT
    rides.id AS ride_id,
    imported_files.sha256 AS content_hash,
    rides.activity_id,
    rides.device_id,
    rides.start_timestamp_ms,
    rides.duration_ms
  FROM rides
  JOIN imported_files ON imported_files.id = rides.imported_file_id
`;

/** Reads duplicate-comparison identity entirely from SQLite; no FIT reparsing is needed. */
export function getRideIdentity(
  database: RideIdentityDatabase,
  rideId: string,
): RideIdentity | undefined {
  const row = database.prepare(`${IDENTITY_SELECT} WHERE rides.id = ?`).get(rideId) as
    | StoredRideIdentity
    | undefined;

  if (row === undefined) return undefined;
  return toRideIdentity(row);
}

/**
 * Reads every ride's duplicate-comparison identity, for comparing a not-yet-imported
 * candidate against the whole existing collection (see `findDuplicate`).
 */
export function listRideIdentities(database: RideIdentityDatabase): RideIdentity[] {
  const rows = database.prepare(IDENTITY_SELECT).all() as StoredRideIdentity[];
  return rows.map(toRideIdentity);
}

function toRideIdentity(row: StoredRideIdentity): RideIdentity {
  if (row.start_timestamp_ms === null || row.duration_ms === null) {
    throw new Error(`Ride ${row.ride_id} is missing required duplicate-identity timing`);
  }

  return {
    rideId: row.ride_id,
    contentHash: row.content_hash,
    startTimestampMs: row.start_timestamp_ms,
    durationMs: row.duration_ms,
    ...(row.activity_id === null ? {} : { activityId: row.activity_id }),
    ...(row.device_id === null ? {} : { deviceId: row.device_id }),
  };
}
