import type { ParsedRide } from "../fit/parseFitFile.ts";

export interface RideIdentityFields {
  deviceId?: string;
  activityId?: string;
  startTimestampMs: number;
  durationMs: number;
}

/**
 * Extracts duplicate-comparison identity from a parsed FIT ride. These rules were derived by
 * parsing both real fixtures in fixtures/fit/*.fit directly (the same Decoder/Stream calls
 * parseFitFile.ts uses) and inspecting the actual fileId/session/activity message fields --
 * docs/FIT_PARSER_SPIKE.md and ParsedRide.deviceMetadata's opaque shape don't document them.
 *
 * - deviceId: fileIdMesgs[0].serialNumber -- confirmed on both fixtures to be exactly the
 *   recording Karoo (manufacturer "hammerhead", productName "Karoo"), not a paired sensor.
 *   deviceInfoMesgs (the paired-sensor list) is deliberately never used for identity.
 * - activityId: no stable activity/session ID field exists anywhere in fileIdMesgs,
 *   sessionMesgs, or activityMesgs on either real fixture -- every key was inspected. This is
 *   a finding, not an assumption, so there is no speculative extraction path here for a field
 *   never observed to exist; activityId is always omitted. findDuplicate's device+timing
 *   fallback is the operative duplicate rule for this device family as a result.
 * - startTimestampMs: sessionMesgs[0].startTime when present (confirmed present and sane on
 *   both fixtures), else the first ride point's timestampMs as a documented fallback.
 * - durationMs: sessionMesgs[0].totalElapsedTime (seconds; confirmed present, matches the
 *   session's own start/end timestamps) -- FIT's *elapsed* time, which includes stopped/
 *   auto-paused wall time, matching MVP.md's own duration definition. totalTimerTime (moving
 *   time only) is deliberately not used. Falls back to last-minus-first ride point timestamp
 *   as a documented fallback when no session message exists.
 */
export function extractRideIdentity(ride: ParsedRide): RideIdentityFields {
  const fileId = asRecord(ride.deviceMetadata.fileId);
  const deviceId = fileId ? stringifyId(fileId.serialNumber) : undefined;

  const session = firstOf(ride.deviceMetadata.sessions);

  const startTimestampMs = toTimestampMs(session?.startTime) ?? ride.points[0]?.timestampMs;
  if (startTimestampMs === undefined) {
    throw new Error("Cannot determine ride start: no session startTime and no ride points");
  }

  const totalElapsedSeconds = finiteNumber(session?.totalElapsedTime);
  const durationMs =
    totalElapsedSeconds !== undefined
      ? totalElapsedSeconds * 1000
      : fallbackDurationMs(ride.points);
  if (durationMs === undefined) {
    throw new Error("Cannot determine ride duration: no session totalElapsedTime and no ride points");
  }

  return {
    ...(deviceId !== undefined ? { deviceId } : {}),
    startTimestampMs,
    durationMs,
  };
}

function fallbackDurationMs(points: ParsedRide["points"]): number | undefined {
  if (points.length === 0) return undefined;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return undefined;
  return last.timestampMs - first.timestampMs;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function firstOf(value: unknown): Record<string, unknown> | undefined {
  return Array.isArray(value) && value.length > 0 ? asRecord(value[0]) : undefined;
}

function toTimestampMs(value: unknown): number | undefined {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringifyId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}
