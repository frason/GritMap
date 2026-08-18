import { PARSER_VERSION, parseFitFile } from "../fit/parseFitFile.ts";
import type { RideIdentityDatabase } from "../db/getRideIdentity.ts";
import { listRideIdentities } from "../db/getRideIdentity.ts";
import {
  insertImportedRide,
  replaceImportedRide,
  type ImportedRideParams,
} from "../db/persistImportedRide.ts";
import type { SyncDatabase } from "../db/types.ts";
import { findDuplicate, type CandidateRideIdentity, type DuplicateRule } from "./findDuplicate.ts";
import { extractRideIdentity } from "./fitIdentity.ts";

export interface ImportFitFileInput {
  bytes: ArrayBuffer | Uint8Array;
  filename: string;
  contentHash: string;
  retainedFileUri: string;
  fileSizeBytes: number;
  nowMs: number;
}

export type ImportFitFileResult =
  | { status: "imported"; rideId: string }
  | { status: "duplicate"; matchedRideId: string; matchedRule: DuplicateRule }
  | { status: "duplicate-kept"; matchedRideId: string }
  | { status: "replaced"; rideId: string; previousRetainedFileUri: string | null }
  | { status: "failed"; error: string };

type ImportDatabase = SyncDatabase & RideIdentityDatabase;

/**
 * Parses, deduplicates, and persists one FIT file. Deliberately has no filesystem access --
 * retaining the picked file (and cleaning it up on failure/duplicate/replace) is the caller's
 * job, since that's a platform-specific concern this function shouldn't need to be tested
 * against (see the Import screen, which owns that ordering).
 *
 * With no `resolution`, a duplicate is detected but nothing is written -- detection and
 * writing are cleanly separated so nothing is transactional until a resolution is known.
 */
export function importFitFile(
  database: ImportDatabase,
  generateId: () => string,
  input: ImportFitFileInput,
  resolution?: "keep" | "replace",
): ImportFitFileResult {
  let parsed: ReturnType<typeof parseFitFile>;
  let identity: ReturnType<typeof extractRideIdentity>;
  try {
    parsed = parseFitFile(input.bytes);
    identity = extractRideIdentity(parsed);
  } catch (error) {
    return { status: "failed", error: messageOf(error) };
  }

  const candidate: CandidateRideIdentity = {
    contentHash: input.contentHash,
    startTimestampMs: identity.startTimestampMs,
    durationMs: identity.durationMs,
    ...(identity.deviceId !== undefined ? { deviceId: identity.deviceId } : {}),
    ...(identity.activityId !== undefined ? { activityId: identity.activityId } : {}),
  };
  const match = findDuplicate(candidate, listRideIdentities(database));

  const persistParams: ImportedRideParams = {
    contentHash: input.contentHash,
    originalFilename: input.filename,
    retainedFileUri: input.retainedFileUri,
    fileSizeBytes: input.fileSizeBytes,
    points: parsed.points,
    parserVersion: PARSER_VERSION,
    deviceMetadataJson: JSON.stringify(parsed.deviceMetadata),
    startTimestampMs: identity.startTimestampMs,
    durationMs: identity.durationMs,
    nowMs: input.nowMs,
    ...(identity.deviceId !== undefined ? { deviceId: identity.deviceId } : {}),
    ...(identity.activityId !== undefined ? { activityId: identity.activityId } : {}),
    ...(parsed.originalTimezoneOffsetMinutes !== undefined
      ? { originalTimezoneOffsetMinutes: parsed.originalTimezoneOffsetMinutes }
      : {}),
  };

  if (!match.isDuplicate) {
    try {
      const result = insertImportedRide(database, generateId, persistParams);
      return { status: "imported", rideId: result.rideId };
    } catch (error) {
      return { status: "failed", error: messageOf(error) };
    }
  }

  if (resolution === undefined) {
    return {
      status: "duplicate",
      matchedRideId: match.matchedRideId,
      matchedRule: match.matchedRule,
    };
  }
  if (resolution === "keep") {
    return { status: "duplicate-kept", matchedRideId: match.matchedRideId };
  }

  try {
    const result = replaceImportedRide(database, match.matchedRideId, persistParams);
    return {
      status: "replaced",
      rideId: match.matchedRideId,
      previousRetainedFileUri: result.previousRetainedFileUri,
    };
  } catch (error) {
    return { status: "failed", error: messageOf(error) };
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
