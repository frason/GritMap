import type { SegmentReferencePoint } from "./resamplePolyline.ts";
import { computeSegmentFingerprint } from "./segmentFingerprint.ts";

export interface ParsedPortableSegment {
  id: string;
  name: string;
  schemaVersion: number;
  corridorMeters: number;
  requiredCoveragePct: number;
  fingerprint: string;
  referencePolyline: SegmentReferencePoint[];
}

export type FromPortableSegmentJsonResult =
  | { ok: true; segment: ParsedPortableSegment }
  | { ok: false; error: string };

/**
 * Reverses toPortableSegmentJson.ts -- the read side needed to import a segment fetched
 * from the registry (see registryClient.ts). A registry entry is untrusted network input
 * (possibly stale, corrupted, or from a future schema version), so every field is checked
 * and the fingerprint is recomputed locally and compared rather than trusted at face value.
 */
export interface FromPortableSegmentJsonOptions {
  /**
   * Accept a document with no `fingerprint` field and use the locally computed one. The Karoo's
   * own segment files (apps/karoo/samples/*.segment.json) omit it -- the Karoo derives it on
   * import -- so a file the rider moves from the Karoo has none to verify. A fingerprint that IS
   * present must still match, and the registry path leaves this off and keeps requiring it.
   */
  allowMissingFingerprint?: boolean;
}

export async function fromPortableSegmentJson(
  raw: unknown,
  options: FromPortableSegmentJsonOptions = {},
): Promise<FromPortableSegmentJsonResult> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Not a JSON object" };
  }
  const value = raw as Record<string, unknown>;

  if (value.direction !== "forward") {
    return { ok: false, error: `Unsupported direction: ${String(value.direction)}` };
  }
  if (typeof value.schemaVersion !== "number") {
    return { ok: false, error: "Missing or invalid schemaVersion" };
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    return { ok: false, error: "Missing or invalid id" };
  }
  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    return { ok: false, error: "Missing or invalid name" };
  }
  const fingerprintMissing = value.fingerprint === undefined;
  if (fingerprintMissing ? options.allowMissingFingerprint !== true : typeof value.fingerprint !== "string" || value.fingerprint.length === 0) {
    return { ok: false, error: "Missing or invalid fingerprint" };
  }

  const matching = value.matching as Record<string, unknown> | undefined;
  if (typeof matching?.corridorMeters !== "number" || typeof matching?.requiredCoveragePct !== "number") {
    return { ok: false, error: "Missing or invalid matching parameters" };
  }

  const rawPolyline = value.referencePolyline;
  if (!Array.isArray(rawPolyline) || rawPolyline.length < 2) {
    return { ok: false, error: "referencePolyline must have at least two points" };
  }
  const referencePolyline: SegmentReferencePoint[] = [];
  for (const point of rawPolyline) {
    const p = point as Record<string, unknown> | null;
    if (
      typeof p?.lat !== "number" ||
      typeof p.lng !== "number" ||
      typeof p.distanceMeters !== "number"
    ) {
      return { ok: false, error: "Invalid reference point" };
    }
    referencePolyline.push({
      lat: p.lat,
      lng: p.lng,
      distanceMeters: p.distanceMeters,
      ...(typeof p.elevationMeters === "number" ? { elevationMeters: p.elevationMeters } : {}),
    });
  }

  const recomputedFingerprint = await computeSegmentFingerprint({
    corridorMeters: matching.corridorMeters,
    requiredCoveragePct: matching.requiredCoveragePct,
    referencePolyline,
  });
  if (!fingerprintMissing && recomputedFingerprint !== value.fingerprint) {
    return { ok: false, error: "Fingerprint mismatch -- segment data may be corrupted or tampered" };
  }

  return {
    ok: true,
    segment: {
      id: value.id,
      name: value.name,
      schemaVersion: value.schemaVersion,
      corridorMeters: matching.corridorMeters,
      requiredCoveragePct: matching.requiredCoveragePct,
      fingerprint: recomputedFingerprint,
      referencePolyline,
    },
  };
}
