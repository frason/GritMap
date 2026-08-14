export interface RideIdentityMetadata {
  /** SHA-256 of the original FIT file bytes. */
  contentHash: string;
  /** FIT activity or session identifier, when the recording provides one. */
  activityId?: string;
  /** Recording-device identifier, such as a serial number, when available. */
  deviceId?: string;
  /** Ride start time as a UTC epoch timestamp. */
  startTimestampMs: number;
  /** Total ride duration. */
  durationMs: number;
}

export interface RideIdentity extends RideIdentityMetadata {
  /** Internal ID assigned to an already-imported ride. */
  rideId: string;
}

/** A not-yet-imported ride has no internal ride ID. */
export type CandidateRideIdentity = RideIdentityMetadata;

export type DuplicateRule = "content-hash" | "activity-id" | "device-timing";

export type DuplicateMatch =
  | { isDuplicate: false }
  | { isDuplicate: true; matchedRideId: string; matchedRule: DuplicateRule };

/** The start and duration comparison window is inclusive. */
export const DEVICE_TIMING_TOLERANCE_MS = 5_000;

/**
 * Finds a previously imported ride using identity metadata only.
 *
 * Rules are evaluated across the entire collection in decreasing order of certainty.
 * GPS coordinates and route similarity are deliberately absent from the input model.
 */
export function findDuplicate(
  candidate: CandidateRideIdentity,
  existingRides: readonly RideIdentity[],
): DuplicateMatch {
  const contentMatch = existingRides.find(
    (existingRide) => existingRide.contentHash === candidate.contentHash,
  );
  if (contentMatch !== undefined) {
    return duplicate(contentMatch.rideId, "content-hash");
  }

  if (candidate.activityId !== undefined) {
    const activityMatch = existingRides.find(
      (existingRide) =>
        existingRide.activityId !== undefined &&
        existingRide.activityId === candidate.activityId,
    );
    if (activityMatch !== undefined) {
      return duplicate(activityMatch.rideId, "activity-id");
    }
  }

  if (candidate.deviceId !== undefined) {
    const timingMatch = existingRides.find(
      (existingRide) =>
        existingRide.deviceId !== undefined &&
        existingRide.deviceId === candidate.deviceId &&
        withinTolerance(existingRide.startTimestampMs, candidate.startTimestampMs) &&
        withinTolerance(existingRide.durationMs, candidate.durationMs),
    );
    if (timingMatch !== undefined) {
      return duplicate(timingMatch.rideId, "device-timing");
    }
  }

  return { isDuplicate: false };
}

function withinTolerance(left: number, right: number): boolean {
  return Math.abs(left - right) <= DEVICE_TIMING_TOLERANCE_MS;
}

function duplicate(matchedRideId: string, matchedRule: DuplicateRule): DuplicateMatch {
  return { isDuplicate: true, matchedRideId, matchedRule };
}
