export interface RideHasPowerDatabase {
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
  };
}

/** True when at least one point of the ride has a power reading (a ride from a bike with a power meter). */
export function rideHasPower(database: RideHasPowerDatabase, rideId: string): boolean {
  const row = database
    .prepare("SELECT 1 AS found FROM ride_points WHERE ride_id = ? AND power_watts IS NOT NULL LIMIT 1")
    .get(rideId);
  // expo-sqlite returns null for no row; node:sqlite returns undefined.
  return row !== undefined && row !== null;
}
