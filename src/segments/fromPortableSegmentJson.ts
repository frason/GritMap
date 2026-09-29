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
export async function fromPortableSegmentJson(raw: unknown): Promise<FromPortableSegmentJsonResult> {
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
  if (typeof value.fingerprint !== "string" || value.fingerprint.length === 0) {
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
  if (recomputedFingerprint !== value.fingerprint) {
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
      fingerprint: value.fingerprint,
      referencePolyline,
    },
  };
}
