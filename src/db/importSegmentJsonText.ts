import { importRegistrySegment, type ImportRegistrySegmentResult } from "./importRegistrySegment.ts";
import type { SyncDatabase } from "./types.ts";

/** A real segment file is a few KB; refuse anything absurd before parsing it. */
export const MAX_SEGMENT_JSON_CHARACTERS = 2_000_000;

/**
 * Imports a segment from the text of a portable segment JSON file the rider picked (for example
 * one AirDropped from the Karoo's samples). It goes through exactly the registry import's
 * validation and fingerprint handling: every field is checked, and a fingerprint, when the file
 * has one, must match the one recomputed locally. The only difference is that a file with no
 * fingerprint -- the Karoo's own segment files -- gets the locally computed one instead of being
 * rejected, which is also what the Karoo derives on its side (the algorithm is byte-for-byte the
 * same), so the imported segment matches the one already installed there.
 *
 * A whole `gritmap-transfer` package (the guidance-package JSON the Karoo ships) is accepted too;
 * only its `segment` is used here.
 */
export async function importSegmentJsonText(
  database: SyncDatabase,
  generateId: () => string,
  text: string,
  nowMs: number,
): Promise<ImportRegistrySegmentResult> {
  if (text.length > MAX_SEGMENT_JSON_CHARACTERS) {
    return { status: "invalid", error: "File is too large to be a segment" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return { status: "invalid", error: "Not a valid JSON file" };
  }

  const candidate = unwrapTransferPackage(parsed);
  return importRegistrySegment(database, generateId, candidate, nowMs, { allowMissingFingerprint: true });
}

function unwrapTransferPackage(parsed: unknown): unknown {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as Record<string, unknown>).packageType === "gritmap-transfer" &&
    typeof (parsed as Record<string, unknown>).segment === "object"
  ) {
    return (parsed as Record<string, unknown>).segment;
  }
  return parsed;
}
