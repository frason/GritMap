import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findDuplicate,
  type CandidateRideIdentity,
  type RideIdentity,
} from "./findDuplicate.ts";

const START_TIME = 1_700_000_000_000;
const DURATION = 3_600_000;

describe("findDuplicate", () => {
  it("prioritizes an exact content hash even when every other field differs", () => {
    const candidate = candidateRide({ activityId: "activity-shared" });
    const activityMatch = existingRide("activity-match", {
      contentHash: "different-hash",
      activityId: "activity-shared",
    });
    const contentMatch = existingRide("content-match", {
      contentHash: candidate.contentHash,
      activityId: "different-activity",
      deviceId: "different-device",
      startTimestampMs: START_TIME + 86_400_000,
      durationMs: DURATION + 60_000,
    });

    assert.deepEqual(findDuplicate(candidate, [activityMatch, contentMatch]), {
      isDuplicate: true,
      matchedRideId: "content-match",
      matchedRule: "content-hash",
    });
  });

  it("matches the same activity ID when content hashes differ", () => {
    const candidate = candidateRide({ activityId: "activity-123" });
    const existing = existingRide("ride-1", {
      contentHash: "different-hash",
      activityId: "activity-123",
    });

    assert.deepEqual(findDuplicate(candidate, [existing]), {
      isDuplicate: true,
      matchedRideId: "ride-1",
      matchedRule: "activity-id",
    });
  });

  it("falls back to matching device, start time, and duration within five seconds", () => {
    const candidate = candidateRide({ deviceId: "karoo-123" });
    const existing = existingRide("ride-1", {
      contentHash: "different-hash",
      deviceId: "karoo-123",
      startTimestampMs: START_TIME - 4_999,
      durationMs: DURATION + 4_999,
    });

    assert.deepEqual(findDuplicate(candidate, [existing]), {
      isDuplicate: true,
      matchedRideId: "ride-1",
      matchedRule: "device-timing",
    });
  });

  it("uses an inclusive 5000ms timing boundary and rejects 5001ms", () => {
    const candidate = candidateRide({ deviceId: "karoo-123" });
    const atBoundary = existingRide("at-boundary", {
      contentHash: "boundary-hash",
      deviceId: "karoo-123",
      startTimestampMs: START_TIME + 5_000,
      durationMs: DURATION - 5_000,
    });
    const outsideBoundary = existingRide("outside-boundary", {
      contentHash: "outside-hash",
      deviceId: "karoo-123",
      startTimestampMs: START_TIME + 5_001,
      durationMs: DURATION,
    });

    assert.equal(findDuplicate(candidate, [atBoundary]).isDuplicate, true);
    assert.deepEqual(findDuplicate(candidate, [outsideBoundary]), { isDuplicate: false });
  });

  it("does not use timing when either device ID is missing", () => {
    const candidateWithoutDevice = candidateRide();
    const existingWithDevice = existingRide("ride-1", {
      contentHash: "different-hash-1",
      deviceId: "karoo-123",
    });
    const candidateWithDevice = candidateRide({ deviceId: "karoo-123" });
    const existingWithoutDevice = existingRide("ride-2", {
      contentHash: "different-hash-2",
    });

    assert.deepEqual(findDuplicate(candidateWithoutDevice, [existingWithDevice]), {
      isDuplicate: false,
    });
    assert.deepEqual(findDuplicate(candidateWithDevice, [existingWithoutDevice]), {
      isDuplicate: false,
    });
  });

  it("treats the same physical route as a distinct ride when identity metadata differs", () => {
    // Route/GPS data cannot affect this result because this module accepts no route data.
    const candidate = candidateRide({ deviceId: "karoo-new" });
    const sameRouteOnAnotherDay = existingRide("earlier-ride", {
      contentHash: "different-hash",
      deviceId: "karoo-old",
      startTimestampMs: START_TIME - 86_400_000,
    });

    assert.deepEqual(findDuplicate(candidate, [sameRouteOnAnotherDay]), {
      isDuplicate: false,
    });
  });

  it("never finds a duplicate in an empty imported-ride collection", () => {
    assert.deepEqual(findDuplicate(candidateRide(), []), { isDuplicate: false });
  });
});

function candidateRide(
  overrides: Partial<CandidateRideIdentity> = {},
): CandidateRideIdentity {
  return {
    contentHash: "candidate-hash",
    startTimestampMs: START_TIME,
    durationMs: DURATION,
    ...overrides,
  };
}

function existingRide(
  rideId: string,
  overrides: Partial<RideIdentity> = {},
): RideIdentity {
  return {
    rideId,
    contentHash: `hash-${rideId}`,
    startTimestampMs: START_TIME,
    durationMs: DURATION,
    ...overrides,
  };
}
