import { fromPortableSegmentJson } from "../segments/fromPortableSegmentJson.ts";
import { insertSegment } from "./insertSegment.ts";
import type { SyncDatabase } from "./types.ts";

export type ImportRegistrySegmentResult =
  | { status: "imported"; segmentId: string }
  | { status: "already-imported"; segmentId: string }
  | { status: "invalid"; error: string };

/**
 * Validates and inserts a segment fetched from the registry (registryClient.ts). Fingerprint
 * is the dedup key -- a segment already imported (by fingerprint, regardless of how it got
 * there: locally defined or previously imported) is reported rather than re-inserted, since
 * segments are immutable and content-addressed.
 */
export async function importRegistrySegment(
  database: SyncDatabase,
  generateId: () => string,
  raw: unknown,
  nowMs: number,
): Promise<ImportRegistrySegmentResult> {
  const parsed = await fromPortableSegmentJson(raw);
  if (!parsed.ok) {
    return { status: "invalid", error: parsed.error };
  }

  const existing = database
    .prepare("SELECT id FROM segments WHERE fingerprint = ?")
    .get(parsed.segment.fingerprint) as { id: string } | undefined;
  if (existing !== undefined) {
    return { status: "already-imported", segmentId: existing.id };
  }

  const { segmentId } = insertSegment(database, generateId, {
    name: parsed.segment.name,
    corridorMeters: parsed.segment.corridorMeters,
    requiredCoveragePct: parsed.segment.requiredCoveragePct,
    schemaVersion: parsed.segment.schemaVersion,
    fingerprint: parsed.segment.fingerprint,
    referencePolyline: parsed.segment.referencePolyline,
    nowMs,
  });
  return { status: "imported", segmentId };
}
